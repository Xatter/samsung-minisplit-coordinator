import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Login from '../Login'
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('given login component is rendered, should display SmartThings login interface', () => {
    // Given auth URL is available
    mockAuthApi.getAuthUrl.mockResolvedValue('https://auth.smartthings.com/oauth/authorize?client_id=test')

    // When rendering login component
    renderWithProviders(<Login />)

    // Should display login elements
    expect(screen.getByText(/Samsung SmartThings Authentication/i)).toBeInTheDocument()
    expect(screen.getByText(/Login with SmartThings/i)).toBeInTheDocument()
    expect(screen.getByText(/required permissions/i)).toBeInTheDocument()
  })

  test('given login button is clicked, should redirect to SmartThings OAuth', async () => {
    // Given auth URL is available
    const mockAuthUrl = 'https://auth.smartthings.com/oauth/authorize?client_id=test&scope=devices'
    mockAuthApi.getAuthUrl.mockResolvedValue(mockAuthUrl)
    
    // Mock window.location.href assignment
    delete (window as any).location
    window.location = { href: '' } as any

    // When rendering and clicking login button
    renderWithProviders(<Login />)
    
    const loginButton = screen.getByRole('button', { name: /Login with SmartThings/i })
    fireEvent.click(loginButton)

    // Should get auth URL and redirect
    await waitFor(() => {
      expect(mockAuthApi.getAuthUrl).toHaveBeenCalled()
      expect(window.location.href).toBe(mockAuthUrl)
    })
  })

  test('given auth URL loading fails, should display error message', async () => {
    // Given auth URL request fails
    mockAuthApi.getAuthUrl.mockRejectedValue(new Error('Failed to get auth URL'))

    // When rendering and clicking login button
    renderWithProviders(<Login />)
    
    const loginButton = screen.getByRole('button', { name: /Login with SmartThings/i })
    fireEvent.click(loginButton)

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to initiate login/i)).toBeInTheDocument()
    })
  })

  test('given login is in progress, should show loading state', () => {
    // Given auth URL is being loaded
    mockAuthApi.getAuthUrl.mockReturnValue(new Promise(() => {})) // Never resolves

    // When rendering and clicking login button
    renderWithProviders(<Login />)
    
    const loginButton = screen.getByRole('button', { name: /Login with SmartThings/i })
    fireEvent.click(loginButton)

    // Should show loading state
    expect(screen.getByText(/Redirecting to SmartThings/i)).toBeInTheDocument()
  })

  test('given component displays permission info, should list required permissions', () => {
    // When rendering login component
    renderWithProviders(<Login />)

    // Should display permission requirements
    expect(screen.getByText(/Device Control/i)).toBeInTheDocument()
    expect(screen.getByText(/Device Status/i)).toBeInTheDocument()
    expect(screen.getByText(/Location Access/i)).toBeInTheDocument()
  })
})