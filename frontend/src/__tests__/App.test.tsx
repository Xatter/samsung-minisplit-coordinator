import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'
import { authApi } from '../api/auth'

// Mock all the APIs and components
vi.mock('../api/auth')
vi.mock('../components/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard Component</div>
}))
vi.mock('../components/Login', () => ({
  default: () => <div data-testid="login">Login Component</div>
}))
vi.mock('../components/Coordinator', () => ({
  default: () => <div data-testid="coordinator">Coordinator Component</div>
}))
vi.mock('../components/MatterSetup', () => ({
  default: () => <div data-testid="matter-setup">MatterSetup Component</div>
}))
vi.mock('../components/DeviceList', () => ({
  DeviceList: () => <div data-testid="device-list">DeviceList Component</div>
}))
vi.mock('../components/DeviceControl', () => ({
  DeviceControl: () => <div data-testid="device-control">DeviceControl Component</div>
}))
// Don't mock Navigation - let it use the actual auth check
// vi.mock('../components/Navigation', () => ({
//   default: () => <nav data-testid="navigation">Navigation Component</nav>
// }))

const mockAuthApi = vi.mocked(authApi)

describe('App Component', () => {
  const mockAuthenticatedStatus = {
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
    mockAuthApi.getStatus.mockResolvedValue(mockAuthenticatedStatus)
  })

  test('given user is authenticated, should display dashboard', async () => {
    // When rendering app
    render(<App />)

    // Should display dashboard
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })

  test('given app renders, should include ReactQuery and Router providers', () => {
    // When rendering app
    const { container } = render(<App />)

    // Should render without errors (providers working)
    expect(container.querySelector('.app')).toBeInTheDocument()
  })

  test('given app structure, should have proper DOM structure', async () => {
    // When rendering app
    render(<App />)

    // Should have expected structure
    await waitFor(() => {
      // Should have main app container
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })
})