import { ServerNode } from "@matter/main";
import { ThermostatDevice } from "@matter/main/devices";
import { ThermostatServer } from "@matter/main/behaviors";
import { config, validateConfig } from './config';
import { AdminServer } from './web/app';
import { SmartThingsMatterBridge } from './smartthings/matter-bridge';

const MATTER_PORT = config.server.matterPort;

async function createMatterServer(bridge?: SmartThingsMatterBridge) {
    const server = await ServerNode.create();

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

    return server;
}

async function main() {
    try {
        console.log('Starting Matter SmartThings Bridge...');
        console.log('Config validation:', validateConfig() ? 'PASSED' : 'FAILED');
        
        let adminServer: AdminServer | null = null;
        let bridge: SmartThingsMatterBridge | null = null;
        
        if (validateConfig()) {
            console.log('Starting admin server and SmartThings integration...');
            adminServer = new AdminServer();
            await adminServer.start();
            
            const deviceManager = adminServer.getDeviceManager();
            const smartapp = adminServer.getSmartApp();
            bridge = new SmartThingsMatterBridge(deviceManager, smartapp);
            
            bridge.startPeriodicSync(30000);
            
            console.log(`Admin interface available at: http://localhost:${config.server.adminPort}`);
            console.log('SmartThings bridge initialized');
        } else {
            console.log('⚠️  SmartThings configuration missing - running in Matter-only mode');
            console.log('To enable SmartThings integration:');
            console.log('1. Copy .env.example to .env');
            console.log('2. Fill in your SmartThings credentials');
            console.log('3. Restart the server');
        }
        
        const matterServer = await createMatterServer(bridge || undefined);
        
        process.on('SIGINT', async () => {
            console.log('Shutting down servers...');
            await matterServer.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}