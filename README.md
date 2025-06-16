# Matter Thermostat Server

A TypeScript Matter server that exposes two thermostat controls named "Left" and "Right".

## Features

- Two independent thermostat devices (Left and Right)
- Full Matter protocol compliance
- Heating, cooling, and auto mode support
- Ready for commissioning with Matter controllers

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
# or for development with hot reload:
npm run dev
```

## Usage

The server will start on port 5540 and display commissioning information including:
- Passcode for pairing
- QR code for easy setup
- Manual pairing code

### Thermostat Endpoints

- **Left Thermostat**: Endpoint ID 1
- **Right Thermostat**: Endpoint ID 2

Both thermostats support:
- Heating and cooling modes
- Auto mode
- Temperature setpoint control
- Current temperature reading

### Commissioning

1. Use a Matter controller (like Apple Home, Google Home, or Amazon Alexa)
2. Scan the QR code displayed in the terminal
3. Follow your controller's setup process
4. The thermostats will appear as "Left Thermostat" and "Right Thermostat"

## Configuration

The thermostats are configured with default settings:
- Control sequence: Cooling and heating
- Minimum setpoint dead band: 2.5°C
- Default temperatures around 20-22°C

To customize the thermostat behavior, modify `src/server.ts`.

## Matter Compatibility

This server is compatible with all Matter-certified controllers and platforms including:
- Apple HomeKit
- Google Home
- Amazon Alexa
- Samsung SmartThings
- Any other Matter-compatible platform