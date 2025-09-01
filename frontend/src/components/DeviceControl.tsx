import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import devicesApi from '../api/devices';
import './DeviceControl.css';

export function DeviceControl() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [tempSlider, setTempSlider] = useState(72);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [customCommand, setCustomCommand] = useState({
    capability: 'switch',
    command: 'on',
    args: '',
  });

  // Fetch device status
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['deviceStatus', deviceId],
    queryFn: () => devicesApi.getDeviceStatus(deviceId!),
    enabled: !!deviceId,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch device info
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  });

  const device = devices?.find(d => d.deviceId === deviceId);

  // Power control mutation
  const powerMutation = useMutation({
    mutationFn: (state: 'on' | 'off') => devicesApi.setPower(deviceId!, state),
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 1000);
    },
  });

  // Mode control mutation
  const modeMutation = useMutation({
    mutationFn: (mode: string) => devicesApi.setMode(deviceId!, mode),
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 1000);
    },
  });

  // Temperature control mutation
  const temperatureMutation = useMutation({
    mutationFn: (temperature: number) => devicesApi.setTemperature(deviceId!, temperature),
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 1000);
    },
  });

  // Custom command mutation
  const commandMutation = useMutation({
    mutationFn: ({ capability, command, args }: any) =>
      devicesApi.executeCommand(deviceId!, capability, command, args),
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 1000);
    },
  });

  // Update temperature slider when status changes
  useEffect(() => {
    if (status?.components?.main) {
      const main = status.components.main;
      const targetTemp = 
        main.thermostatCoolingSetpoint?.coolingSetpoint?.value ||
        main.thermostatHeatingSetpoint?.heatingSetpoint?.value;
      if (targetTemp) {
        setTempSlider(Math.round(targetTemp));
      }
    }
  }, [status]);

  if (!device) {
    return <div className="loading">Loading device...</div>;
  }

  const main = status?.components?.main;
  const currentTemp = main?.temperatureMeasurement?.temperature?.value;
  const currentTempUnit = main?.temperatureMeasurement?.temperature?.unit || 'F';
  const powerState = main?.switch?.switch?.value;
  const acMode = main?.airConditionerMode?.airConditionerMode?.value;
  const thermostatMode = main?.thermostat?.thermostatMode?.value;
  const currentMode = acMode || thermostatMode;

  const handlePowerToggle = () => {
    const newState = powerState === 'on' ? 'off' : 'on';
    powerMutation.mutate(newState);
  };

  const handleModeChange = (mode: string) => {
    modeMutation.mutate(mode);
  };

  const handleTemperatureChange = () => {
    temperatureMutation.mutate(tempSlider);
  };

  const handleCustomCommand = () => {
    let args = [];
    if (customCommand.args.trim()) {
      try {
        args = JSON.parse(customCommand.args);
        if (!Array.isArray(args)) {
          alert('Arguments must be a JSON array');
          return;
        }
      } catch (e) {
        alert('Invalid JSON in arguments');
        return;
      }
    }
    commandMutation.mutate({
      capability: customCommand.capability,
      command: customCommand.command,
      args,
    });
  };

  return (
    <div className="device-control">
      <Link to="/devices" className="back-button">
        ← Back to Devices
      </Link>

      <div className="device-header">
        <h1>{device.label || device.name}</h1>
        <p>Device ID: {device.deviceId}</p>
      </div>

      <div className="auto-refresh">
        <label>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (5s)
        </label>
        <button onClick={() => refetchStatus()} className="refresh-btn">
          🔄 Refresh Now
        </button>
      </div>

      <div className={`status-card ${powerState === 'on' ? 'online' : 'offline'}`}>
        <h3>📊 Current Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-value">
              {currentTemp ? `${currentTemp}°${currentTempUnit}` : '--°F'}
            </span>
            <span className="status-label">Current Temperature</span>
          </div>
          <div className="status-item">
            <span className="status-value">{tempSlider}°F</span>
            <span className="status-label">Target Temperature</span>
          </div>
          <div className="status-item">
            <span className="status-value">
              {currentMode ? currentMode.toUpperCase() : '--'}
            </span>
            <span className="status-label">Current Mode</span>
          </div>
          <div className="status-item">
            <span className="status-value">
              {powerState ? powerState.toUpperCase() : '--'}
            </span>
            <span className="status-label">Power State</span>
          </div>
        </div>
      </div>

      <div className="control-section">
        <h3>🔌 Power Control</h3>
        <div className="power-control">
          <span className={`power-status ${powerState}`}>
            Power: {powerState ? powerState.toUpperCase() : 'UNKNOWN'}
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={powerState === 'on'}
              onChange={handlePowerToggle}
              disabled={powerMutation.isPending}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="control-section">
        <h3>🌡️ Mode Control</h3>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${currentMode === 'off' ? 'active' : ''}`}
            onClick={() => handleModeChange('off')}
            disabled={modeMutation.isPending}
          >
            🔴 Off
          </button>
          <button
            className={`mode-btn ${currentMode === 'heat' ? 'active' : ''}`}
            onClick={() => handleModeChange('heat')}
            disabled={modeMutation.isPending}
          >
            🔥 Heat
          </button>
          <button
            className={`mode-btn ${currentMode === 'cool' ? 'active' : ''}`}
            onClick={() => handleModeChange('cool')}
            disabled={modeMutation.isPending}
          >
            ❄️ Cool
          </button>
        </div>
      </div>

      <div className="control-section">
        <h3>🌡️ Temperature Control</h3>
        <div className="temperature-control">
          <div className="temp-display">{tempSlider}°F</div>
          <input
            type="range"
            min="40"
            max="90"
            value={tempSlider}
            onChange={(e) => setTempSlider(Number(e.target.value))}
            onMouseUp={handleTemperatureChange}
            onTouchEnd={handleTemperatureChange}
            className="temp-slider"
            disabled={temperatureMutation.isPending}
          />
          <div className="temp-range">
            <span>40°F</span>
            <span>90°F</span>
          </div>
          <div className="temp-presets">
            {[60, 65, 70, 75, 80].map(temp => (
              <button
                key={temp}
                onClick={() => {
                  setTempSlider(temp);
                  temperatureMutation.mutate(temp);
                }}
                className="preset-btn"
                disabled={temperatureMutation.isPending}
              >
                {temp}°
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="control-section">
        <h3>⚡ Custom Command</h3>
        <div className="custom-command">
          <div className="command-inputs">
            <input
              type="text"
              placeholder="Capability"
              value={customCommand.capability}
              onChange={(e) => setCustomCommand({ ...customCommand, capability: e.target.value })}
            />
            <input
              type="text"
              placeholder="Command"
              value={customCommand.command}
              onChange={(e) => setCustomCommand({ ...customCommand, command: e.target.value })}
            />
          </div>
          <input
            type="text"
            placeholder="Arguments (JSON array)"
            value={customCommand.args}
            onChange={(e) => setCustomCommand({ ...customCommand, args: e.target.value })}
            className="args-input"
          />
          <button
            onClick={handleCustomCommand}
            className="execute-btn"
            disabled={commandMutation.isPending}
          >
            Execute Command
          </button>
        </div>
      </div>

      <div className="capabilities">
        <h4>📋 Device Capabilities</h4>
        <div className="capability-tags">
          {device.capabilities.map(cap => (
            <span key={cap.id} className="capability-tag">
              {cap.id}
            </span>
          ))}
        </div>
      </div>

      {(powerMutation.isPending || modeMutation.isPending || 
        temperatureMutation.isPending || commandMutation.isPending) && (
        <div className="status-message loading">
          Executing command...
        </div>
      )}

      {(powerMutation.isError || modeMutation.isError || 
        temperatureMutation.isError || commandMutation.isError) && (
        <div className="status-message error">
          Error executing command
        </div>
      )}

      {(powerMutation.isSuccess || modeMutation.isSuccess || 
        temperatureMutation.isSuccess || commandMutation.isSuccess) && (
        <div className="status-message success">
          Command executed successfully
        </div>
      )}
    </div>
  );
}