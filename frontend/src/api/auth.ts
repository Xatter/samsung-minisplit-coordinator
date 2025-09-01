import apiClient from './client';

export interface User {
  userId: string;
  email: string;
  name: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
}

export interface LogoutResult {
  success: boolean;
  message: string;
}

export const authApi = {
  // Get authentication status
  async getStatus(): Promise<AuthStatus> {
    const response = await apiClient.get('/api/auth/status');
    return response.data;
  },

  // Get SmartThings OAuth authorization URL
  async getAuthUrl(): Promise<string> {
    const response = await apiClient.get('/api/auth/url');
    return response.data.authUrl;
  },

  // Logout user
  async logout(): Promise<LogoutResult> {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  },
};

export default authApi;