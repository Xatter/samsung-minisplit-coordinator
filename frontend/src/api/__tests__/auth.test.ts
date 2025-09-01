import { describe, test, expect, beforeEach, vi } from 'vitest'
import { authApi } from '../auth'
import apiClient from '../client'

// Mock the api client
vi.mock('../client')
const mockedApiClient = vi.mocked(apiClient)

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStatus', () => {
    test('given user is authenticated, should return status with user info', async () => {
      // Given authenticated user response
      const mockStatus = {
        isAuthenticated: true,
        user: {
          userId: 'user123',
          email: 'user@example.com',
          name: 'Test User',
        },
      }
      mockedApiClient.get.mockResolvedValue({ data: mockStatus })

      // When getting auth status
      const actual = await authApi.getStatus()

      // Should return status data and call correct endpoint
      expect(actual).toEqual(mockStatus)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/auth/status')
    })

    test('given user is not authenticated, should return unauthenticated status', async () => {
      // Given unauthenticated user response
      const mockStatus = {
        isAuthenticated: false,
        user: null,
      }
      mockedApiClient.get.mockResolvedValue({ data: mockStatus })

      // When getting auth status
      const actual = await authApi.getStatus()

      // Should return unauthenticated status
      expect(actual).toEqual(mockStatus)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/auth/status')
    })

    test('given API error, should throw error', async () => {
      // Given API throws error
      const mockError = new Error('Auth service unavailable')
      mockedApiClient.get.mockRejectedValue(mockError)

      // When getting auth status
      const promise = authApi.getStatus()

      // Should throw the error
      await expect(promise).rejects.toThrow('Auth service unavailable')
    })
  })

  describe('getAuthUrl', () => {
    test('given auth URL request, should return SmartThings OAuth URL', async () => {
      // Given OAuth URL response
      const mockResponse = {
        authUrl: 'https://auth.smartthings.com/oauth/authorize?client_id=test&scope=devices&redirect_uri=http://localhost:3001/auth/callback',
      }
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      // When getting auth URL
      const actual = await authApi.getAuthUrl()

      // Should return auth URL and call correct endpoint
      expect(actual).toEqual(mockResponse.authUrl)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/auth/url')
    })

    test('given API error, should throw error', async () => {
      // Given API throws error
      const mockError = new Error('Failed to generate auth URL')
      mockedApiClient.get.mockRejectedValue(mockError)

      // When getting auth URL
      const promise = authApi.getAuthUrl()

      // Should throw the error
      await expect(promise).rejects.toThrow('Failed to generate auth URL')
    })
  })

  describe('logout', () => {
    test('given logout request, should logout user successfully', async () => {
      // Given successful logout response
      const mockResponse = {
        success: true,
        message: 'Logged out successfully',
      }
      mockedApiClient.post.mockResolvedValue({ data: mockResponse })

      // When logging out
      const actual = await authApi.logout()

      // Should return success result and call correct endpoint
      expect(actual).toEqual(mockResponse)
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/logout')
    })

    test('given logout failure, should throw error', async () => {
      // Given API throws error
      const mockError = new Error('Logout failed')
      mockedApiClient.post.mockRejectedValue(mockError)

      // When logging out
      const promise = authApi.logout()

      // Should throw the error
      await expect(promise).rejects.toThrow('Logout failed')
    })
  })
})