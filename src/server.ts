import { ServerNode } from "@matter/main";
import { ThermostatDevice } from "@matter/main/devices";
import { ThermostatServer } from "@matter/main/behaviors";
import { config, validateConfig, validateCoordinatorConfig, validateWeatherConfig } from './config';
import { AdminServer } from './web/app';
import { SmartThingsMatterBridge } from './smartthings/matter-bridge';
import { HeatPumpCoordinator } from './coordinator/heat-pump-coordinator';
import { StateManager } from './coordinator/state-manager';
import { WeatherService } from './services/weather-service';
import { LightingMonitor } from './services/lighting-monitor';

const MATTER_PORT = config.server.matterPort;

interface MatterServerInfo {
    server: any;
    commissioning?: {
        qrCode?: string;
        manualCode?: string;
    };
    stateUpdateTimer?: NodeJS.Timeout | null;
}

async function createMatterServer(bridge?: SmartThingsMatterBridge, coordinator?: HeatPumpCoordinator): Promise<MatterServerInfo> {
    const server = await ServerNode.create();
    let stateUpdateTimer: NodeJS.Timeout | null = null;

    if (coordinator) {
        // Create a single coordinated thermostat
        const coordinatedThermostat = await server.add(ThermostatDevice.with(
            ThermostatServer.with("Heating", "Cooling", "AutoMode")
        ), {
            id: "coordinated-thermostat",
            thermostat: {
                controlSequenceOfOperation: 4,
                minSetpointDeadBand: 25,
            },
        });

        const thermostatBehavior = (coordinatedThermostat as any).behaviors.require(ThermostatServer);

        // Set initial values from coordinator state
        if (thermostatBehavior) {
            const status = coordinator.getCoordinatorStatus();
            const avgCurrentTemp = coordinator['config'].stateManager.getAverageCurrentTemperature();
            
            console.log(`Initial thermostat setup - Average temperature: ${avgCurrentTemp}°F`);
            
            try {
                // Set initial state values
                const tempCelsius = (avgCurrentTemp - 32) * 5 / 9;
                thermostatBehavior.state.localTemperature = Math.round(tempCelsius * 100); // Convert °F to °C * 100
                console.log(`Setting Matter thermostat temperature: ${avgCurrentTemp}°F → ${tempCelsius.toFixed(1)}°C → ${Math.round(tempCelsius * 100)} (Matter units)`);
                thermostatBehavior.state.occupiedHeatingSetpoint = Math.round(((status.globalRange.min - 32) * 5 / 9) * 100);
                thermostatBehavior.state.occupiedCoolingSetpoint = Math.round(((status.globalRange.max - 32) * 5 / 9) * 100);
                
                // Map system mode
                const modeMapping: {[key: string]: number} = {
                    'off': 0,
                    'cool': 3,
                    'heat': 4,
                };
                thermostatBehavior.state.systemMode = modeMapping[status.globalMode] || 1;
            } catch (error) {
                console.error('Error setting initial thermostat state:', error);
            }

            // Update thermostat state periodically from coordinator
            stateUpdateTimer = setInterval(async () => {
                try {
                    const status = coordinator.getCoordinatorStatus();
                    const avgCurrentTemp = coordinator['config'].stateManager.getAverageCurrentTemperature();
                    
                    const tempCelsius = (avgCurrentTemp - 32) * 5 / 9;
                    thermostatBehavior.state.localTemperature = Math.round(tempCelsius * 100);
                    console.log(`Updating Matter thermostat: ${avgCurrentTemp}°F → ${tempCelsius.toFixed(1)}°C → ${Math.round(tempCelsius * 100)} (Matter units)`);
                    thermostatBehavior.state.occupiedHeatingSetpoint = Math.round(((status.globalRange.min - 32) * 5 / 9) * 100);
                    thermostatBehavior.state.occupiedCoolingSetpoint = Math.round(((status.globalRange.max - 32) * 5 / 9) * 100);
                    
                    const modeMapping: {[key: string]: number} = {
                        'off': 0,
                        'cool': 3,
                        'heat': 4,
                    };
                    thermostatBehavior.state.systemMode = modeMapping[status.globalMode] || 1;
                } catch (error) {
                    console.error('Error updating thermostat state:', error);
                }
            }, 30000); // Update every 30 seconds
            
            console.log(`Started Matter thermostat state update timer (30s interval)`);
        }

        if (thermostatBehavior && bridge) {
            // Handle heating setpoint changes (represents the min temp of the range)
            thermostatBehavior.events.heatingSetpoint$Changed.on(async (value: any) => {
                console.log(`Coordinated thermostat heating setpoint changed: ${value}`);
                try {
                    const currentRange = coordinator.getCoordinatorStatus().globalRange;
                    const newMinTemp = Math.round(((value - 32) * 5 / 9) * 10) / 10; // Convert and round
                    await coordinator.setGlobalTemperatureRange(Math.round((newMinTemp * 9/5) + 32), currentRange.max);
                } catch (error) {
                    console.error('Error updating coordinated heating setpoint:', error);
                }
            });

            // Handle cooling setpoint changes (represents the max temp of the range)
            thermostatBehavior.events.coolingSetpoint$Changed.on(async (value: any) => {
                console.log(`Coordinated thermostat cooling setpoint changed: ${value}`);
                try {
                    const currentRange = coordinator.getCoordinatorStatus().globalRange;
                    const newMaxTemp = Math.round(((value - 32) * 5 / 9) * 10) / 10; // Convert and round
                    await coordinator.setGlobalTemperatureRange(currentRange.min, Math.round((newMaxTemp * 9/5) + 32));
                } catch (error) {
                    console.error('Error updating coordinated cooling setpoint:', error);
                }
            });

            // Handle system mode changes
            thermostatBehavior.events.systemMode$Changed.on(async (value: any) => {
                console.log(`Coordinated thermostat mode changed: ${value}`);
                try {
                    const modeMapping: {[key: number]: 'heat' | 'cool' | 'off'} = {
                        0: 'off',
                        3: 'cool', // Cool
                        4: 'heat', // Heat
                    };
                    const mode = modeMapping[value] || 'off';
                    await coordinator.setGlobalMode(mode, 'homekit_control');
                } catch (error) {
                    console.error('Error updating coordinated mode:', error);
                }
            });
        }

        await server.start();

        console.log(`Matter server started on port ${MATTER_PORT}`);
        console.log("Devices added:");
        console.log("- Coordinated Heat Pump Thermostat (ID: coordinated-thermostat)");
        console.log("  * Heating Setpoint = Global Min Temperature");
        console.log("  * Cooling SetPoint = Global Max Temperature");
        console.log("  * System Mode = Global System Mode");
        
        // Get commissioning information
        let commissioning: { qrCode?: string; manualCode?: string } = {};
        try {
            commissioning.qrCode = server.state.commissioning.pairingCodes.qrPairingCode;
            commissioning.manualCode = server.state.commissioning.pairingCodes.manualPairingCode;
            
            console.log("\n" + "=".repeat(80));
            console.log("🏠 HOMEKIT/MATTER COMMISSIONING INFORMATION");
            console.log("=".repeat(80));
            console.log(`📱 Add this device to HomeKit by scanning the QR code below:`);
            console.log(`📋 Manual Code: ${commissioning.manualCode}`);
            console.log(`🌐 Web Interface: http://localhost:3000/matter/setup`);
            console.log(`🔗 QR Code:`);
            console.log(commissioning.qrCode);
            console.log("=".repeat(80) + "\n");
        } catch (error) {
            console.log("Ready for commissioning...");
            console.log("Visit http://localhost:3000/matter/setup for commissioning information");
        }

        return { server, commissioning, stateUpdateTimer };

    } else {
        // Fallback to individual thermostats if no coordinator
        const leftThermostat = await server.add(ThermostatDevice.with(
            ThermostatServer.with("Heating", "Cooling", "AutoMode")
        ), {
            id: "left-thermostat",
            thermostat: {
                controlSequenceOfOperation: 4,
                minSetpointDeadBand: 25,
            },
        });

        const rightThermostat = await server.add(ThermostatDevice.with(
            ThermostatServer.with("Heating", "Cooling", "AutoMode")
        ), {
            id: "right-thermostat",
            thermostat: {
                controlSequenceOfOperation: 4,
                minSetpointDeadBand: 25,
            },
        });

        if (bridge) {
            const leftThermostatBehavior = (leftThermostat as any).behaviors.require(ThermostatServer);
            const rightThermostatBehavior = (rightThermostat as any).behaviors.require(ThermostatServer);

            if (leftThermostatBehavior) {
                leftThermostatBehavior.events.heatingSetpoint$Changed.on(async (value: any) => {
                    console.log(`Left thermostat heating setpoint changed: ${value}`);
                    await bridge.handleMatterCommand("left-thermostat", "setHeatingSetpoint", [value]);
                });

                leftThermostatBehavior.events.coolingSetpoint$Changed.on(async (value: any) => {
                    console.log(`Left thermostat cooling setpoint changed: ${value}`);
                    await bridge.handleMatterCommand("left-thermostat", "setCoolingSetpoint", [value]);
                });

                leftThermostatBehavior.events.systemMode$Changed.on(async (value: any) => {
                    console.log(`Left thermostat mode changed: ${value}`);
                    await bridge.handleMatterCommand("left-thermostat", "setThermostatMode", [value]);
                });
            }

            if (rightThermostatBehavior) {
                rightThermostatBehavior.events.heatingSetpoint$Changed.on(async (value: any) => {
                    console.log(`Right thermostat heating setpoint changed: ${value}`);
                    await bridge.handleMatterCommand("right-thermostat", "setHeatingSetpoint", [value]);
                });

                rightThermostatBehavior.events.coolingSetpoint$Changed.on(async (value: any) => {
                    console.log(`Right thermostat cooling setpoint changed: ${value}`);
                    await bridge.handleMatterCommand("right-thermostat", "setCoolingSetpoint", [value]);
                });

                rightThermostatBehavior.events.systemMode$Changed.on(async (value: any) => {
                    console.log(`Right thermostat mode changed: ${value}`);
                    await bridge.handleMatterCommand("right-thermostat", "setThermostatMode", [value]);
                });
            }
        }

        await server.start();

        console.log(`Matter server started on port ${MATTER_PORT}`);
        console.log("Devices added:");
        console.log("- Left Thermostat (ID: left-thermostat)");
        console.log("- Right Thermostat (ID: right-thermostat)");
        console.log("Ready for commissioning...");
        
        return { server, stateUpdateTimer: null };
    }

    return { server, stateUpdateTimer: null };
}

