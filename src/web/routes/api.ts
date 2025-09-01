import express, { Request, Response, Router } from 'express';
import { SmartThingsDeviceManager } from '../../smartthings/device-manager';

export function createApiRoutes(deviceManager: SmartThingsDeviceManager): Router {
    const router = express.Router();

    // Test route to verify router is working
    router.get('/test', (req: Request, res: Response) => {
        res.json({ message: 'API is working' });
    });

    // Get all devices
    router.get('/devices', async (req: Request, res: Response) => {
        try {
            const devices = await deviceManager.getDevices();
            res.json(devices);
        } catch (error) {
            console.error('Error fetching devices:', error);
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    });

    // Get device status
    router.get('/device/:deviceId/status', async (req: Request, res: Response) => {
        try {
            const { deviceId } = req.params;
            const status = await deviceManager.getDeviceStatus(deviceId);
            res.json(status);
        } catch (error) {
            console.error('Error fetching device status:', error);
            res.status(500).json({ error: 'Failed to fetch device status' });
        }
    });

    // Control device power
    router.post('/device/:deviceId/control/power', async (req: Request, res: Response) => {
        try {
            const { deviceId } = req.params;
            const { state } = req.body;
            
            await deviceManager.switchDevice(deviceId, state);
            res.json({ success: true });
        } catch (error) {
            console.error('Error controlling device power:', error);
            res.status(500).json({ error: 'Failed to control device power' });
        }
    });

    // Set device mode
    router.post('/device/:deviceId/control/mode', async (req: Request, res: Response) => {
        try {
            const { deviceId } = req.params;
            const { mode } = req.body;
            
            // Determine if this is a thermostat or air conditioner
            const device = await deviceManager.getDevices()
                .then(devices => devices.find(d => d.deviceId === deviceId));
            
            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }
            
            const hasAirConditioner = device.capabilities.some(c => c.id === 'airConditionerMode');
            
            if (hasAirConditioner) {
                await deviceManager.executeDeviceCommand(deviceId, 'airConditionerMode', 'setAirConditionerMode', [mode]);
            } else {
                await deviceManager.setThermostatMode(deviceId, mode);
            }
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting device mode:', error);
            res.status(500).json({ error: 'Failed to set device mode' });
        }
    });

    // Set temperature
    router.post('/device/:deviceId/control/temperature', async (req: Request, res: Response) => {
        try {
            const { deviceId } = req.params;
            const { temperature } = req.body;
            
            await deviceManager.setThermostatTemperature(deviceId, temperature);
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting temperature:', error);
            res.status(500).json({ error: 'Failed to set temperature' });
        }
    });

    // Execute custom command
    router.post('/device/:deviceId/control/command', async (req: Request, res: Response) => {
        try {
            const { deviceId } = req.params;
            const { capability, command, arguments: args } = req.body;
            
            await deviceManager.executeDeviceCommand(deviceId, capability, command, args || []);
            res.json({ success: true });
        } catch (error) {
            console.error('Error executing command:', error);
            res.status(500).json({ error: 'Failed to execute command' });
        }
    });

    return router;
}