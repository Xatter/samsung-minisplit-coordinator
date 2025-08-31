# Matter SmartThings Bridge

A TypeScript-based server that bridges SmartThings devices with the Matter protocol, allowing SmartThings thermostats and switches to be controlled through Matter-compatible systems.

## Features

- **Matter Protocol Server**: Exposes thermostat devices through Matter protocol on port 5540
- **SmartThings Integration**: Connect and control SmartThings devices via OAuth
- **Admin Web Interface**: Manage device mappings and authentication on port 3000
- **Real-time Synchronization**: Bidirectional sync between Matter and SmartThings
- **Device Bridging**: Map SmartThings thermostats to Matter endpoints
- **Responsive Dashboard**: View and control devices through web interface

## Quick Start

### Prerequisites

- Node.js 20+ (Note: SmartThings Core SDK requires Node 22+, but project runs on 20+ with warnings)
- SmartThings Developer Account
- SmartThings compatible devices (thermostats, switches)

### 1. Installation

```bash
npm install
```

### 2. SmartThings App Setup

1. Create a SmartThings Developer account at https://smartthings.developer.samsung.com
2. Create a new SmartApp:
   ```bash
   # Install SmartThings CLI if not already installed
   npm install -g @smartthings/cli
   
   # Login to SmartThings
   smartthings login
   
   # Create new app
   smartthings apps:create
   ```
3. Configure your app with:
   - **App Type**: Webhook SmartApp
   - **Webhook URL**: `http://your-domain.com:3000/smartapp` (use ngrok for local dev)
   - **Redirect URI**: `http://your-domain.com:3000/auth/callback`
   - **Scopes**: `r:devices:*`, `x:devices:*`, `r:locations:*`

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your SmartThings credentials:

```env
# SmartThings Configuration (from apps:create command)
SMARTTHINGS_APP_ID=your-app-id-here
SMARTTHINGS_CLIENT_ID=your-client-id-here
SMARTTHINGS_CLIENT_SECRET=your-client-secret-here

# Server Configuration
SERVER_URL=http://localhost:3000
ADMIN_PORT=3000
MATTER_PORT=5540

# Session Configuration
SESSION_SECRET=your-secure-session-secret-here

# Development URLs (use ngrok for external access)
CALLBACK_URL=http://localhost:3000/auth/callback
```

### 4. Run the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 5. Access Admin Interface

1. Open http://localhost:3000
2. Click "Login with SmartThings"
3. Authorize the application
4. View and manage your devices

## Project Structure

```
src/
├── config.ts                 # Environment configuration
├── server.ts                 # Main server entry point
├── smartthings/
│   ├── oauth.ts              # OAuth authentication flow
│   ├── device-manager.ts     # SmartThings device operations
│   ├── smartapp.ts           # SmartApp configuration
│   └── matter-bridge.ts      # Matter ↔ SmartThings bridge
├── web/
│   ├── app.ts                # Express server setup
│   └── routes/
│       ├── auth.ts           # Authentication routes
│       └── admin.ts          # Device management routes
└── views/
    ├── layout.ejs            # Base layout template
    ├── login.ejs             # OAuth login page
    ├── devices.ejs           # Device management page
    └── error.ejs             # Error page template
```

## API Endpoints

### Authentication
- `GET /auth/login` - SmartThings OAuth login
- `GET /auth/callback` - OAuth callback handler
- `POST /auth/logout` - Logout and clear session

### Device Management
- `GET /admin/devices` - List all SmartThings devices
- `GET /admin/device/:id/status` - Get device status
- `POST /admin/device/:id/command` - Execute device command
- `POST /admin/thermostat/:id/temperature` - Set thermostat temperature
- `POST /admin/thermostat/:id/mode` - Set thermostat mode
- `POST /admin/switch/:id/toggle` - Toggle switch state

### SmartApp Webhook
- `POST /smartapp` - SmartThings webhook endpoint

## Development

### Local Development with ngrok

For SmartThings webhooks to work locally, expose your server using ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Update your .env with the ngrok URL
SERVER_URL=https://your-ngrok-url.ngrok.io
CALLBACK_URL=https://your-ngrok-url.ngrok.io/auth/callback
```

### Testing

```bash
# Test Matter server only (without SmartThings)
npm run dev

# The server will run in Matter-only mode if SmartThings config is missing
```

### Building

```bash
npm run build
```

## Matter Integration

The server exposes two Matter thermostat devices:
- **Left Thermostat** (ID: `left-thermostat`)
- **Right Thermostat** (ID: `right-thermostat`)

These can be commissioned with any Matter-compatible controller (Apple Home, Google Nest, Amazon Alexa, etc.).

### Device Mapping

Use the admin interface to map SmartThings devices to Matter endpoints:
1. Authenticate with SmartThings
2. View available thermostats and switches
3. Configure device mappings through the web interface
4. Changes sync in real-time between protocols

## Troubleshooting

### Common Issues

1. **Authentication Fails**
   - Verify SmartThings app configuration
   - Check redirect URI matches exactly
   - Ensure callback URL is publicly accessible

2. **No Devices Found**
   - Verify SmartThings account has compatible devices
   - Check device capabilities (thermostat, switch)
   - Ensure proper scopes are configured

3. **Matter Commissioning Issues**
   - Check Matter server is running on port 5540
   - Verify network connectivity
   - Review Matter controller compatibility

4. **Node Version Warnings**
   - SmartThings Core SDK prefers Node 22+
   - Project works with Node 20+ but shows warnings
   - Consider upgrading Node for optimal experience

### Debug Logs

Enable debug logging by setting environment variables:

```bash
DEBUG=smartthings:* npm run dev
```

## Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   ```

2. **HTTPS Configuration**
   - Configure reverse proxy (nginx, Apache)
   - Enable SSL/TLS certificates
   - Update callback URLs to use HTTPS

3. **Session Security**
   - Use strong session secrets
   - Configure secure cookies
   - Enable HTTPS-only sessions

4. **Process Management**
   ```bash
   # Using PM2
   pm2 start dist/server.js --name matter-bridge
   
   # Using systemd
   sudo systemctl enable matter-bridge
   sudo systemctl start matter-bridge
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following TypeScript best practices
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review SmartThings Developer Documentation
3. Open an issue on GitHub