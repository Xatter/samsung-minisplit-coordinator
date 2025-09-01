import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from '../Dashboard'
import { coordinatorApi } from '../../api/coordinator'
import { matterApi } from '../../api/matter'
import { authApi } from '../../api/auth'
import { devicesApi } from '../../api/devices'

// Mock all the APIs
vi.mock('../../api/coordinator')
vi.mock('../../api/matter')
vi.mock('../../api/auth')
vi.mock('../../api/devices')

const mockCoordinatorApi = vi.mocked(coordinatorApi)
const mockMatterApi = vi.mocked(matterApi)
const mockAuthApi = vi.mocked(authApi)
const mockDevicesApi = vi.mocked(devicesApi)

// Helper to render component with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('Dashboard Component', () => {
  const mockCoordinatorStatus = {
    isRunning: true,
    isAuthenticated: true,
    globalMode: 'cool' as const,
    globalRange: { min: 68, max: 75 },
    outsideTemperature: 80,
    lastWeatherUpdate: new Date('2024-01-01T12:00:00Z'),
    onlineUnits: 3,
    totalUnits: 4,
    unresolvedConflicts: 0,
    weatherCacheValid: true,
  }

  const mockMatterStatus = {
    status: 'ready_for_commissioning',
    qrCode: 'MT:ABC123DEF456GHI789JKL012',
    manualPairingCode: '12345678901',
    discriminator: '0x01',
    vendorId: '0x1234',
    productId: '0x5678',
    isCommissioned: false,
    fabricsCount: 0,
  }

  const mockAuthStatus = {
    isAuthenticated: true,
    username: 'admin',
    permissions: ['read', 'write'],
  }

  const mockDevices = [
    {
      id: 'device1',
      name: 'Living Room AC',
      type: 'thermostat',
      isOnline: true,
      currentTemperature: 72,
      targetTemperature: 74,
      mode: 'cool' as const,
    },
    {
      id: 'device2', 
      name: 'Bedroom AC',
      type: 'thermostat',
      isOnline: true,
      currentTemperature: 70,
      targetTemperature: 72,
      mode: 'cool' as const,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockCoordinatorApi.getStatus.mockResolvedValue(mockCoordinatorStatus)
    mockMatterApi.getStatus.mockResolvedValue(mockMatterStatus)
    mockAuthApi.getStatus.mockResolvedValue(mockAuthStatus)
    mockDevicesApi.getDevices.mockResolvedValue(mockDevices)
  })

  test('given dashboard is loaded, should display welcome header', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display dashboard header
    await waitFor(() => {
      expect(screen.getByText(/System Dashboard/i)).toBeInTheDocument()
      expect(screen.getByText(/Overview of your smart home system/i)).toBeInTheDocument()
    })
  })

  test('given system status is loaded, should display system overview cards', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display system status cards
    await waitFor(() => {
      expect(screen.getByText(/Coordinator Status/i)).toBeInTheDocument()
      expect(screen.getByText(/System Running/i)).toBeInTheDocument()
      expect(screen.getByText(/3 of 4 units online/i)).toBeInTheDocument()
    })
  })

  test('given matter status is loaded, should display matter connection card', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display matter status
    await waitFor(() => {
      expect(screen.getByText(/Matter\/HomeKit/i)).toBeInTheDocument()
      expect(screen.getByText(/Ready for Setup/i)).toBeInTheDocument()
      expect(screen.getByText(/Not connected to any smart home/i)).toBeInTheDocument()
    })
  })

  test('given matter is commissioned, should display connected status', async () => {
    // Given matter is commissioned
    const commissionedMatter = {
      ...mockMatterStatus,
      isCommissioned: true,
      fabricsCount: 2,
    }
    mockMatterApi.getStatus.mockResolvedValue(commissionedMatter)

    // When rendering dashboard component  
    renderWithProviders(<Dashboard />)

    // Should display commissioned status
    await waitFor(() => {
      expect(screen.getByText(/Matter\/HomeKit/i)).toBeInTheDocument()
      expect(screen.getByText(/Connected to 2 controller/i)).toBeInTheDocument()
    })
  })

  test('given devices are loaded, should display device summary card', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display device summary
    await waitFor(() => {
      expect(screen.getByText(/Smart Devices/i)).toBeInTheDocument()
      expect(screen.getByText(/2 devices configured/i)).toBeInTheDocument()
      expect(screen.getByText(/All devices online/i)).toBeInTheDocument()
    })
  })

  test('given some devices are offline, should display offline count', async () => {
    // Given one device is offline
    const devicesWithOffline = [
      ...mockDevices,
      {
        id: 'device3',
        name: 'Kitchen AC',
        type: 'thermostat' as const,
        isOnline: false,
        currentTemperature: 68,
        targetTemperature: 70,
        mode: 'off' as const,
      },
    ]
    mockDevicesApi.getDevices.mockResolvedValue(devicesWithOffline)

    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display offline device count
    await waitFor(() => {
      expect(screen.getByText(/3 devices configured/i)).toBeInTheDocument()
      expect(screen.getByText(/1 device offline/i)).toBeInTheDocument()
    })
  })

  test('given navigation tiles are displayed, should show links to main sections', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display navigation tiles
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /manage devices/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /coordinator settings/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /matter setup/i })).toBeInTheDocument()
    })
  })

  test('given navigation links are clicked, should navigate to correct pages', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      const deviceLink = screen.getByRole('link', { name: /manage devices/i })
      const coordinatorLink = screen.getByRole('link', { name: /coordinator settings/i })
      const matterLink = screen.getByRole('link', { name: /matter setup/i })
      
      expect(deviceLink).toHaveAttribute('href', '/devices')
      expect(coordinatorLink).toHaveAttribute('href', '/coordinator')
      expect(matterLink).toHaveAttribute('href', '/matter')
    })
  })

  test('given temperature information is available, should display current conditions', async () => {
    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display temperature information
    await waitFor(() => {
      expect(screen.getByText(/Current Conditions/i)).toBeInTheDocument()
      expect(screen.getByText(/Target range: 68°F - 75°F/i)).toBeInTheDocument()
    })
  })

  test('given system has conflicts, should display warning indicator', async () => {
    // Given system has conflicts
    const statusWithConflicts = {
      ...mockCoordinatorStatus,
      unresolvedConflicts: 2,
    }
    mockCoordinatorApi.getStatus.mockResolvedValue(statusWithConflicts)

    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display conflict warning
    await waitFor(() => {
      expect(screen.getByText(/2 unresolved conflicts/i)).toBeInTheDocument()
      expect(screen.getByText(/attention needed/i)).toBeInTheDocument()
    })
  })

  test('given loading state, should display loading indicators', () => {
    // Given APIs are loading
    mockCoordinatorApi.getStatus.mockReturnValue(new Promise(() => {}))
    mockMatterApi.getStatus.mockReturnValue(new Promise(() => {}))
    mockDevicesApi.getDevices.mockReturnValue(new Promise(() => {}))

    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should show loading state
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
  })

  test('given API errors, should display error message', async () => {
    // Given API errors
    mockCoordinatorApi.getStatus.mockRejectedValue(new Error('Network error'))
    mockMatterApi.getStatus.mockRejectedValue(new Error('Network error'))
    mockDevicesApi.getDevices.mockRejectedValue(new Error('Network error'))

    // When rendering dashboard component
    renderWithProviders(<Dashboard />)

    // Should display error
    await waitFor(() => {
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument()
    })
  })
})