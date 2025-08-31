import { SmartThingsDeviceManager } from './device-manager';
import { MatterSmartApp } from './smartapp';

export interface MatterThermostatState {
    temperature: number;
    targetTemperature: number;
    mode: 'heat' | 'cool' | 'auto' | 'off';
    isOnline: boolean;
}

export interface DeviceMapping {
    matterId: string;
    smartthingsId: string;
    deviceType: 'thermostat' | 'switch';
    name: string;
}

export class SmartThingsMatterBridge {
    private deviceManager: SmartThingsDeviceManager;
    private smartapp: MatterSmartApp;
    private deviceMappings: Map<string, DeviceMapping> = new Map();
    private thermostatStates: Map<string, MatterThermostatState> = new Map();
    
    constructor(deviceManager: SmartThingsDeviceManager, smartapp: MatterSmartApp) {
        this.deviceManager = deviceManager;
        this.smartapp = smartapp;
        
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.smartapp.setThermostatEventHandler((event) => {
            this.handleSmartThingsEvent(event);
        });

        this.smartapp.setSwitchEventHandler((event) => {
            this.handleSmartThingsEvent(event);
        });
    }

    private async handleSmartThingsEvent(event: any) {
        console.log('SmartThings event received:', event);
        
        const mapping = this.findMappingBySmartThingsId(event.deviceId);
        if (!mapping) {
            return;
        }

        try {
            await this.syncSmartThingsToMatter(mapping, event);
        } catch (error) {
            console.error('Error syncing SmartThings to Matter:', error);
        }
    }

    public addDeviceMapping(matterId: string, smartthingsId: string, deviceType: 'thermostat' | 'switch', name: string): void {
        const mapping: DeviceMapping = {
            matterId,
            smartthingsId,
            deviceType,
            name
        };
        
        this.deviceMappings.set(matterId, mapping);
        console.log(`Added device mapping: Matter ${matterId} <-> SmartThings ${smartthingsId} (${deviceType})`);
    }

    public removeDeviceMapping(matterId: string): void {
        this.deviceMappings.delete(matterId);
        this.thermostatStates.delete(matterId);
        console.log(`Removed device mapping for Matter device ${matterId}`);
    }

    public getDeviceMappings(): DeviceMapping[] {
        return Array.from(this.deviceMappings.values());
    }

    private findMappingBySmartThingsId(smartthingsId: string): DeviceMapping | undefined {
        return Array.from(this.deviceMappings.values())
            .find(mapping => mapping.smartthingsId === smartthingsId);
    }

    private async syncSmartThingsToMatter(mapping: DeviceMapping, event?: any): Promise<void> {
        if (mapping.deviceType === 'thermostat') {
            await this.syncThermostatState(mapping);
        }
        // Add switch sync logic here if needed
    }

    private async syncThermostatState(mapping: DeviceMapping): Promise<void> {
        try {
            const status = await this.deviceManager.getDeviceStatus(mapping.smartthingsId);
            const mainComponent = status.components.main;

            if (!mainComponent) return;

            let temperature = 70; // Default
            let targetTemperature = 70; // Default
            let mode: 'heat' | 'cool' | 'auto' | 'off' = 'off';

            if (mainComponent.temperatureMeasurement?.temperature) {
                temperature = mainComponent.temperatureMeasurement.temperature.value;
            }

            if (mainComponent.thermostatHeatingSetpoint?.heatingSetpoint) {
                targetTemperature = mainComponent.thermostatHeatingSetpoint.heatingSetpoint.value;
            } else if (mainComponent.thermostatCoolingSetpoint?.coolingSetpoint) {
                targetTemperature = mainComponent.thermostatCoolingSetpoint.coolingSetpoint.value;
            }

            if (mainComponent.thermostat?.thermostatMode) {
                mode = mainComponent.thermostat.thermostatMode.value as typeof mode;
            }

            const newState: MatterThermostatState = {
                temperature,
                targetTemperature,
                mode,
                isOnline: true
            };

            this.thermostatStates.set(mapping.matterId, newState);
            console.log(`Updated thermostat state for ${mapping.matterId}:`, newState);

        } catch (error) {
            console.error(`Error syncing thermostat state for ${mapping.matterId}:`, error);
            
            const offlineState: MatterThermostatState = {
                temperature: 70,
                targetTemperature: 70,
                mode: 'off',
                isOnline: false
            };
            this.thermostatStates.set(mapping.matterId, offlineState);
        }
    }

    public async handleMatterCommand(matterId: string, command: string, args: any[]): Promise<void> {
        const mapping = this.deviceMappings.get(matterId);
        if (!mapping) {
            throw new Error(`No SmartThings device mapped to Matter device ${matterId}`);
        }

        console.log(`Matter command received: ${command} for ${matterId} (${mapping.smartthingsId})`);

        try {
            switch (command) {
                case 'setHeatingSetpoint':
                    await this.deviceManager.setThermostatTemperature(mapping.smartthingsId, args[0]);
                    break;
                    
                case 'setCoolingSetpoint':
                    await this.deviceManager.setThermostatTemperature(mapping.smartthingsId, args[0]);
                    break;
                    
                case 'setThermostatMode':
                    await this.deviceManager.setThermostatMode(mapping.smartthingsId, args[0]);
                    break;
                    
                case 'switchOn':
                    await this.deviceManager.switchDevice(mapping.smartthingsId, 'on');
                    break;
                    
                case 'switchOff':
                    await this.deviceManager.switchDevice(mapping.smartthingsId, 'off');
                    break;
                    
                default:
                    console.warn(`Unknown Matter command: ${command}`);
            }

            await this.syncSmartThingsToMatter(mapping);

        } catch (error) {
            console.error(`Error executing Matter command ${command}:`, error);
            throw error;
        }
    }

    public getThermostatState(matterId: string): MatterThermostatState | undefined {
        return this.thermostatStates.get(matterId);
    }

    public async syncAllDevices(): Promise<void> {
        console.log('Syncing all mapped devices...');
        
        for (const mapping of this.deviceMappings.values()) {
            try {
                await this.syncSmartThingsToMatter(mapping);
            } catch (error) {
                console.error(`Error syncing device ${mapping.matterId}:`, error);
            }
        }
        
        console.log('Device sync completed');
    }

    public async startPeriodicSync(intervalMs: number = 30000): Promise<void> {
        console.log(`Starting periodic sync every ${intervalMs}ms`);
        
        setInterval(() => {
            this.syncAllDevices().catch(error => {
                console.error('Periodic sync error:', error);
            });
        }, intervalMs);
    }
}