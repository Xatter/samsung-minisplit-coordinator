import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import devicesApi from '../api/devices';
import type { Device } from '../api/devices';
import './DeviceList.css';

export function DeviceList() {
  const { data: devices, isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  });

  if (isLoading) {
    return <div className="loading">Loading devices...</div>;
  }

  if (error) {
    return <div className="error">Error loading devices</div>;
  }

  return (
    <div className="device-list">
      <h1>SmartThings Devices</h1>
      <div className="devices-grid">
        {devices?.map((device: Device) => (
          <Link
            key={device.deviceId}
            to={`/device/${device.deviceId}`}
            className="device-card"
          >
            <div className="device-name">{device.label || device.name}</div>
            <div className="device-id">ID: {device.deviceId}</div>
            <div className="device-capabilities">
              {device.capabilities.length} capabilities
            </div>
            <div className="device-action">
              Click to control →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}