import { SmartThingsClient, BearerTokenAuthenticator, Device } from '@smartthings/core-sdk';
import { SmartThingsOAuth } from './oauth';

export interface SmartThingsDevice {
    deviceId: string;
    name: string;
    label: string;
    roomId?: string;
    locationId: string;
    deviceTypeName: string;
    components: any[];
    capabilities: any[];
    status?: any;
}

export interface DeviceStatus {
    deviceId: string;
    components: {
        [key: string]: {
            [capability: string]: {
                [attribute: string]: {
                    value: any;
                    timestamp: string;
                };
            };
        };
    };
}

export class SmartThingsDeviceManager {
    private client: SmartThingsClient | null = null;
    private oauth: SmartThingsOAuth;

    constructor(oauth: SmartThingsOAuth) {
        this.oauth = oauth;
    }

    public isAuthenticated(): boolean {
        return this.oauth.isAuthenticated();
    }

    private async getClient(): Promise<SmartThingsClient | null> {
        if (!this.oauth.isAuthenticated()) {
            return null;
        }
        
        if (!this.client) {
            try {
                const token = await this.oauth.getValidToken();
                this.client = new SmartThingsClient(new BearerTokenAuthenticator(token));
            } catch (error) {
                console.error('Failed to get valid token:', error);
                return null;
            }
        }
        return this.client;
    }

    async getLocations() {
        const client = await this.getClient();
        if (!client) {
            throw new Error('SmartThings authentication required');
        }
        try {
            return await client.locations.list();
        } catch (error) {
            console.error('Error getting locations:', error);
            throw new Error('Failed to retrieve locations');
        }
    }

    async getDevices(locationId?: string): Promise<SmartThingsDevice[]> {
        const client = await this.getClient();
        if (!client) {
            throw new Error('SmartThings authentication required');
        }
        try {
            const devices = locationId 
                ? await client.devices.list({ locationId })
                : await client.devices.list();
            
            return devices.map(device => ({
                deviceId: device.deviceId!,
                name: device.name!,
                label: device.label!,
                roomId: device.roomId,
                locationId: device.locationId!,
                deviceTypeName: device.dth?.deviceTypeName || 'Unknown',
                components: device.components || [],
                capabilities: device.components?.flatMap(comp => comp.capabilities || []) || [],
            }));
        } catch (error) {
            console.error('Error getting devices:', error);
            throw new Error('Failed to retrieve devices');
        }
    }

