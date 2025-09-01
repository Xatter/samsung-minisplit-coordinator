import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { coordinatorApi, CoordinatorStatus } from '../api/coordinator';
import './Coordinator.css';

const Coordinator: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<'heat' | 'cool' | 'off'>('cool');
  const [minTemp, setMinTemp] = useState(68);
  const [maxTemp, setMaxTemp] = useState(75);
  const queryClient = useQueryClient();

  const { data: status, isLoading, error } = useQuery<CoordinatorStatus>({
    queryKey: ['coordinator-status'],
    queryFn: coordinatorApi.getStatus,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Update form values when status loads
  React.useEffect(() => {
    if (status) {
      setSelectedMode(status.globalMode);
      setMinTemp(status.globalRange.min);
      setMaxTemp(status.globalRange.max);
    }
  }, [status]);

  const handleModeChange = async () => {
    try {
      await coordinatorApi.setMode(selectedMode, 'manual_override');
      queryClient.invalidateQueries({ queryKey: ['coordinator-status'] });
    } catch (error) {
      console.error('Failed to set mode:', error);
      alert('Failed to update mode. Please try again.');
    }
  };

  const handleTemperatureRangeUpdate = async () => {
    if (minTemp >= maxTemp) {
      alert('Minimum temperature must be less than maximum temperature');
      return;
    }

    try {
      await coordinatorApi.setTemperatureRange(minTemp, maxTemp);
      queryClient.invalidateQueries({ queryKey: ['coordinator-status'] });
    } catch (error) {
      console.error('Failed to set temperature range:', error);
      alert('Failed to update temperature range. Please try again.');
    }
  };

  const handleEmergencyOff = async () => {
    if (!confirm('EMERGENCY OFF - This will immediately turn off ALL mini-split units. Continue?')) {
      return;
    }

    try {
      await coordinatorApi.emergencyOff('manual_emergency_stop');
      queryClient.invalidateQueries({ queryKey: ['coordinator-status'] });
      alert('Emergency off executed - all units stopped');
    } catch (error) {
      console.error('Failed to execute emergency off:', error);
      alert('Failed to execute emergency off. Please try again.');
    }
  };

  const handleRunCoordinationCycle = async () => {
    if (!confirm('Run a coordination cycle now? This will check all units and apply any needed changes.')) {
      return;
    }

    try {
      const result = await coordinatorApi.runCoordinationCycle();
      queryClient.invalidateQueries({ queryKey: ['coordinator-status'] });
      
      if (result.success) {
        alert(`Coordination cycle completed!\n\nActions taken: ${result.actions.length}\nConflicts found: ${result.conflicts.length}\nSystem mode: ${result.systemMode}\n\n${result.reasoning}`);
      } else {
        alert(`Coordination cycle failed:\n\n${result.reasoning}`);
      }
    } catch (error) {
      console.error('Failed to run coordination cycle:', error);
      alert('Failed to run coordination cycle. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="coordinator-container">
        <div className="loading-state">
          <h1>Loading coordinator status...</h1>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="coordinator-container">
        <div className="error-state">
          <h1>Failed to load coordinator status</h1>
          <p>Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="coordinator-container">
      <header className="coordinator-header">
        <h1>🌡️ Heat Pump Coordinator</h1>
        <p>Coordinating {status?.onlineUnits} of {status?.totalUnits} mini-split units</p>
      </header>

      <div className="status-grid">
        <div className="status-card">
          <h3>🔧 Coordinator Status</h3>
          <div className="status-item">
            <span className={`status-indicator ${status?.isRunning ? 'status-running' : 'status-stopped'}`}></span>
            {status?.isRunning ? 'Active' : 'Stopped'}
          </div>
          <div className="status-item">
            <strong>SmartThings Auth:</strong>
            <span className={`status-indicator ${status?.isAuthenticated ? 'status-running' : 'status-stopped'}`}></span>
            {status?.isAuthenticated ? 'Connected' : 'Not Connected'}
          </div>
          <div className="status-item">
            <strong>System Mode:</strong>
            <span className={`mode-badge mode-${status?.globalMode}`}>{status?.globalMode}</span>
          </div>
        </div>

        <div className="status-card">
          <h3>🌡️ Temperature Control</h3>
          <div className="temperature-range">
            {status?.globalRange.min}°F - {status?.globalRange.max}°F
          </div>
          <div className="status-item">
            <strong>Outside:</strong> {status?.outsideTemperature}°F
          </div>
        </div>

        <div className="status-card">
          <h3>📊 System Health</h3>
          <div className="status-item">
            <strong>Online Units:</strong> {status?.onlineUnits}/{status?.totalUnits}
          </div>
          <div className="status-item">
            <strong>Conflicts:</strong>
            <span className={`status-indicator ${status?.unresolvedConflicts && status.unresolvedConflicts > 0 ? 'status-warning' : 'status-running'}`}></span>
            {status?.unresolvedConflicts || 0}
          </div>
        </div>

        <div className="status-card">
          <h3>🌤️ Weather Service</h3>
          <div className="status-item">
            <span className={`status-indicator ${status?.weatherCacheValid ? 'status-running' : 'status-warning'}`}></span>
            {status?.weatherCacheValid ? 'Current' : 'Stale'}
          </div>
          <div className="weather-update">
            Last Updated: {status?.lastWeatherUpdate ? new Date(status.lastWeatherUpdate).toLocaleString() : 'Never'}
          </div>
        </div>
      </div>

      <div className="controls">
        <h3>🎛️ Manual Controls</h3>

        <div className="control-group">
          <label htmlFor="globalMode">Global Mode Override</label>
          <div className="control-row">
            <select
              id="globalMode"
              name="Global Mode"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as 'heat' | 'cool' | 'off')}
            >
              <option value="heat">Heat</option>
              <option value="cool">Cool</option>
              <option value="off">Off</option>
            </select>
            <button className="btn" onClick={handleModeChange}>Apply Mode</button>
          </div>
        </div>

        <div className="control-group">
          <label>Temperature Range</label>
          <div className="control-row">
            <label htmlFor="minTemp" className="sr-only">Minimum Temperature</label>
            <input
              id="minTemp"
              name="Minimum Temperature"
              type="number"
              value={minTemp}
              min="50"
              max="85"
              onChange={(e) => setMinTemp(parseInt(e.target.value))}
              placeholder="Min °F"
            />
            <span>to</span>
            <label htmlFor="maxTemp" className="sr-only">Maximum Temperature</label>
            <input
              id="maxTemp"
              name="Maximum Temperature"
              type="number"
              value={maxTemp}
              min="55"
              max="90"
              onChange={(e) => setMaxTemp(parseInt(e.target.value))}
              placeholder="Max °F"
            />
            <button className="btn" onClick={handleTemperatureRangeUpdate}>Update Range</button>
          </div>
        </div>

        <div className="control-group">
          <label>Actions</label>
          <div className="control-row">
            <button className="btn btn-success" onClick={handleRunCoordinationCycle}>
              Run Coordination Cycle
            </button>
            <button className="btn btn-emergency" onClick={handleEmergencyOff}>
              Emergency Off All Units
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Coordinator;