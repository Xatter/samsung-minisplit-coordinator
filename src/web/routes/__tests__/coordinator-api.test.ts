import request from 'supertest';
import express from 'express';
import { HeatPumpCoordinator } from '../../../coordinator/heat-pump-coordinator';
import { createCoordinatorApiRoutes } from '../coordinator-api';

describe('Coordinator API Routes', () => {
  let app: express.Application;
  let mockCoordinator: jest.Mocked<HeatPumpCoordinator>;

  beforeEach(() => {
    // Create mock coordinator with all required methods
    mockCoordinator = {
      getCoordinatorStatus: jest.fn(),
      setGlobalMode: jest.fn(),
      setGlobalTemperatureRangeImmediate: jest.fn(),
      runCoordinationCycle: jest.fn(),
      emergencyOff: jest.fn(),
    } as any;

    app = express();
    app.use(express.json());
    app.use('/api/coordinator', createCoordinatorApiRoutes(mockCoordinator));
  });

  describe('GET /api/coordinator/status', () => {
    test('should return coordinator status', async () => {
      // Given a coordinator with status data
      const mockStatus = {
        isRunning: true,
        isAuthenticated: true,
        globalMode: 'cool',
        globalRange: { min: 68, max: 75 },
        outsideTemperature: 80,
        onlineUnits: 3,
        totalUnits: 4,
        unresolvedConflicts: 0,
      };
      mockCoordinator.getCoordinatorStatus.mockReturnValue(mockStatus);

      // When requesting coordinator status
      const response = await request(app).get('/api/coordinator/status');

      // Should return status with 200 OK
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatus);
      expect(mockCoordinator.getCoordinatorStatus).toHaveBeenCalled();
    });

    test('should handle coordinator errors', async () => {
      // Given coordinator throws an error
      mockCoordinator.getCoordinatorStatus.mockImplementation(() => {
        throw new Error('Coordinator failure');
      });

      // When requesting coordinator status
      const response = await request(app).get('/api/coordinator/status');

      // Should return error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get coordinator status');
    });
  });

  describe('POST /api/coordinator/mode', () => {
    test('should set global mode successfully', async () => {
      // Given valid mode data
      const modeData = { mode: 'heat', reason: 'manual_override' };
      mockCoordinator.setGlobalMode.mockResolvedValue(undefined);

      // When setting global mode
      const response = await request(app)
        .post('/api/coordinator/mode')
        .send(modeData);

      // Should set mode and return success
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockCoordinator.setGlobalMode).toHaveBeenCalledWith('heat', 'manual_override');
    });

    test('should validate mode parameter', async () => {
      // Given invalid mode data
      const invalidModeData = { mode: 'invalid_mode' };

      // When setting invalid global mode
      const response = await request(app)
        .post('/api/coordinator/mode')
        .send(invalidModeData);

      // Should return validation error
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid mode. Must be heat, cool, or off');
    });
  });

  describe('POST /api/coordinator/temperature-range', () => {
    test('should set temperature range successfully', async () => {
      // Given valid temperature range
      const rangeData = { minTemp: 68, maxTemp: 75 };
      mockCoordinator.setGlobalTemperatureRangeImmediate.mockResolvedValue(undefined);

      // When setting temperature range
      const response = await request(app)
        .post('/api/coordinator/temperature-range')
        .send(rangeData);

      // Should set range and return success
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockCoordinator.setGlobalTemperatureRangeImmediate).toHaveBeenCalledWith(68, 75);
    });

    test('should validate temperature range order', async () => {
      // Given invalid temperature range where min > max
      const invalidRangeData = { minTemp: 75, maxTemp: 68 };

      // When setting invalid temperature range
      const response = await request(app)
        .post('/api/coordinator/temperature-range')
        .send(invalidRangeData);

      // Should return validation error
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Minimum temperature must be less than maximum temperature');
    });
  });

  describe('POST /api/coordinator/emergency-off', () => {
    test('should execute emergency off successfully', async () => {
      // Given emergency off reason
      const emergencyData = { reason: 'manual_emergency_stop' };
      mockCoordinator.emergencyOff.mockResolvedValue(undefined);

      // When executing emergency off
      const response = await request(app)
        .post('/api/coordinator/emergency-off')
        .send(emergencyData);

      // Should execute emergency off and return success
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockCoordinator.emergencyOff).toHaveBeenCalledWith('manual_emergency_stop');
    });
  });

  describe('POST /api/coordinator/run-cycle', () => {
    test('should run coordination cycle successfully', async () => {
      // Given successful coordination result
      const mockResult = {
        success: true,
        actions: [{ deviceId: 'device1', action: 'setMode', value: 'cool' }],
        conflicts: [],
        systemMode: 'cool',
        reasoning: 'Coordination completed successfully',
      };
      mockCoordinator.runCoordinationCycle.mockResolvedValue(mockResult);

      // When running coordination cycle
      const response = await request(app).post('/api/coordinator/run-cycle');

      // Should run cycle and return result
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockCoordinator.runCoordinationCycle).toHaveBeenCalled();
    });

    test('should handle coordination cycle failure', async () => {
      // Given coordination cycle fails
      const mockResult = {
        success: false,
        actions: [],
        conflicts: ['Coordination failed'],
        systemMode: 'off',
        reasoning: 'Error during coordination',
      };
      mockCoordinator.runCoordinationCycle.mockResolvedValue(mockResult);

      // When running coordination cycle
      const response = await request(app).post('/api/coordinator/run-cycle');

      // Should return failure result with 200 (business logic failure, not HTTP error)
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(response.body.success).toBe(false);
    });
  });
});