// Global variables for cleanup
let globalAdminServer: AdminServer | null = null;
let globalBridge: SmartThingsMatterBridge | null = null;
let globalCoordinator: HeatPumpCoordinator | null = null;
let globalStateManager: StateManager | null = null;
let globalMatterServerInfo: MatterServerInfo | null = null;

// Enhanced shutdown handling with timeout
let shutdownInProgress = false;
const shutdown = async () => {
    if (shutdownInProgress) {
        console.log('Shutdown already in progress...');
        return;
    }
    shutdownInProgress = true;
    
    console.log('\n🔄 Shutting down servers gracefully...');
    
    // Set a timeout to force exit if graceful shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
        console.log('⚠️  Graceful shutdown timeout - forcing exit');
        process.exit(1);
    }, 10000); // 10 second timeout
    
    try {
        // Stop bridge first
        if (globalBridge) {
            console.log('🔌 Stopping SmartThings bridge...');
            globalBridge.stop();
        }
        
        // Stop coordinator
        if (globalCoordinator) {
            console.log('🏠 Stopping Heat Pump Coordinator...');
            await globalCoordinator.stop();
            console.log('✅ Heat Pump Coordinator stopped');
        }
        
        // Clear timers
        if (globalMatterServerInfo?.stateUpdateTimer) {
            clearInterval(globalMatterServerInfo.stateUpdateTimer);
            console.log('⏰ State update timer cleared');
        }
        
        // Save state manager data
        if (globalStateManager) {
            console.log('💾 Saving state manager data...');
            globalStateManager.saveState();
            globalStateManager.savePreferences();
            console.log('✅ State manager saved');
        }
        
        // Stop admin server
        if (globalAdminServer) {
            console.log('🌐 Stopping admin server...');
            await globalAdminServer.stop();
            console.log('✅ Admin server stopped');
        }
        
        // Stop matter server last
        if (globalMatterServerInfo) {
            console.log('🏠 Stopping Matter server...');
            await globalMatterServerInfo.server.close();
            console.log('✅ Matter server stopped');
        }
        
        // Clear the timeout and exit cleanly
        clearTimeout(forceExitTimeout);
        console.log('🏁 Shutdown complete');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        clearTimeout(forceExitTimeout);
        process.exit(1);
    }
};

