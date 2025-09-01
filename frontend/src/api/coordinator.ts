import apiClient from './client';

export interface CoordinatorStatus {
  isRunning: boolean;
  isAuthenticated: boolean;
  globalMode: 'heat' | 'cool' | 'off';
  globalRange: { min: number; max: number };
  outsideTemperature: number;
  lastWeatherUpdate: Date;
  onlineUnits: number;
  totalUnits: number;
  unresolvedConflicts: number;
  weatherCacheValid: boolean;
}

export interface CoordinationResult {
  success: boolean;
  actions: Array<{
    deviceId: string;
    action: string;
    value: any;
    reason: string;
  }>;
  conflicts: string[];
  systemMode: 'heat' | 'cool' | 'off';
  reasoning: string;
}

export const coordinatorApi = {
  // Get coordinator status
  async getStatus(): Promise<CoordinatorStatus> {
    const response = await apiClient.get('/api/coordinator/status');
    return response.data;
  },

  // Set global mode
  async setMode(mode: 'heat' | 'cool' | 'off', reason: string = 'api_request'): Promise<void> {
    await apiClient.post('/api/coordinator/mode', { mode, reason });
  },

  // Set temperature range
  async setTemperatureRange(minTemp: number, maxTemp: number): Promise<void> {
    await apiClient.post('/api/coordinator/temperature-range', { minTemp, maxTemp });
  },

  // Emergency off all units
  async emergencyOff(reason: string = 'api_emergency_stop'): Promise<void> {
    await apiClient.post('/api/coordinator/emergency-off', { reason });
  },

  // Run coordination cycle
  async runCoordinationCycle(): Promise<CoordinationResult> {
    const response = await apiClient.post('/api/coordinator/run-cycle');
    return response.data;
  },
};

export default coordinatorApi;