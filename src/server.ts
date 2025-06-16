import { ServerNode } from "@matter/main";
import { ThermostatDevice } from "@matter/main/devices";
import { ThermostatServer } from "@matter/main/behaviors";

const PORT = 5540;

async function createMatterServer() {
    const server = await ServerNode.create();

    await server.add(ThermostatDevice.with(
        ThermostatServer.with("Heating", "Cooling", "AutoMode")
    ), {
        id: "left-thermostat",
        thermostat: {
            controlSequenceOfOperation: 4,
            minSetpointDeadBand: 25,
        },
    });

    await server.add(ThermostatDevice.with(
        ThermostatServer.with("Heating", "Cooling", "AutoMode")
    ), {
        id: "right-thermostat",
        thermostat: {
            controlSequenceOfOperation: 4,
            minSetpointDeadBand: 25,
        },
    });

    await server.start();

    console.log(`Matter server started on port ${PORT}`);
    console.log("Devices added:");
    console.log("- Left Thermostat (ID: left-thermostat)");
    console.log("- Right Thermostat (ID: right-thermostat)");
    console.log("Ready for commissioning...");

    return server;
}

async function main() {
    try {
        const server = await createMatterServer();
        
        process.on('SIGINT', async () => {
            console.log('Shutting down server...');
            await server.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start Matter server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}