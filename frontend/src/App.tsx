import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useQuery } from '@tanstack/react-query'
import { authApi, AuthStatus } from './api/auth'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import Coordinator from './components/Coordinator'
import MatterSetup from './components/MatterSetup'
import { DeviceList } from './components/DeviceList'
import { DeviceControl } from './components/DeviceControl'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    data: authStatus, 
    isLoading: isAuthLoading, 
    error: authError 
  } = useQuery<AuthStatus>({
    queryKey: ['auth', 'status'],
    queryFn: () => authApi.getStatus(),
    retry: false,
  })

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="app-loading" data-testid="app-loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  // Not authenticated or auth error - redirect to login
  if (!authStatus?.isAuthenticated || authError) {
    return <Navigate to="/login" replace />
  }

  // Authenticated - show content with navigation
  return (
    <div className="app-layout">
      <Navigation />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

// Public Route Component (for login)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    data: authStatus, 
    isLoading: isAuthLoading, 
    error: authError 
  } = useQuery<AuthStatus>({
    queryKey: ['auth', 'status'],
    queryFn: () => authApi.getStatus(),
    retry: false,
  })

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="app-loading" data-testid="app-loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  // Already authenticated - redirect to dashboard
  if (authStatus?.isAuthenticated && !authError) {
    return <Navigate to="/" replace />
  }

  // Not authenticated - show login
  return <div className="public-layout">{children}</div>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="app">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            
            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/devices" element={
              <ProtectedRoute>
                <DeviceList />
              </ProtectedRoute>
            } />
            <Route path="/device/:deviceId" element={
              <ProtectedRoute>
                <DeviceControl />
              </ProtectedRoute>
            } />
            <Route path="/coordinator" element={
              <ProtectedRoute>
                <Coordinator />
              </ProtectedRoute>
            } />
            <Route path="/matter" element={
              <ProtectedRoute>
                <MatterSetup />
              </ProtectedRoute>
            } />
            
            {/* Catch all route - redirect based on auth status */}
            <Route path="*" element={
              <ProtectedRoute>
                <Navigate to="/" replace />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
