import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { authApi, AuthStatus } from '../api/auth'
import './Navigation.css'

const Navigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const location = useLocation()

  // Check screen size for responsive design
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Fetch authentication status
  const { 
    data: authStatus, 
    isLoading: isAuthLoading, 
    error: authError 
  } = useQuery<AuthStatus>({
    queryKey: ['auth', 'status'],
    queryFn: () => authApi.getStatus(),
    refetchInterval: 300000, // Refetch every 5 minutes
    retry: false, // Don't retry on auth failures
  })

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Redirect to login page
      window.location.href = '/login'
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Loading state
  if (isAuthLoading) {
    return (
      <nav className="navigation loading">
        <div data-testid="navigation-loading" className="nav-skeleton">
          <div className="skeleton-brand"></div>
          <div className="skeleton-links"></div>
        </div>
      </nav>
    )
  }

  // Don't render navigation if user is not authenticated or there's an auth error
  const isAuthenticated = authStatus?.isAuthenticated && !authError

  if (!isAuthenticated) {
    return null
  }

  const navigationClass = `navigation ${isMobile ? 'mobile' : 'desktop'} ${isMobileMenuOpen ? 'mobile-open' : ''}`

  return (
    <nav className={navigationClass} role="navigation">
      <div className="nav-container">
        {/* Brand / Logo */}
        <div className="nav-brand">
          <NavLink to="/" className="brand-link">
            Samsung Minisplit Coordinator
          </NavLink>
        </div>

        {/* Mobile Menu Button */}
        {isMobile && (
          <button
            className="mobile-menu-button"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="hamburger"></span>
            <span className="hamburger"></span>
            <span className="hamburger"></span>
          </button>
        )}

        {/* Navigation Links */}
        <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/devices"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Devices
          </NavLink>

          <NavLink
            to="/coordinator"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Coordinator
          </NavLink>

          <NavLink
            to="/matter"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Matter Setup
          </NavLink>

          {/* User Info and Logout */}
          <div className="user-section">
            <span className="username">{authStatus?.username}</span>
            <button
              className="logout-button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation