import apiClient from './client';

export interface MatterCommissioningInfo {
  status: string;
  qrCode: string;
  manualPairingCode: string;
  discriminator: string;
  vendorId: string;
  productId: string;
  isCommissioned: boolean;
  fabricsCount: number;
}

export interface MatterCommissioningStatus {
  isCommissioned: boolean;
  fabricsCount: number;
  connectedControllers: string[];
  lastCommissionedTime: string;
  networkStatus: string;
}

export interface MatterResetResult {
  success: boolean;
  message: string;
}

export const matterApi = {
  // Get Matter commissioning status and codes
  async getStatus(): Promise<MatterCommissioningInfo> {
    const response = await apiClient.get('/api/matter/status');
    return response.data;
  },

  // Reset Matter commissioning
  async resetCommissioning(): Promise<MatterResetResult> {
    const response = await apiClient.post('/api/matter/reset');
    return response.data;
  },

  // Get detailed commissioning status
  async getCommissioningStatus(): Promise<MatterCommissioningStatus> {
    const response = await apiClient.get('/api/matter/commissioning-status');
    return response.data;
  },
};

export default matterApi;