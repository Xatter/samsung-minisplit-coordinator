import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MatterSetup from '../MatterSetup'
import { matterApi } from '../../api/matter'

// Mock the matter API
vi.mock('../../api/matter')
const mockMatterApi = vi.mocked(matterApi)

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

describe('MatterSetup Component', () => {
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

  const mockCommissionedStatus = {
    ...mockMatterStatus,
    status: 'commissioned',
    isCommissioned: true,
    fabricsCount: 2,
  }

  const mockCommissioningStatus = {
    isCommissioned: true,
    fabricsCount: 2,
    connectedControllers: ['HomeKit', 'SmartThings'],
    lastCommissionedTime: '2024-01-01T12:00:00Z',
    networkStatus: 'online',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMatterApi.getStatus.mockResolvedValue(mockMatterStatus)
    mockMatterApi.getCommissioningStatus.mockResolvedValue(mockCommissioningStatus)
  })

  test('given matter setup page is loaded, should display setup header and instructions', async () => {
    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display setup information
    await waitFor(() => {
      expect(screen.getByText(/Matter\/HomeKit Setup/i)).toBeInTheDocument()
      expect(screen.getByText(/Add this device to your smart home/i)).toBeInTheDocument()
    })
  })

  test('given matter status is loaded, should display commissioning information', async () => {
    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display status and codes
    await waitFor(() => {
      expect(screen.getByText(/Ready for Commissioning/i)).toBeInTheDocument()
      expect(screen.getByText(/Not yet added to any smart home/i)).toBeInTheDocument()
    })
  })

  test('given QR code is available, should display QR code and manual pairing code', async () => {
    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display QR code and manual code
    await waitFor(() => {
      expect(screen.getByText('MT:ABC123DEF456GHI789JKL012')).toBeInTheDocument()
      expect(screen.getByText('12345678901')).toBeInTheDocument()
      expect(screen.getByText(/QR Code for Quick Setup/i)).toBeInTheDocument()
      expect(screen.getByText(/Manual Pairing Code/i)).toBeInTheDocument()
    })
  })

  test('given device is commissioned, should display commissioned status', async () => {
    // Given device is already commissioned
    mockMatterApi.getStatus.mockResolvedValue(mockCommissionedStatus)

    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display commissioned status
    await waitFor(() => {
      expect(screen.getByText(/Device is Connected/i)).toBeInTheDocument()
      expect(screen.getByText(/Connected to 2 smart home controller/i)).toBeInTheDocument()
    })
  })

  test('given commissioned device status, should display connected controllers', async () => {
    // Given device is commissioned
    mockMatterApi.getStatus.mockResolvedValue(mockCommissionedStatus)

    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display connected controllers
    await waitFor(() => {
      expect(screen.getByText('HomeKit')).toBeInTheDocument()
      expect(screen.getByText('SmartThings')).toBeInTheDocument()
      expect(screen.getByText(/Last connected:/i)).toBeInTheDocument()
    })
  })

  test('given reset button is clicked, should show confirmation dialog', async () => {
    // Given device is commissioned
    mockMatterApi.getStatus.mockResolvedValue(mockCommissionedStatus)
    
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => false))

    // When rendering and clicking reset
    renderWithProviders(<MatterSetup />)
    
    await waitFor(() => {
      const resetButton = screen.getByRole('button', { name: /reset matter setup/i })
      expect(resetButton).toBeInTheDocument()
    })

    const resetButton = screen.getByRole('button', { name: /reset matter setup/i })
    fireEvent.click(resetButton)

    // Should show confirmation dialog
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/reset.*matter.*setup/i)
    )
  })

  test('given reset is confirmed, should call reset API', async () => {
    // Given device is commissioned and reset succeeds
    mockMatterApi.getStatus.mockResolvedValue(mockCommissionedStatus)
    mockMatterApi.resetCommissioning.mockResolvedValue({
      success: true,
      message: 'Reset successful',
    })
    
    // Mock window.confirm to return true
    vi.stubGlobal('confirm', vi.fn(() => true))

    // When rendering and confirming reset
    renderWithProviders(<MatterSetup />)
    
    await waitFor(() => {
      const resetButton = screen.getByRole('button', { name: /reset matter setup/i })
      expect(resetButton).toBeInTheDocument()
    })

    const resetButton = screen.getByRole('button', { name: /reset matter setup/i })
    fireEvent.click(resetButton)

    // Should call reset API
    await waitFor(() => {
      expect(mockMatterApi.resetCommissioning).toHaveBeenCalled()
    })
  })

  test('given setup instructions section, should display step-by-step guide', async () => {
    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display setup steps
    await waitFor(() => {
      expect(screen.getByText(/Setup Instructions/i)).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText(/Open Your Smart Home App/i)).toBeInTheDocument()
      expect(screen.getByText(/Add New Device/i)).toBeInTheDocument()
    })
  })

  test('given loading state, should display loading indicator', () => {
    // Given API is loading
    mockMatterApi.getStatus.mockReturnValue(new Promise(() => {}))

    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should show loading state
    expect(screen.getByText(/loading matter setup/i)).toBeInTheDocument()
  })

  test('given API error, should display error message', async () => {
    // Given API error
    mockMatterApi.getStatus.mockRejectedValue(new Error('Network error'))

    // When rendering matter setup component
    renderWithProviders(<MatterSetup />)

    // Should display error
    await waitFor(() => {
      expect(screen.getByText(/failed to load matter setup/i)).toBeInTheDocument()
    })
  })
})