// Handle shutdown signals - register early and ensure they're called
const handleSignal = (signal: string) => {
    console.log(`\n🛑 Received ${signal}`);
    shutdown().catch((error) => {
        console.error('❌ Error in shutdown handler:', error);
        process.exit(1);
    });
};

// Register signal handlers at module level
process.removeAllListeners('SIGINT');
process.removeAllListeners('SIGTERM');

process.on('SIGINT', () => handleSignal('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    shutdown().catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown().catch(() => process.exit(1));
});

async function main() {
    try {
        console.log('Starting Matter SmartThings Bridge with Heat Pump Coordinator...');
        console.log('SmartThings config:', validateConfig() ? 'PASSED' : 'FAILED');
        console.log('Coordinator config:', validateCoordinatorConfig() ? 'PASSED' : 'FAILED');
        console.log('Weather config:', validateWeatherConfig() ? 'PASSED' : 'FAILED');
        
        let adminServer: AdminServer | null = null;
        let bridge: SmartThingsMatterBridge | null = null;
        let coordinator: HeatPumpCoordinator | null = null;
        let weatherService: WeatherService | null = null;
        let stateManager: StateManager | null = null;

        // Initialize SmartThings integration if configured
        if (validateConfig()) {
            console.log('Starting admin server and SmartThings integration...');
            adminServer = new AdminServer();
            globalAdminServer = adminServer;
            await adminServer.start();
            
            const deviceManager = adminServer.getDeviceManager();
            const smartapp = adminServer.getSmartApp();
            bridge = new SmartThingsMatterBridge(deviceManager, smartapp);
            globalBridge = bridge;
            
            console.log(`Admin interface available at: http://localhost:${config.server.adminPort}`);
            console.log('SmartThings bridge initialized');

            // Initialize Heat Pump Coordinator if enabled and configured
            if (validateCoordinatorConfig()) {
                console.log('Initializing Heat Pump Coordinator...');
                
                try {
                    // Initialize weather service
                    weatherService = new WeatherService({
                        apiKey: config.weather.apiKey,
                        lat: config.weather.lat,
                        lon: config.weather.lon,
                        zipCode: config.weather.zipCode,
                        countryCode: config.weather.countryCode,
                        cacheDurationMs: config.weather.cacheDurationMs,
                    });

                    // Initialize state manager
                    stateManager = new StateManager('./data');
                    globalStateManager = stateManager;

                    // Set initial temperature range from config
                    stateManager.updateGlobalTemperatureRange(
                        config.coordinator.defaultMinTemp,
                        config.coordinator.defaultMaxTemp
                    );

                    // Initialize lighting monitor
                    const lightingMonitor = new LightingMonitor(deviceManager);

                    // Initialize coordinator
                    coordinator = new HeatPumpCoordinator({
                        deviceIds: config.coordinator.miniSplitIds,
                        roomNames: config.coordinator.roomNames.slice(0, config.coordinator.miniSplitIds.length),
                        weatherService,
                        deviceManager,
                        stateManager,
                        lightingMonitor
                    });
                    globalCoordinator = coordinator;

                    // Set coordinator on admin server
                    if (adminServer) {
                        adminServer.setCoordinator(coordinator);
                    }

                    // Start coordination
                    await coordinator.start();
                    console.log(`✅ Heat Pump Coordinator active for ${config.coordinator.miniSplitIds.length} mini-splits`);
                    console.log(`🌡️  Temperature range: ${config.coordinator.defaultMinTemp}°F - ${config.coordinator.defaultMaxTemp}°F`);
                    console.log('📍 Weather-based mode selection enabled');

                } catch (error) {
                    console.error('Failed to initialize Heat Pump Coordinator:', error);
                    console.log('❌ Coordinator disabled - continuing without coordination features');
                }
            } else {
                console.log('⚠️  Heat Pump Coordinator configuration incomplete:');
                if (!config.coordinator.enabled) {
                    console.log('   - COORDINATOR_ENABLED not set to true');
                }
                if (!config.weather.apiKey) {
                    console.log('   - OPENWEATHER_API_KEY not configured');
                }
                if (config.coordinator.miniSplitIds.length < 2) {
                    console.log('   - Less than 2 mini-split device IDs configured');
                }
                if (!validateWeatherConfig()) {
                    console.log('   - Weather location not configured (need LOCATION_LAT/LON or LOCATION_ZIP)');
                }
                console.log('To enable coordination:');
                console.log('1. Configure all required environment variables in .env');
                console.log('2. Set COORDINATOR_ENABLED=true');
                console.log('3. Add your mini-split device IDs from SmartThings');
                console.log('4. Restart the server');
            }

            // Start periodic sync for bridge (reduced frequency if coordinator is active)
            const syncInterval = coordinator ? 60000 : 30000; // 1 min vs 30 sec
            bridge.startPeriodicSync(syncInterval);

        } else {
            console.log('⚠️  SmartThings configuration missing - running in Matter-only mode');
            console.log('To enable SmartThings integration:');
            console.log('1. Copy .env.example to .env');
            console.log('2. Fill in your SmartThings credentials');
            console.log('3. Restart the server');
        }
        
        const matterServerInfo = await createMatterServer(bridge || undefined, coordinator || undefined);
        globalMatterServerInfo = matterServerInfo;
        
        // Pass commissioning info to admin server
        if (adminServer && matterServerInfo.commissioning) {
            adminServer.setMatterCommissioning(matterServerInfo.commissioning);
        }
        
        console.log('✅ Signal handlers registered for SIGINT and SIGTERM');

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}