import React, { useState } from 'react';
import { authApi } from '../api/auth';
import './Login.css';

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authUrl = await authApi.getAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Login failed:', err);
      setError('Failed to initiate login. Please try again.');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Samsung SmartThings Authentication</h1>
          <div className="loading-state">
            <p>Redirecting to SmartThings...</p>
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Samsung SmartThings Authentication</h1>
        
        <div className="login-info">
          <p>
            This application needs to connect to your Samsung SmartThings account 
            to control your mini-split air conditioning units.
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button 
          className="login-button"
          onClick={handleLogin}
          disabled={isLoading}
        >
          Login with SmartThings
        </button>

        <div className="permissions-info">
          <h3>Required Permissions</h3>
          <ul>
            <li><strong>Device Control:</strong> Turn devices on/off and adjust settings</li>
            <li><strong>Device Status:</strong> Monitor temperature and operating status</li>
            <li><strong>Location Access:</strong> Access devices in your home</li>
          </ul>
        </div>

        <div className="security-note">
          <p>
            <small>
              Your credentials are securely handled by Samsung SmartThings. 
              We only store the access token needed to control your devices.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;