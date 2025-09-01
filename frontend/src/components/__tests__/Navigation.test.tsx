import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Navigation from '../Navigation'
import { authApi } from '../../api/auth'

// Mock the auth API
vi.mock('../../api/auth')
const mockAuthApi = vi.mocked(authApi)

// Helper to render component with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('Navigation Component', () => {
  const mockAuthStatus = {
    isAuthenticated: true,
    username: 'admin',
    permissions: ['read', 'write'],
  }

  const mockUnauthenticatedStatus = {
    isAuthenticated: false,
    username: null,
    permissions: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthApi.getStatus.mockResolvedValue(mockAuthStatus)
    mockAuthApi.logout.mockResolvedValue()
    
    // Mock window.location for all router needs
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
      },
      writable: true,
      configurable: true,
    })
    
    // Mock window.innerWidth for responsive tests
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
      configurable: true,
    })
  })

  test('given user is authenticated, should display navigation menu', async () => {
    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should display navigation links
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Devices' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Coordinator' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /matter setup/i })).toBeInTheDocument()
    })
  })

  test('given user is authenticated, should display user info and logout button', async () => {
    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should display user information
    await waitFor(() => {
      expect(screen.getByText(/admin/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })
  })

  test('given user is not authenticated, should not display navigation menu', async () => {
    // Given user is not authenticated
    mockAuthApi.getStatus.mockResolvedValue(mockUnauthenticatedStatus)

    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should not display navigation links
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /devices/i })).not.toBeInTheDocument()
    })
  })

  test('given navigation links, should have correct href attributes', async () => {
    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should have correct link destinations
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices')
      expect(screen.getByRole('link', { name: 'Coordinator' })).toHaveAttribute('href', '/coordinator')
      expect(screen.getByRole('link', { name: /matter setup/i })).toHaveAttribute('href', '/matter')
    })
  })

  test('given logout button is clicked, should call logout API and redirect', async () => {
    // When rendering navigation and clicking logout
    renderWithProviders(<Navigation />)

    await waitFor(() => {
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      expect(logoutButton).toBeInTheDocument()
    })

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutButton)

    // Should call logout API
    await waitFor(() => {
      expect(mockAuthApi.logout).toHaveBeenCalled()
    })
  })

  test('given mobile view, should display hamburger menu button', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      value: 480,
      writable: true,
      configurable: true,
    })

    // Trigger resize event to update component state
    window.dispatchEvent(new Event('resize'))

    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should display mobile menu button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument()
    })
  })

  test('given mobile hamburger menu is clicked, should toggle navigation visibility', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      value: 480,
      writable: true,
      configurable: true,
    })

    // Trigger resize event to update component state
    window.dispatchEvent(new Event('resize'))

    // When rendering navigation and clicking hamburger
    renderWithProviders(<Navigation />)

    await waitFor(() => {
      const menuButton = screen.getByRole('button', { name: /toggle menu/i })
      expect(menuButton).toBeInTheDocument()
    })

    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    // Should show mobile navigation
    await waitFor(() => {
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('mobile-open')
    })
  })

  test('given current page is active, should highlight current navigation item', async () => {
    // Mock current location as /devices
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/devices',
        origin: 'http://localhost:3000',
        pathname: '/devices',
        search: '',
        hash: '',
      },
      writable: true,
      configurable: true,
    })

    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should highlight active page
    await waitFor(() => {
      const devicesLink = screen.getByRole('link', { name: 'Devices' })
      expect(devicesLink).toHaveClass('active')
    })
  })

  test('given brand logo, should link to dashboard', async () => {
    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should have brand link to dashboard
    await waitFor(() => {
      const brandLink = screen.getByRole('link', { name: /samsung minisplit coordinator/i })
      expect(brandLink).toHaveAttribute('href', '/')
    })
  })

  test('given loading state, should show navigation skeleton', () => {
    // Given auth API is loading
    mockAuthApi.getStatus.mockReturnValue(new Promise(() => {}))

    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should show loading state
    expect(screen.getByTestId('navigation-loading')).toBeInTheDocument()
  })

  test('given authentication error, should handle gracefully', async () => {
    // Given auth API error
    mockAuthApi.getStatus.mockRejectedValue(new Error('Network error'))

    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should render without navigation (treat as unauthenticated)
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
    })
  })

  test('given responsive design, should adapt to different screen sizes', async () => {
    // Mock desktop viewport
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
      configurable: true,
    })

    // Trigger resize event to update component state
    window.dispatchEvent(new Event('resize'))

    // When rendering navigation component
    renderWithProviders(<Navigation />)

    // Should not show mobile menu button on desktop
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /toggle menu/i })).not.toBeInTheDocument()
    })

    // Should show desktop navigation
    await waitFor(() => {
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('desktop')
    })
  })
})