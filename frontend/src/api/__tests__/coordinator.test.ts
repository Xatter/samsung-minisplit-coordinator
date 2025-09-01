import { describe, test, expect, beforeEach, vi } from 'vitest'
import { coordinatorApi } from '../coordinator'
import apiClient from '../client'

// Mock the api client
vi.mock('../client')
const mockedApiClient = vi.mocked(apiClient)

describe('coordinatorApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStatus', () => {
    test('given coordinator API is available, should return status data', async () => {
      // Given coordinator status response
      const mockStatus = {
        isRunning: true,
        isAuthenticated: true,
        globalMode: 'cool',
        globalRange: { min: 68, max: 75 },
        outsideTemperature: 80,
        onlineUnits: 3,
        totalUnits: 4,
        unresolvedConflicts: 0,
      }
      mockedApiClient.get.mockResolvedValue({ data: mockStatus })

      // When getting coordinator status
      const actual = await coordinatorApi.getStatus()

      // Should return status data and call correct endpoint
      expect(actual).toEqual(mockStatus)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/coordinator/status')
    })

    test('given API error, should throw error', async () => {
      // Given API throws error
      const mockError = new Error('Network error')
      mockedApiClient.get.mockRejectedValue(mockError)

      // When getting coordinator status
      const promise = coordinatorApi.getStatus()

      // Should throw the error
      await expect(promise).rejects.toThrow('Network error')
    })
  })

  describe('setMode', () => {
    test('given valid mode and reason, should set global mode', async () => {
      // Given successful response
      mockedApiClient.post.mockResolvedValue({ data: { success: true } })

      // When setting global mode
      await coordinatorApi.setMode('heat', 'manual_override')

      // Should call correct endpoint with parameters
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/coordinator/mode', {
        mode: 'heat',
        reason: 'manual_override',
      })
    })

    test('given only mode parameter, should use default reason', async () => {
      // Given successful response
      mockedApiClient.post.mockResolvedValue({ data: { success: true } })

      // When setting global mode without reason
      await coordinatorApi.setMode('cool')

      // Should call with default reason
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/coordinator/mode', {
        mode: 'cool',
        reason: 'api_request',
      })
    })
  })

  describe('setTemperatureRange', () => {
    test('given valid temperature range, should set range', async () => {
      // Given successful response
      mockedApiClient.post.mockResolvedValue({ data: { success: true } })

      // When setting temperature range
      await coordinatorApi.setTemperatureRange(68, 75)

      // Should call correct endpoint with parameters
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/coordinator/temperature-range', {
        minTemp: 68,
        maxTemp: 75,
      })
    })
  })

  describe('emergencyOff', () => {
    test('given emergency reason, should execute emergency off', async () => {
      // Given successful response
      mockedApiClient.post.mockResolvedValue({ data: { success: true } })

      // When executing emergency off
      await coordinatorApi.emergencyOff('manual_emergency_stop')

      // Should call correct endpoint with reason
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/coordinator/emergency-off', {
        reason: 'manual_emergency_stop',
      })
    })

    test('given no reason, should use default reason', async () => {
      // Given successful response
      mockedApiClient.post.mockResolvedValue({ data: { success: true } })

      // When executing emergency off without reason
      await coordinatorApi.emergencyOff()

      // Should use default reason
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/coordinator/emergency-off', {
        reason: 'api_emergency_stop',
      })
    })
  })

  describe('runCoordinationCycle', () => {
    test('given coordination cycle request, should return coordination result', async () => {
      // Given coordination result
      const mockResult = {
        success: true,
        actions: [{ deviceId: 'device1', action: 'setMode', value: 'cool' }],
        conflicts: [],
        systemMode: 'cool',
        reasoning: 'Coordination completed successfully',
      }
      mockedApiClient.post.mockResolvedValue({ data: mockResult })

      // When running coordination cycle
      const actual = await coordinatorApi.runCoordinationCycle()

      // Should return result and call correct endpoint
      expect(actual).toEqual(mockResult)
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/coordinator/run-cycle')
    })
  })
})