import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { matterApi, MatterCommissioningInfo, MatterCommissioningStatus } from '../api/matter'
import './MatterSetup.css'

const MatterSetup: React.FC = () => {
  const queryClient = useQueryClient()

  // Fetch Matter status
  const { 
    data: matterStatus, 
    isLoading: isStatusLoading, 
    error: statusError 
  } = useQuery<MatterCommissioningInfo>({
    queryKey: ['matter', 'status'],
    queryFn: () => matterApi.getStatus(),
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  // Fetch detailed commissioning status
  const { 
    data: commissioningStatus, 
    isLoading: isCommissioningLoading, 
    error: commissioningError 
  } = useQuery<MatterCommissioningStatus>({
    queryKey: ['matter', 'commissioning-status'],
    queryFn: () => matterApi.getCommissioningStatus(),
    enabled: matterStatus?.isCommissioned === true,
    refetchInterval: 30000, // Refetch every 30 seconds when commissioned
  })

  // Reset commissioning mutation
  const resetMutation = useMutation({
    mutationFn: () => matterApi.resetCommissioning(),
    onSuccess: () => {
      // Refetch status after successful reset
      queryClient.invalidateQueries({ queryKey: ['matter'] })
    },
  })

  const handleReset = () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the Matter setup? This will remove the device from all connected smart home systems and require re-commissioning.'
    )
    
    if (confirmed) {
      resetMutation.mutate()
    }
  }

  const formatLastConnected = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  // Loading state
  if (isStatusLoading || isCommissioningLoading) {
    return (
      <div className="matter-setup-container">
        <div className="loading-state">
          <h1>Loading Matter Setup...</h1>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  // Error state
  if (statusError || commissioningError) {
    return (
      <div className="matter-setup-container">
        <div className="error-state">
          <h1>Failed to load Matter setup information</h1>
          <p>Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const isCommissioned = matterStatus?.isCommissioned || false

  return (
    <div className="matter-setup-container">
      <div className="matter-setup-header">
        <h1>Matter/HomeKit Setup</h1>
        <p>Add this device to your smart home ecosystem</p>
      </div>

      <div className="setup-content">
        {/* Status Card */}
        <div className="status-card">
          <h3>Connection Status</h3>
          <div className="status-item">
            <span className={`status-indicator ${isCommissioned ? 'status-running' : 'status-warning'}`}></span>
            <span>
              {isCommissioned ? 'Device is Connected' : 'Ready for Commissioning'}
            </span>
          </div>
          <div className="status-description">
            {isCommissioned 
              ? `Connected to ${matterStatus?.fabricsCount || 0} smart home controller${(matterStatus?.fabricsCount || 0) !== 1 ? 's' : ''}`
              : 'Not yet added to any smart home system'
            }
          </div>
          
          {isCommissioned && commissioningStatus && (
            <div className="commissioned-details">
              <h4>Connected Controllers</h4>
              <div className="controllers-list">
                {commissioningStatus.connectedControllers.map((controller, index) => (
                  <span key={index} className="controller-badge">{controller}</span>
                ))}
              </div>
              <div className="connection-info">
                <p><strong>Last connected:</strong> {formatLastConnected(commissioningStatus.lastCommissionedTime)}</p>
                <p><strong>Network status:</strong> {commissioningStatus.networkStatus}</p>
              </div>
            </div>
          )}
        </div>

        {/* Commissioning Codes */}
        {!isCommissioned && matterStatus && (
          <div className="commissioning-card">
            <h3>QR Code for Quick Setup</h3>
            <div className="qr-code-section">
              <div className="qr-code-display">
                <code>{matterStatus.qrCode}</code>
              </div>
              <p>Scan this QR code with your smart home app</p>
            </div>

            <div className="manual-code-section">
              <h4>Manual Pairing Code</h4>
              <div className="manual-code-display">
                <code>{matterStatus.manualPairingCode}</code>
              </div>
              <p>Enter this code manually if QR scanning doesn't work</p>
            </div>

            <div className="device-info">
              <h4>Device Information</h4>
              <div className="device-details">
                <p><strong>Discriminator:</strong> {matterStatus.discriminator}</p>
                <p><strong>Vendor ID:</strong> {matterStatus.vendorId}</p>
                <p><strong>Product ID:</strong> {matterStatus.productId}</p>
              </div>
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        <div className="instructions-card">
          <h3>Setup Instructions</h3>
          <div className="setup-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Open Your Smart Home App</h4>
                <p>Open Apple HomeKit, Google Home, SmartThings, or any Matter-compatible app</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Add New Device</h4>
                <p>Look for "Add Device", "Add Accessory", or "+" button in your smart home app</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Scan or Enter Code</h4>
                <p>Either scan the QR code above or manually enter the pairing code</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h4>Complete Setup</h4>
                <p>Follow the prompts in your smart home app to complete the setup process</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reset Section - Only show if commissioned */}
        {isCommissioned && (
          <div className="reset-card">
            <h3>Reset Matter Setup</h3>
            <p>Remove this device from all connected smart home systems</p>
            <button 
              className="btn btn-emergency"
              onClick={handleReset}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? 'Resetting...' : 'Reset Matter Setup'}
            </button>
            {resetMutation.isError && (
              <div className="error-message">
                Failed to reset Matter setup. Please try again.
              </div>
            )}
            {resetMutation.isSuccess && (
              <div className="success-message">
                Matter setup has been reset successfully. The device is now ready for commissioning again.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MatterSetup