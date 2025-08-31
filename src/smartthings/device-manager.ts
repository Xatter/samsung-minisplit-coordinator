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

    private async getClient(): Promise<SmartThingsClient> {
        if (!this.client) {
            const token = await this.oauth.getValidToken();
            this.client = new SmartThingsClient(new BearerTokenAuthenticator(token));
        }
        return this.client;
    }

    async getLocations() {
        const client = await this.getClient();
        try {
            return await client.locations.list();
        } catch (error) {
            console.error('Error getting locations:', error);
            throw new Error('Failed to retrieve locations');
        }
    }

    async getDevices(locationId?: string): Promise<SmartThingsDevice[]> {
        const client = await this.getClient();
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
                capabilities: device.components?.[0]?.capabilities || [],
            }));
        } catch (error) {
            console.error('Error getting devices:', error);
            throw new Error('Failed to retrieve devices');
        }
    }

    async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
        const client = await this.getClient();
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
        try {
            await client.devices.executeCommand(deviceId, {
                capability,
                command,
                arguments: args,
                component: 'main',
            } as any);
        } catch (error) {
            console.error(`Error executing command ${command} on device ${deviceId}:`, error);
            throw new Error(`Failed to execute command ${command} on device ${deviceId}`);
        }
    }

    async getThermostatDevices(locationId?: string): Promise<SmartThingsDevice[]> {
        const devices = await this.getDevices(locationId);
        return devices.filter(device => 
            device.capabilities.some(cap => cap.id === 'thermostat')
        );
    }

    async getSwitchDevices(locationId?: string): Promise<SmartThingsDevice[]> {
        const devices = await this.getDevices(locationId);
        return devices.filter(device => 
            device.capabilities.some(cap => cap.id === 'switch')
        );
    }

    async setThermostatTemperature(deviceId: string, temperature: number, scale: 'F' | 'C' = 'F'): Promise<void> {
        await this.executeDeviceCommand(deviceId, 'thermostatHeatingSetpoint', 'setHeatingSetpoint', [temperature]);
    }

    async setThermostatMode(deviceId: string, mode: 'heat' | 'cool' | 'auto' | 'off'): Promise<void> {
        await this.executeDeviceCommand(deviceId, 'thermostat', 'setThermostatMode', [mode]);
    }

    async switchDevice(deviceId: string, state: 'on' | 'off'): Promise<void> {
        await this.executeDeviceCommand(deviceId, 'switch', state);
    }
}