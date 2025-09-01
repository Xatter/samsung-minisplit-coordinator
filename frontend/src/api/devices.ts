import apiClient from './client';

export interface Device {
  deviceId: string;
  name: string;
  label: string;
  capabilities: Array<{ id: string }>;
  status?: any;
}

export interface DeviceStatus {
  deviceId: string;
  components: {
    main: {
      temperatureMeasurement?: {
        temperature?: {
          value: number;
          unit: string;
        };
      };
      thermostatCoolingSetpoint?: {
        coolingSetpoint?: {
          value: number;
          unit: string;
        };
      };
      thermostatHeatingSetpoint?: {
        heatingSetpoint?: {
          value: number;
          unit: string;
        };
      };
      switch?: {
        switch?: {
          value: 'on' | 'off';
        };
      };
      airConditionerMode?: {
        airConditionerMode?: {
          value: string;
        };
      };
      thermostat?: {
        thermostatMode?: {
          value: string;
        };
      };
    };
  };
}

export const devicesApi = {
  // Get all devices
  async getDevices(): Promise<Device[]> {
    const response = await apiClient.get('/api/devices');
    return response.data;
  },

  // Get device status
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const response = await apiClient.get(`/api/device/${deviceId}/status`);
    return response.data;
  },

  // Control device power
  async setPower(deviceId: string, state: 'on' | 'off'): Promise<void> {
    await apiClient.post(`/api/device/${deviceId}/control/power`, { state });
  },

  // Set device mode
  async setMode(deviceId: string, mode: string): Promise<void> {
    await apiClient.post(`/api/device/${deviceId}/control/mode`, { mode });
  },

  // Set temperature
  async setTemperature(deviceId: string, temperature: number): Promise<void> {
    await apiClient.post(`/api/device/${deviceId}/control/temperature`, { temperature });
  },

  // Execute custom command
  async executeCommand(
    deviceId: string,
    capability: string,
    command: string,
    args: any[] = []
  ): Promise<void> {
    await apiClient.post(`/api/device/${deviceId}/control/command`, {
      capability,
      command,
      arguments: args,
    });
  },
};

export default devicesApi;