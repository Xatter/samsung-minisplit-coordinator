import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Coordinator from '../Coordinator'
import { coordinatorApi } from '../../api/coordinator'

// Mock the coordinator API
vi.mock('../../api/coordinator')
const mockCoordinatorApi = vi.mocked(coordinatorApi)

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

describe('Coordinator Component', () => {
  const mockStatus = {
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

  beforeEach(() => {
    vi.clearAllMocks()
    mockCoordinatorApi.getStatus.mockResolvedValue(mockStatus)
  })

  test('given coordinator status is loaded, should display status cards', async () => {
    // When rendering coordinator component
    renderWithProviders(<Coordinator />)

    // Should display status information
    await waitFor(() => {
      expect(screen.getByText(/Coordinator Status/i)).toBeInTheDocument()
      expect(screen.getByText(/Temperature Control/i)).toBeInTheDocument()
      expect(screen.getByText(/System Health/i)).toBeInTheDocument()
      expect(screen.getByText(/68°F - 75°F/i)).toBeInTheDocument()
      expect(screen.getByText(/80°F/i)).toBeInTheDocument()
    })
  })

  test('given mode controls are displayed, should allow mode changes', async () => {
    // Given successful mode change
    mockCoordinatorApi.setMode.mockResolvedValue()

    // When rendering and changing mode
    renderWithProviders(<Coordinator />)
    
    await waitFor(() => {
      const modeSelect = screen.getByRole('combobox', { name: /global mode/i })
      expect(modeSelect).toBeInTheDocument()
    })

    const modeSelect = screen.getByRole('combobox', { name: /global mode/i })
    const applyButton = screen.getByRole('button', { name: /apply mode/i })

    fireEvent.change(modeSelect, { target: { value: 'heat' } })
    fireEvent.click(applyButton)

    // Should call setMode API
    await waitFor(() => {
      expect(mockCoordinatorApi.setMode).toHaveBeenCalledWith('heat', 'manual_override')
    })
  })

  test('given temperature range controls, should allow range updates', async () => {
    // Given successful range update
    mockCoordinatorApi.setTemperatureRange.mockResolvedValue()

    // When rendering and updating temperature range
    renderWithProviders(<Coordinator />)
    
    await waitFor(() => {
      const minTempInput = screen.getByLabelText(/minimum temperature/i)
      const maxTempInput = screen.getByLabelText(/maximum temperature/i)
      expect(minTempInput).toBeInTheDocument()
      expect(maxTempInput).toBeInTheDocument()
    })

    const minTempInput = screen.getByLabelText(/minimum temperature/i)
    const maxTempInput = screen.getByLabelText(/maximum temperature/i)
    const updateButton = screen.getByRole('button', { name: /update range/i })

    fireEvent.change(minTempInput, { target: { value: '70' } })
    fireEvent.change(maxTempInput, { target: { value: '78' } })
    fireEvent.click(updateButton)

    // Should call setTemperatureRange API
    await waitFor(() => {
      expect(mockCoordinatorApi.setTemperatureRange).toHaveBeenCalledWith(70, 78)
    })
  })

  test('given emergency off button, should execute emergency stop', async () => {
    // Given successful emergency off
    mockCoordinatorApi.emergencyOff.mockResolvedValue()
    
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true))

    // When rendering and clicking emergency off
    renderWithProviders(<Coordinator />)
    
    await waitFor(() => {
      const emergencyButton = screen.getByRole('button', { name: /emergency off/i })
      expect(emergencyButton).toBeInTheDocument()
    })

    const emergencyButton = screen.getByRole('button', { name: /emergency off/i })
    fireEvent.click(emergencyButton)

    // Should confirm and call emergencyOff API
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringMatching(/emergency off/i)
      )
      expect(mockCoordinatorApi.emergencyOff).toHaveBeenCalledWith('manual_emergency_stop')
    })
  })

  test('given run coordination cycle button, should execute cycle', async () => {
    // Given successful coordination cycle
    const mockResult = {
      success: true,
      actions: [{ deviceId: 'device1', action: 'setMode', value: 'cool', reason: 'test' }],
      conflicts: [],
      systemMode: 'cool' as const,
      reasoning: 'Test reasoning',
    }
    mockCoordinatorApi.runCoordinationCycle.mockResolvedValue(mockResult)
    
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true))

    // When rendering and running coordination cycle
    renderWithProviders(<Coordinator />)
    
    await waitFor(() => {
      const cycleButton = screen.getByRole('button', { name: /run coordination/i })
      expect(cycleButton).toBeInTheDocument()
    })

    const cycleButton = screen.getByRole('button', { name: /run coordination/i })
    fireEvent.click(cycleButton)

    // Should confirm and call runCoordinationCycle API
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringMatching(/run a coordination cycle/i)
      )
      expect(mockCoordinatorApi.runCoordinationCycle).toHaveBeenCalled()
    })
  })

  test('given loading state, should display loading indicator', () => {
    // Given API is loading
    mockCoordinatorApi.getStatus.mockReturnValue(new Promise(() => {}))

    // When rendering coordinator component
    renderWithProviders(<Coordinator />)

    // Should show loading state
    expect(screen.getByText(/loading coordinator status/i)).toBeInTheDocument()
  })

  test('given API error, should display error message', async () => {
    // Given API error
    mockCoordinatorApi.getStatus.mockRejectedValue(new Error('Network error'))

    // When rendering coordinator component
    renderWithProviders(<Coordinator />)

    // Should display error
    await waitFor(() => {
      expect(screen.getByText(/failed to load coordinator status/i)).toBeInTheDocument()
    })
  })
})