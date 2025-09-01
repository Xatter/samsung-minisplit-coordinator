import { describe, test, expect, beforeEach, vi } from 'vitest'
import { matterApi } from '../matter'
import apiClient from '../client'

// Mock the api client
vi.mock('../client')
const mockedApiClient = vi.mocked(apiClient)

describe('matterApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStatus', () => {
    test('given Matter API is available, should return commissioning status', async () => {
      // Given Matter commissioning status response
      const mockStatus = {
        status: 'ready_for_commissioning',
        qrCode: 'MT:YNJV1QTI0PQ45J11',
        manualPairingCode: '749701123',
        discriminator: '3840',
        vendorId: '65521',
        productId: '32768',
        isCommissioned: false,
        fabricsCount: 0,
      }
      mockedApiClient.get.mockResolvedValue({ data: mockStatus })

      // When getting Matter status
      const actual = await matterApi.getStatus()

      // Should return status data and call correct endpoint
      expect(actual).toEqual(mockStatus)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/matter/status')
    })

    test('given API error, should throw error', async () => {
      // Given API throws error
      const mockError = new Error('Matter service unavailable')
      mockedApiClient.get.mockRejectedValue(mockError)

      // When getting Matter status
      const promise = matterApi.getStatus()

      // Should throw the error
      await expect(promise).rejects.toThrow('Matter service unavailable')
    })
  })

  describe('resetCommissioning', () => {
    test('given reset request, should reset Matter commissioning', async () => {
      // Given successful reset response
      const mockResult = {
        success: true,
        message: 'Commissioning reset successfully',
      }
      mockedApiClient.post.mockResolvedValue({ data: mockResult })

      // When resetting commissioning
      const actual = await matterApi.resetCommissioning()

      // Should return result and call correct endpoint
      expect(actual).toEqual(mockResult)
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/matter/reset')
    })

    test('given reset failure, should throw error', async () => {
      // Given API throws error
      const mockError = new Error('Reset failed')
      mockedApiClient.post.mockRejectedValue(mockError)

      // When resetting commissioning
      const promise = matterApi.resetCommissioning()

      // Should throw the error
      await expect(promise).rejects.toThrow('Reset failed')
    })
  })

  describe('getCommissioningStatus', () => {
    test('given commissioning status request, should return detailed status', async () => {
      // Given detailed commissioning status
      const mockStatus = {
        isCommissioned: true,
        fabricsCount: 2,
        connectedControllers: ['Home Assistant', 'Apple Home'],
        lastCommissionedTime: '2024-01-01T12:00:00.000Z',
        networkStatus: 'connected',
      }
      mockedApiClient.get.mockResolvedValue({ data: mockStatus })

      // When getting commissioning status
      const actual = await matterApi.getCommissioningStatus()

      // Should return detailed status and call correct endpoint
      expect(actual).toEqual(mockStatus)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/matter/commissioning-status')
    })
  })
})