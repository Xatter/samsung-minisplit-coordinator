# SmartThings Matter Server Setup Guide

This guide covers setting up a Matter server with SmartThings integration, including OAuth authentication and device bridging.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **SmartThings CLI** - Install with: `npm install -g @smartthings/cli`
3. **SmartThings Developer Account** - Create at [SmartThings Developers](https://smartthings.developer.samsung.com/)
4. **Custom domain with HTTPS** (required for OAuth redirect URI)

## SmartThings App Setup (Using CLI - Recommended)

### 1. Login to SmartThings CLI
```bash
smartthings login
```

### 2. Create API-Only App
Create a new API-only app (NOT webhook type) for OAuth integration:

```bash
smartthings apps:create
```

When prompted, select:
- **App Type**: `API_ONLY` (crucial - webhook apps don't support OAuth)
- **Display Name**: Your app name (e.g., "Matter Bridge")
- **Description**: Brief description of your app

### 3. Configure OAuth Settings
After creating the app, configure OAuth with your redirect URI:

```bash
smartthings apps:oauth:update [APP_ID]
```

Set these OAuth settings:
- **Client Name**: Your client name
- **Redirect URIs**: `https://yourdomain.com/auth/callback` (must be HTTPS)
- **Scope**: `r:devices:* x:devices:* r:locations:*`

### 4. Generate OAuth Credentials
Generate client credentials:

```bash
smartthings apps:oauth:generate [APP_ID]
```

Save the generated `client_id` and `client_secret` - you'll need them in your `.env` file.

## Project Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd MatterServer
npm install
```

### 2. Configure Environment Variables
Create `.env` file in project root:

```env
# SmartThings Configuration (from CLI setup above)
SMARTTHINGS_APP_ID=your-app-id-here
SMARTTHINGS_CLIENT_ID=your-client-id-here
SMARTTHINGS_CLIENT_SECRET=your-client-secret-here

# Server Configuration
SERVER_URL=http://localhost:3000
ADMIN_PORT=3000
MATTER_PORT=5540

# Session Configuration
SESSION_SECRET=generate-a-secure-random-string

# OAuth Redirect (must match SmartThings app configuration)
CALLBACK_URL=https://yourdomain.com/auth/callback
```

**Important**: The `CALLBACK_URL` must:
- Use HTTPS (not HTTP)
- Match exactly what you configured in the SmartThings app
- Be accessible from the internet (SmartThings needs to redirect to it)

### 3. Build and Start
```bash
npm run build
npm run dev
```

## OAuth Flow Testing

1. Navigate to `http://localhost:3000`
2. Click "Authenticate with SmartThings" 
3. Complete OAuth flow on SmartThings side
4. You should be redirected back to the admin panel

## Common Issues and Solutions

### Issue: "redirect_uri could not be validated"
**Cause**: Redirect URI not properly configured in SmartThings app
**Solution**: Use CLI to update OAuth settings:
```bash
smartthings apps:oauth:update [APP_ID]
```

### Issue: "invalid_request" error during OAuth
**Cause**: Using WEBHOOK_SMART_APP type instead of API_ONLY
**Solution**: Create new app with API_ONLY type using CLI

### Issue: Views not found error
**Cause**: Views directory in wrong location
**Solution**: Ensure `views/` directory is in project root, not `src/views/`

### Issue: OAuth using localhost instead of custom domain
**Cause**: Stale server process with old environment variables
**Solution**: Kill all node processes and restart:
```bash
pkill -f node
npm run dev
```

### Issue: 401 Unauthorized during token exchange
**Cause**: Usually incorrect client credentials or app configuration
**Solution**: 
1. Verify credentials in `.env` match SmartThings app
2. Ensure app type is API_ONLY
3. Check OAuth configuration with: `smartthings apps:oauth [APP_ID]`

## SmartThings CLI Commands Reference

### App Management
```bash
# List all apps
smartthings apps

# Get app details
smartthings apps [APP_ID]

# Update app settings
smartthings apps:update [APP_ID]

# Delete app
smartthings apps:delete [APP_ID]
```

### OAuth Management
```bash
# View OAuth configuration
smartthings apps:oauth [APP_ID]

# Update OAuth settings
smartthings apps:oauth:update [APP_ID]

# Generate new client credentials
smartthings apps:oauth:generate [APP_ID]
```

## Architecture Overview

The server consists of several key components:

1. **Matter Server** (`src/server.ts`) - Main entry point, creates Matter node with thermostat devices
2. **SmartThings OAuth** (`src/smartthings/oauth.ts`) - Handles OAuth authentication flow
3. **Device Manager** (`src/smartthings/device-manager.ts`) - Manages SmartThings device operations
4. **Admin Web Server** (`src/web/app.ts`) - Express server for OAuth and device management UI
5. **Matter Bridge** - Bridges SmartThings devices to Matter protocol (planned)

## Development Workflow

1. Make code changes
2. Build: `npm run build`
3. Test locally: `npm run dev`
4. For production: `npm start`

## Security Notes

- Never commit `.env` file to version control
- Use HTTPS for all OAuth redirect URIs
- Generate strong session secrets
- Regularly rotate OAuth credentials
- Test OAuth flow thoroughly before production deployment

## Troubleshooting

If you encounter issues:

1. Check server logs in `server.log`
2. Verify environment variables are loaded correctly
3. Use SmartThings CLI to inspect app configuration
4. Ensure all dependencies are installed
5. Confirm ports 3000 and 5540 are available

For OAuth-specific issues, the SmartThings CLI is your best tool for debugging app configuration problems.