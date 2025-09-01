import request from 'supertest';
import express from 'express';
import { createMatterApiRoutes } from '../matter-api';

describe('Matter API Routes', () => {
  let app: express.Application;
  let mockMatterBridge: any;

  beforeEach(() => {
    // Create mock Matter bridge with required methods
    mockMatterBridge = {
      getCommissioningInfo: jest.fn(),
      resetCommissioning: jest.fn(),
      getCommissioningStatus: jest.fn(),
    };

    app = express();
    app.use(express.json());
    app.use('/api/matter', createMatterApiRoutes(mockMatterBridge));
  });

  describe('GET /api/matter/status', () => {
    test('should return Matter commissioning status and codes', async () => {
      // Given Matter bridge returns commissioning information
      const mockCommissioningInfo = {
        status: 'ready_for_commissioning',
        qrCode: 'MT:YNJV1QTI0PQ45J11',
        manualPairingCode: '749701123',
        discriminator: '3840',
        vendorId: '65521',
        productId: '32768',
        isCommissioned: false,
        fabricsCount: 0,
      };
      mockMatterBridge.getCommissioningInfo.mockResolvedValue(mockCommissioningInfo);

      // When requesting Matter status
      const response = await request(app).get('/api/matter/status');

      // Should return commissioning info with 200 OK
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCommissioningInfo);
      expect(mockMatterBridge.getCommissioningInfo).toHaveBeenCalled();
    });

    test('should handle Matter bridge errors', async () => {
      // Given Matter bridge throws an error
      mockMatterBridge.getCommissioningInfo.mockRejectedValue(new Error('Matter bridge failure'));

      // When requesting Matter status
      const response = await request(app).get('/api/matter/status');

      // Should return error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get Matter commissioning status');
    });
  });

  describe('POST /api/matter/reset', () => {
    test('should reset Matter commissioning successfully', async () => {
      // Given Matter bridge can reset commissioning
      mockMatterBridge.resetCommissioning.mockResolvedValue({
        success: true,
        message: 'Commissioning reset successfully',
      });

      // When resetting Matter commissioning
      const response = await request(app).post('/api/matter/reset');

      // Should reset commissioning and return success
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockMatterBridge.resetCommissioning).toHaveBeenCalled();
    });

    test('should handle reset failure', async () => {
      // Given Matter bridge reset fails
      mockMatterBridge.resetCommissioning.mockRejectedValue(new Error('Reset failed'));

      // When resetting Matter commissioning
      const response = await request(app).post('/api/matter/reset');

      // Should return error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to reset Matter commissioning');
    });
  });

  describe('GET /api/matter/commissioning-status', () => {
    test('should return detailed commissioning status', async () => {
      // Given Matter bridge returns detailed status
      const mockStatus = {
        isCommissioned: true,
        fabricsCount: 2,
        connectedControllers: ['Home Assistant', 'Apple Home'],
        lastCommissionedTime: '2024-01-01T12:00:00.000Z',
        networkStatus: 'connected',
      };
      mockMatterBridge.getCommissioningStatus.mockResolvedValue(mockStatus);

      // When requesting commissioning status
      const response = await request(app).get('/api/matter/commissioning-status');

      // Should return detailed status
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatus);
      expect(mockMatterBridge.getCommissioningStatus).toHaveBeenCalled();
    });
  });
});