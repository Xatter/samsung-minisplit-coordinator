import { Router, Request, Response } from 'express';
import { SmartThingsOAuth } from '../../smartthings/oauth';
import { SmartThingsDeviceManager } from '../../smartthings/device-manager';

export function createAdminRoutes(oauth: SmartThingsOAuth, deviceManager: SmartThingsDeviceManager): Router {
    const router = Router();

    const requireAuth = (req: Request, res: Response, next: any) => {
        if (req.session.tokenStore) {
            oauth.setTokenStore(req.session.tokenStore);
        }
        
        if (!oauth.isAuthenticated()) {
            return res.redirect('/auth/login');
        }
        next();
    };

    router.get('/devices', requireAuth, async (req: Request, res: Response) => {
        try {
            const locations = await deviceManager.getLocations();
            const devices = await deviceManager.getDevices();
            const thermostats = devices.filter(device => 
                device.capabilities.some(cap => cap.id === 'thermostat')
            );
            const switches = devices.filter(device => 
                device.capabilities.some(cap => cap.id === 'switch')
            );

            res.render('devices', {
                title: 'SmartThings Devices',
                locations,
                devices,
                thermostats,
                switches
            });
        } catch (error) {
            console.error('Error loading devices:', error);
            res.render('error', {
                title: 'Device Error',
                message: 'Failed to load SmartThings devices'
            });
        }
    });

    router.get('/device/:deviceId/status', requireAuth, async (req: Request, res: Response) => {
        try {
            const status = await deviceManager.getDeviceStatus(req.params.deviceId);
            res.json(status);
        } catch (error) {
            console.error('Error getting device status:', error);
            res.status(500).json({ error: 'Failed to get device status' });
        }
    });

    router.post('/device/:deviceId/command', requireAuth, async (req: Request, res: Response) => {
        const { capability, command, arguments: args } = req.body;
        
        try {
            await deviceManager.executeDeviceCommand(
                req.params.deviceId,
                capability,
                command,
                args || []
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Error executing device command:', error);
            res.status(500).json({ error: 'Failed to execute device command' });
        }
    });

    router.post('/thermostat/:deviceId/temperature', requireAuth, async (req: Request, res: Response) => {
        const { temperature, scale = 'F' } = req.body;
        
        try {
            await deviceManager.setThermostatTemperature(
                req.params.deviceId,
                parseInt(temperature),
                scale
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting thermostat temperature:', error);
            res.status(500).json({ error: 'Failed to set thermostat temperature' });
        }
    });

    router.post('/thermostat/:deviceId/mode', requireAuth, async (req: Request, res: Response) => {
        const { mode } = req.body;
        
        try {
            await deviceManager.setThermostatMode(req.params.deviceId, mode);
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting thermostat mode:', error);
            res.status(500).json({ error: 'Failed to set thermostat mode' });
        }
    });

    router.post('/switch/:deviceId/toggle', requireAuth, async (req: Request, res: Response) => {
        const { state } = req.body;
        
        try {
            await deviceManager.switchDevice(req.params.deviceId, state);
            res.json({ success: true });
        } catch (error) {
            console.error('Error toggling switch:', error);
            res.status(500).json({ error: 'Failed to toggle switch' });
        }
    });

    return router;
}