    async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
        const client = await this.getClient();
        if (!client) {
            throw new Error('SmartThings authentication required');
        }
        try {
            const status = await client.devices.getStatus(deviceId);
            return {
                deviceId,
                components: status.components as any || {},
            };
        } catch (error) {
            console.error(`Error getting device status for ${deviceId}:`, error);
            throw new Error(`Failed to get device status for ${deviceId}`);
        }
    }

    async executeDeviceCommand(deviceId: string, capability: string, command: string, args: any[] = []): Promise<void> {
        const client = await this.getClient();
        if (!client) {
            throw new Error('SmartThings authentication required');
        }
        try {
            await client.devices.executeCommand(deviceId, {
                capability,
                command,
                arguments: args,
                component: 'main',
            } as any);
        } catch (error) {
            console.error(`Error executing command ${command} on device ${deviceId}:`, error);
            // Preserve the original error details for proper 422 detection
            const newError = new Error(`Failed to execute command ${command} on device ${deviceId}`);
            (newError as any).originalError = error;
            (newError as any).status = (error as any).status;
            (newError as any).response = (error as any).response;
            throw newError;
        }
    }

    async getThermostatDevices(locationId?: string): Promise<SmartThingsDevice[]> {
        const devices = await this.getDevices(locationId);
        return devices.filter(device => 
            device.capabilities.some(cap => cap.id === 'thermostat' || cap.id === 'airConditionerMode')
        );
    }

    async getSwitchDevices(locationId?: string): Promise<SmartThingsDevice[]> {
        const devices = await this.getDevices(locationId);
        return devices.filter(device => 
            device.capabilities.some(cap => cap.id === 'switch')
        );
    }

    private async getDeviceCapabilities(deviceId: string): Promise<any[]> {
        const devices = await this.getDevices();
        const device = devices.find(d => d.deviceId === deviceId);
        return device?.capabilities || [];
    }

    private async isAirConditioner(deviceId: string): Promise<boolean> {
        const capabilities = await this.getDeviceCapabilities(deviceId);
        return capabilities.some(cap => cap.id === 'airConditionerMode');
    }

    async setThermostatTemperature(deviceId: string, temperature: number, scale: 'F' | 'C' = 'F'): Promise<void> {
        const isAC = await this.isAirConditioner(deviceId);
        
        if (isAC) {
            // For air conditioners, ensure the unit is on before setting temperature
            // Check current power state first to avoid unnecessary commands
            try {
                const status = await this.getDeviceStatus(deviceId);
                const switchState = status.components.main?.switch?.switch?.value;
                
                if (switchState === 'off') {
                    console.log(`Turning on AC ${deviceId} before setting temperature to ${temperature}°${scale}`);
                    await this.executeDeviceCommand(deviceId, 'switch', 'on');
                    // Small delay to ensure switch command is processed
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.warn(`Could not check switch state for ${deviceId}, attempting to turn on anyway:`, error);
                await this.executeDeviceCommand(deviceId, 'switch', 'on');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Air conditioner devices use thermostatCoolingSetpoint
            await this.executeDeviceCommand(deviceId, 'thermostatCoolingSetpoint', 'setCoolingSetpoint', [temperature]);
        } else {
            // Traditional thermostats use thermostatHeatingSetpoint
            await this.executeDeviceCommand(deviceId, 'thermostatHeatingSetpoint', 'setHeatingSetpoint', [temperature]);
        }
    }

    async setThermostatMode(deviceId: string, mode: 'heat' | 'cool' | 'off'): Promise<void> {
        const isAC = await this.isAirConditioner(deviceId);
        
        if (isAC) {
            // Air conditioner devices use airConditionerMode capability
            const acMode = this.convertToAirConditionerMode(mode);
            
            // For air conditioners, ensure the unit is on when setting a mode (except 'off')
            if (mode !== 'off') {
                await this.executeDeviceCommand(deviceId, 'switch', 'on');
                // Small delay to ensure switch command is processed
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            await this.executeDeviceCommand(deviceId, 'airConditionerMode', 'setAirConditionerMode', [acMode]);
            
            // Turn off the switch when mode is 'off'
            if (mode === 'off') {
                await this.executeDeviceCommand(deviceId, 'switch', 'off');
            }
        } else {
            // Traditional thermostats use thermostat capability
            await this.executeDeviceCommand(deviceId, 'thermostat', 'setThermostatMode', [mode]);
        }
    }

    private convertToAirConditionerMode(mode: 'heat' | 'cool' | 'off'): string {
        // Map thermostat modes to air conditioner modes
        // Air conditioners support: 'cool', 'dry', 'wind', 'heat', 'off' (auto mode removed)
        switch (mode) {
            case 'heat': return 'heat';
            case 'cool': return 'cool';
            case 'off': return 'off';
            default: return 'off';
        }
    }

    async switchDevice(deviceId: string, state: 'on' | 'off'): Promise<void> {
        await this.executeDeviceCommand(deviceId, 'switch', state);
    }

    async hasLightingCapability(deviceId: string): Promise<boolean> {
        const capabilities = await this.getDeviceCapabilities(deviceId);
        return capabilities.some(cap => cap.id === 'samsungce.airConditionerLighting');
    }

    async getLightingStatus(deviceId: string): Promise<string | null> {
        try {
            const status = await this.getDeviceStatus(deviceId);
            const lightingComponent = status.components.main?.['samsungce.airConditionerLighting'];
            return lightingComponent?.lightingState?.value || null;
        } catch (error) {
            console.error(`Error getting lighting status for device ${deviceId}:`, error);
            return null;
        }
    }

    async turnOffLighting(deviceId: string): Promise<void> {
        const hasCapability = await this.hasLightingCapability(deviceId);
        if (!hasCapability) {
            console.log(`Device ${deviceId} does not have lighting capability`);
            return;
        }

        // Try different command names and capabilities
        const commandsToTry = [
            // Samsung execute capability (discovered from community forums)
            { capability: 'execute', command: 'execute', args: ['mode/vs/0', {'x.com.samsung.da.options': ['Light_On']}] },
            // Original samsungce.airConditionerLighting attempts
            { capability: 'samsungce.airConditionerLighting', command: 'setLighting', args: ['off'] },
            { capability: 'samsungce.airConditionerLighting', command: 'setAirConditionerLighting', args: ['off'] },
            { capability: 'samsungce.airConditionerLighting', command: 'lightingOff', args: [] },
            { capability: 'samsungce.airConditionerLighting', command: 'setLightingState', args: [false] },
            { capability: 'samsungce.airConditionerLighting', command: 'setLighting', args: [false] },
        ];

        for (const { capability, command, args } of commandsToTry) {
            try {
                console.log(`Trying ${capability}:${command} with args:`, args);
                await this.executeDeviceCommand(deviceId, capability, command, args);
                console.log(`Successfully turned off lighting for device ${deviceId} using ${capability}:${command}`);
                return;
            } catch (error: any) {
                // Check multiple ways the 422 status could be present in the error
                const is422Error = error.status === 422 || 
                                   error.response?.status === 422 ||
                                   error.message?.includes('422') ||
                                   (error.message && error.message.includes('status code 422'));
                
                if (is422Error) {
                    console.log(`Command ${capability}:${command} failed (422 - invalid command), trying next...`);
                    continue;
                } else {
                    console.error(`Command ${capability}:${command} failed with non-422 error:`, error.message);
                    throw error;
                }
            }
        }

        throw new Error(`All lighting commands failed for device ${deviceId}`);
    }

    async getDevicesWithLighting(locationId?: string): Promise<SmartThingsDevice[]> {
        const devices = await this.getDevices(locationId);
        const devicesWithLighting = [];
        
        for (const device of devices) {
            const hasLighting = await this.hasLightingCapability(device.deviceId);
            if (hasLighting) {
                devicesWithLighting.push(device);
            }
        }
        
        return devicesWithLighting;
    }
}