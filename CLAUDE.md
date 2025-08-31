# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in the `dist/` directory
- **Development**: `npm run dev` - Runs the server with ts-node for hot development
- **Production**: `npm start` - Runs the compiled server from `dist/server.js`

## Architecture Overview

This is a Matter.js-based IoT server that exposes two thermostat devices through the Matter protocol. The server uses the `@matter/main` framework to create a standards-compliant Matter node.

### Core Structure

- **Single Entry Point**: `src/server.ts` contains the entire server implementation
- **Dual Thermostat Setup**: Creates two identical thermostat devices with IDs "left-thermostat" and "right-thermostat"
- **Matter Protocol**: Uses ServerNode from @matter/main to handle Matter communication on port 5540

### Thermostat Configuration

Both thermostats are configured with:
- `controlSequenceOfOperation: 4` (heating + cooling mode)
- `minSetpointDeadBand: 25` (2.5°C minimum temperature differential)
- Support for Heating and Cooling behaviors (auto mode disabled)

### Matter Device Structure

The server creates a Matter node with:
- Two endpoints (left and right thermostats)
- ThermostatDevice with ThermostatServer behaviors
- Full Matter protocol compliance for commissioning with any Matter controller

The server displays commissioning information (QR codes, pairing codes) when started and handles graceful shutdown on SIGINT.