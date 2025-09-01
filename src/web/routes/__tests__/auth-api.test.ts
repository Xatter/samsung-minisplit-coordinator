import request from 'supertest';
import express from 'express';
import { createAuthApiRoutes } from '../auth-api';

describe('Authentication API Routes', () => {
  let app: express.Application;
  let mockOAuth: any;

  beforeEach(() => {
    // Create mock OAuth service with required methods
    mockOAuth = {
      isAuthenticated: jest.fn(),
      getAuthorizationUrl: jest.fn(),
      logout: jest.fn(),
      getUserInfo: jest.fn(),
    };

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthApiRoutes(mockOAuth));
  });

  describe('GET /api/auth/status', () => {
    test('should return authentication status when authenticated', async () => {
      // Given user is authenticated with user info
      mockOAuth.isAuthenticated.mockReturnValue(true);
      mockOAuth.getUserInfo.mockReturnValue({
        userId: 'user123',
        email: 'user@example.com',
        name: 'Test User',
      });

      // When requesting authentication status
      const response = await request(app).get('/api/auth/status');

      // Should return authenticated status with user info
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        isAuthenticated: true,
        user: {
          userId: 'user123',
          email: 'user@example.com',
          name: 'Test User',
        },
      });
      expect(mockOAuth.isAuthenticated).toHaveBeenCalled();
      expect(mockOAuth.getUserInfo).toHaveBeenCalled();
    });

    test('should return unauthenticated status when not authenticated', async () => {
      // Given user is not authenticated
      mockOAuth.isAuthenticated.mockReturnValue(false);

      // When requesting authentication status
      const response = await request(app).get('/api/auth/status');

      // Should return unauthenticated status
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        isAuthenticated: false,
        user: null,
      });
      expect(mockOAuth.isAuthenticated).toHaveBeenCalled();
      expect(mockOAuth.getUserInfo).not.toHaveBeenCalled();
    });

    test('should handle authentication service errors', async () => {
      // Given OAuth service throws an error
      mockOAuth.isAuthenticated.mockImplementation(() => {
        throw new Error('OAuth service failure');
      });

      // When requesting authentication status
      const response = await request(app).get('/api/auth/status');

      // Should return error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to check authentication status');
    });
  });

  describe('GET /api/auth/url', () => {
    test('should return SmartThings OAuth authorization URL', async () => {
      // Given OAuth service returns authorization URL
      const mockAuthUrl = 'https://auth.smartthings.com/oauth/authorize?client_id=test&scope=devices&redirect_uri=http://localhost:3001/auth/callback';
      mockOAuth.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      // When requesting authorization URL
      const response = await request(app).get('/api/auth/url');

      // Should return authorization URL
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        authUrl: mockAuthUrl,
      });
      expect(mockOAuth.getAuthorizationUrl).toHaveBeenCalled();
    });

    test('should handle OAuth URL generation errors', async () => {
      // Given OAuth service throws an error
      mockOAuth.getAuthorizationUrl.mockImplementation(() => {
        throw new Error('Failed to generate auth URL');
      });

      // When requesting authorization URL
      const response = await request(app).get('/api/auth/url');

      // Should return error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get authorization URL');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout user successfully', async () => {
      // Given logout operation succeeds
      mockOAuth.logout.mockResolvedValue({ success: true });

      // When logging out
      const response = await request(app).post('/api/auth/logout');

      // Should logout and return success
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        success: true,
        message: 'Logged out successfully',
      });
      expect(mockOAuth.logout).toHaveBeenCalled();
    });

    test('should handle logout errors', async () => {
      // Given logout operation fails
      mockOAuth.logout.mockRejectedValue(new Error('Logout failed'));

      // When logging out
      const response = await request(app).post('/api/auth/logout');

      // Should return error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to logout');
    });
  });
});