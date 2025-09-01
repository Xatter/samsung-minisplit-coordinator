import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { coordinatorApi, CoordinatorStatus } from '../api/coordinator'
import { matterApi, MatterCommissioningInfo } from '../api/matter'
import { authApi, AuthStatus } from '../api/auth'
import { devicesApi, Device } from '../api/devices'
import './Dashboard.css'

const Dashboard: React.FC = () => {
  // Fetch all dashboard data
  const { 
    data: coordinatorStatus, 
    isLoading: isCoordinatorLoading, 
    error: coordinatorError 
  } = useQuery<CoordinatorStatus>({
    queryKey: ['coordinator', 'status'],
    queryFn: () => coordinatorApi.getStatus(),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { 
    data: matterStatus, 
    isLoading: isMatterLoading, 
    error: matterError 
  } = useQuery<MatterCommissioningInfo>({
    queryKey: ['matter', 'status'],
    queryFn: () => matterApi.getStatus(),
    refetchInterval: 60000, // Refetch every minute
  })

  const { 
    data: authStatus, 
    isLoading: isAuthLoading, 
    error: authError 
  } = useQuery<AuthStatus>({
    queryKey: ['auth', 'status'],
    queryFn: () => authApi.getStatus(),
    refetchInterval: 300000, // Refetch every 5 minutes
  })

  const { 
    data: devices, 
    isLoading: isDevicesLoading, 
    error: devicesError 
  } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getDevices(),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const isLoading = isCoordinatorLoading || isMatterLoading || isAuthLoading || isDevicesLoading
  const hasError = coordinatorError || matterError || authError || devicesError

  // Loading state
  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <h1>Loading Dashboard...</h1>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  // Error state
  if (hasError) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <h1>Failed to load dashboard information</h1>
          <p>Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  // Calculate device statistics
  const deviceCount = devices?.length || 0
  const onlineDevices = devices?.filter(device => device.isOnline).length || 0
  const offlineDevices = deviceCount - onlineDevices

  // Format temperature display
  const formatTemperature = (temp: number | undefined) => 
    temp !== undefined ? `${temp}°F` : 'N/A'

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>System Dashboard</h1>
        <p>Overview of your smart home system</p>
      </div>

      <div className="dashboard-content">
        {/* System Status Overview */}
        <div className="overview-grid">
          {/* Coordinator Status Card */}
          <div className="status-card coordinator-card">
            <div className="card-header">
              <h3>Coordinator Status</h3>
              <div className={`status-indicator ${coordinatorStatus?.isRunning ? 'status-running' : 'status-stopped'}`}></div>
            </div>
            <div className="card-content">
              <div className="status-item">
                <strong>{coordinatorStatus?.isRunning ? 'System Running' : 'System Stopped'}</strong>
              </div>
              <div className="status-item">
                {coordinatorStatus?.onlineUnits} of {coordinatorStatus?.totalUnits} units online
              </div>
              {coordinatorStatus && coordinatorStatus.unresolvedConflicts > 0 && (
                <div className="status-item warning">
                  <span className="status-indicator status-warning"></span>
                  {coordinatorStatus.unresolvedConflicts} unresolved conflicts - attention needed
                </div>
              )}
              <div className="status-details">
                <p>Mode: <span className={`mode-badge mode-${coordinatorStatus?.globalMode}`}>
                  {coordinatorStatus?.globalMode}
                </span></p>
                {coordinatorStatus?.globalRange && (
                  <p>Range: {formatTemperature(coordinatorStatus.globalRange.min)} - {formatTemperature(coordinatorStatus.globalRange.max)}</p>
                )}
                {coordinatorStatus?.outsideTemperature && (
                  <p>Outside: {formatTemperature(coordinatorStatus.outsideTemperature)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Matter/HomeKit Status Card */}
          <div className="status-card matter-card">
            <div className="card-header">
              <h3>Matter/HomeKit</h3>
              <div className={`status-indicator ${matterStatus?.isCommissioned ? 'status-running' : 'status-warning'}`}></div>
            </div>
            <div className="card-content">
              <div className="status-item">
                <strong>{matterStatus?.isCommissioned ? 'Connected' : 'Ready for Setup'}</strong>
              </div>
              <div className="status-details">
                {matterStatus?.isCommissioned ? (
                  <p>Connected to {matterStatus.fabricsCount} controller{matterStatus.fabricsCount !== 1 ? 's' : ''}</p>
                ) : (
                  <p>Not connected to any smart home system</p>
                )}
              </div>
            </div>
          </div>

          {/* Smart Devices Card */}
          <div className="status-card devices-card">
            <div className="card-header">
              <h3>Smart Devices</h3>
              <div className={`status-indicator ${offlineDevices === 0 ? 'status-running' : 'status-warning'}`}></div>
            </div>
            <div className="card-content">
              <div className="status-item">
                <strong>{deviceCount} devices configured</strong>
              </div>
              <div className="status-details">
                {offlineDevices === 0 ? (
                  <p>All devices online</p>
                ) : (
                  <p>{offlineDevices} device{offlineDevices !== 1 ? 's' : ''} offline</p>
                )}
              </div>
            </div>
          </div>

          {/* Weather/Temperature Card */}
          {coordinatorStatus?.outsideTemperature && (
            <div className="status-card weather-card">
              <div className="card-header">
                <h3>Current Conditions</h3>
                <div className={`status-indicator ${coordinatorStatus?.weatherCacheValid ? 'status-running' : 'status-warning'}`}></div>
              </div>
              <div className="card-content">
                <div className="temperature-display">
                  {formatTemperature(coordinatorStatus.outsideTemperature)}
                  <span className="temperature-label">outside</span>
                </div>
                <div className="status-details">
                  {coordinatorStatus.globalRange && (
                    <p>Target range: {formatTemperature(coordinatorStatus.globalRange.min)} - {formatTemperature(coordinatorStatus.globalRange.max)}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Navigation */}
        <div className="navigation-grid">
          <a href="/devices" className="nav-tile devices-tile">
            <div className="tile-icon">🏠</div>
            <div className="tile-content">
              <h4>Manage Devices</h4>
              <p>Control individual thermostats and view device status</p>
            </div>
          </a>

          <a href="/coordinator" className="nav-tile coordinator-tile">
            <div className="tile-icon">⚙️</div>
            <div className="tile-content">
              <h4>Coordinator Settings</h4>
              <p>Configure system-wide temperature control and automation</p>
            </div>
          </a>

          <a href="/matter" className="nav-tile matter-tile">
            <div className="tile-icon">🔗</div>
            <div className="tile-content">
              <h4>Matter Setup</h4>
              <p>Connect to HomeKit, Google Home, and other smart home systems</p>
            </div>
          </a>
        </div>

        {/* Recent Activity / System Health */}
        <div className="activity-section">
          <h3>System Health</h3>
          <div className="health-indicators">
            <div className="health-item">
              <span className={`status-indicator ${coordinatorStatus?.isRunning ? 'status-running' : 'status-stopped'}`}></span>
              <span>Coordinator: {coordinatorStatus?.isRunning ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="health-item">
              <span className={`status-indicator ${coordinatorStatus?.weatherCacheValid ? 'status-running' : 'status-warning'}`}></span>
              <span>Weather Data: {coordinatorStatus?.weatherCacheValid ? 'Current' : 'Stale'}</span>
            </div>
            <div className="health-item">
              <span className={`status-indicator ${offlineDevices === 0 ? 'status-running' : 'status-warning'}`}></span>
              <span>Device Connectivity: {offlineDevices === 0 ? 'All Online' : `${offlineDevices} Offline`}</span>
            </div>
            <div className="health-item">
              <span className={`status-indicator ${coordinatorStatus && coordinatorStatus.unresolvedConflicts === 0 ? 'status-running' : 'status-warning'}`}></span>
              <span>System Conflicts: {coordinatorStatus && coordinatorStatus.unresolvedConflicts === 0 ? 'None' : `${coordinatorStatus?.unresolvedConflicts || 0} Active`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard