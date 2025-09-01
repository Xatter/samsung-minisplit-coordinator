import { Router, Request, Response } from 'express';
import { SmartThingsOAuth } from '../../smartthings/oauth';
import { SmartThingsDeviceManager } from '../../smartthings/device-manager';
import { HeatPumpCoordinator } from '../../coordinator/heat-pump-coordinator';

export function createAdminRoutes(oauth: SmartThingsOAuth, deviceManager: SmartThingsDeviceManager, getCoordinator: () => HeatPumpCoordinator | undefined): Router {
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
                currentPage: 'devices',
                showCoordinator: !!getCoordinator(),
                locations,
                devices,
                thermostats,
                switches
            });
        } catch (error) {
            console.error('Error loading devices:', error);
            res.render('error', {
                title: 'Device Error',
                currentPage: '',
                showCoordinator: !!getCoordinator(),
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

    // Coordinator routes
    router.get('/coordinator', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).render('error', {
                title: 'Coordinator Not Available',
                currentPage: '',
                showCoordinator: false,
                message: 'The Heat Pump Coordinator is not currently available. Please check if it has been properly configured and initialized.'
            });
        }
        
        try {
            const status = coordinator.getCoordinatorStatus();
            const systemState = coordinator['config'].stateManager.getSystemState();
            const preferences = coordinator['config'].stateManager.getUserPreferences();
            const onlineUnits = coordinator['config'].stateManager.getOnlineMiniSplits();
            console.log('DEBUG: Online units temperatures:', onlineUnits.map(u => `${u.name}: ${u.currentTemperature}°F`));
            const conflicts = coordinator['config'].stateManager.getUnresolvedConflicts();
            const recentChanges = coordinator['config'].stateManager.getRecentModeChanges(24);

            res.render('coordinator', {
                title: 'Heat Pump Coordinator',
                currentPage: 'coordinator',
                showCoordinator: true,
                status,
                systemState,
                preferences,
                onlineUnits,
                conflicts,
                recentChanges
            });
        } catch (error) {
            console.error('Error loading coordinator status:', error);
            res.render('error', {
                title: 'Coordinator Error',
                currentPage: '',
                showCoordinator: !!getCoordinator(),
                    message: 'Failed to load coordinator status'
                });
            }
        });

    router.get('/coordinator/status', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        try {
            const status = coordinator.getCoordinatorStatus();
            res.json(status);
        } catch (error) {
            console.error('Error getting coordinator status:', error);
            res.status(500).json({ error: 'Failed to get coordinator status' });
        }
    });

    router.post('/coordinator/mode', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        const { mode, reason } = req.body;
        
        try {
            await coordinator.setGlobalMode(mode, reason || 'manual_override');
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting global mode:', error);
            res.status(500).json({ error: 'Failed to set global mode' });
        }
    });

    router.post('/coordinator/temperature-range', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        const { minTemp, maxTemp } = req.body;
        
        try {
            await coordinator.setGlobalTemperatureRange(parseInt(minTemp), parseInt(maxTemp));
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting temperature range:', error);
            res.status(500).json({ error: 'Failed to set temperature range' });
        }
    });

    router.post('/coordinator/emergency-off', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        const { reason } = req.body;
        
        try {
            await coordinator.emergencyOff(reason || 'manual_emergency_stop');
            res.json({ success: true });
        } catch (error) {
            console.error('Error executing emergency off:', error);
            res.status(500).json({ error: 'Failed to execute emergency off' });
        }
    });

    router.post('/coordinator/run-cycle', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        try {
            const result = await coordinator.runCoordinationCycle();
            res.json(result);
        } catch (error) {
            console.error('Error running coordination cycle:', error);
            res.status(500).json({ error: 'Failed to run coordination cycle' });
        }
    });

    router.post('/coordinator/lighting/turn-off-all', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        try {
            const result = await coordinator.manualTurnOffAllLighting();
            res.json(result);
        } catch (error) {
            console.error('Error turning off lighting:', error);
            res.status(500).json({ error: 'Failed to turn off lighting' });
        }
    });

    // Add route to manually trigger device sync
    router.post('/coordinator/sync-devices', requireAuth, async (req: Request, res: Response) => {
        const coordinator = getCoordinator();
        if (!coordinator) {
            return res.status(404).json({ error: 'Coordinator not available' });
        }
        try {
            await coordinator.triggerDeviceSync();
            res.json({ success: true, message: 'Device sync completed' });
        } catch (error) {
            console.error('Error syncing devices:', error);
            res.status(500).json({ error: 'Failed to sync devices' });
        }
    });

    // Individual Device Control Routes
    router.get('/device/:deviceId/control', requireAuth, async (req: Request, res: Response) => {
        try {
            const deviceId = req.params.deviceId;
            const devices = await deviceManager.getDevices();
            const device = devices.find(d => d.deviceId === deviceId);
            
            if (!device) {
                return res.status(404).render('error', {
                    title: 'Device Not Found',
                    currentPage: '',
                    showCoordinator: !!getCoordinator(),
                    message: `Device with ID ${deviceId} was not found in your SmartThings account.`
                });
            }

            // Check if device has thermostat capability
            const hasThermostateCapability = device.capabilities.some(cap => cap.id === 'thermostat');
            if (!hasThermostateCapability) {
                return res.status(400).render('error', {
                    title: 'Device Not Supported',
                    currentPage: '',
                    showCoordinator: !!getCoordinator(),
                    message: `Device ${device.label || device.name} does not have thermostat capabilities and cannot be manually controlled.`
                });
            }

            // Get current device status
            let status = null;
            try {
                status = await deviceManager.getDeviceStatus(deviceId);
            } catch (error) {
                console.error(`Error getting device status for ${deviceId}:`, error);
            }

            res.render('device-control', {
                title: `Manual Control - ${device.label || device.name}`,
                currentPage: 'device-control',
                showCoordinator: !!getCoordinator(),
                device,
                status
            });
        } catch (error) {
            console.error('Error loading device control page:', error);
            res.render('error', {
                title: 'Device Control Error',
                currentPage: '',
                showCoordinator: !!getCoordinator(),
                message: 'Failed to load device control page'
            });
        }
    });

    router.post('/device/:deviceId/control/power', requireAuth, async (req: Request, res: Response) => {
        const { state } = req.body;
        
        try {
            console.log(`[DEVICE_CONTROL] Setting power ${state} on device ${req.params.deviceId}`);
            await deviceManager.switchDevice(req.params.deviceId, state);
            res.json({ success: true, message: `Device power set to ${state}` });
        } catch (error) {
            console.error('Error setting device power (device control):', error);
            res.status(500).json({ error: 'Failed to set device power' });
        }
    });

    router.post('/device/:deviceId/control/mode', requireAuth, async (req: Request, res: Response) => {
        const { mode } = req.body;
        
        try {
            console.log(`[DEVICE_CONTROL] Setting mode ${mode} on device ${req.params.deviceId}`);
            await deviceManager.setThermostatMode(req.params.deviceId, mode);
            res.json({ success: true, message: `Device mode set to ${mode}` });
        } catch (error) {
            console.error('Error setting device mode (device control):', error);
            res.status(500).json({ error: 'Failed to set device mode' });
        }
    });

    router.post('/device/:deviceId/control/temperature', requireAuth, async (req: Request, res: Response) => {
        const { temperature, scale = 'F' } = req.body;
        
        try {
            console.log(`[DEVICE_CONTROL] Setting temperature ${temperature}°${scale} on device ${req.params.deviceId}`);
            await deviceManager.setThermostatTemperature(
                req.params.deviceId,
                parseInt(temperature),
                scale
            );
            res.json({ success: true, message: `Device temperature set to ${temperature}°${scale}` });
        } catch (error) {
            console.error('Error setting device temperature (device control):', error);
            res.status(500).json({ error: 'Failed to set device temperature' });
        }
    });

    router.post('/device/:deviceId/control/command', requireAuth, async (req: Request, res: Response) => {
        const { capability, command, arguments: args } = req.body;
        
        try {
            console.log(`[DEVICE_CONTROL] Executing ${capability}.${command}(${JSON.stringify(args || [])}) on device ${req.params.deviceId}`);
            await deviceManager.executeDeviceCommand(
                req.params.deviceId,
                capability,
                command,
                args || []
            );
            res.json({ 
                success: true, 
                message: `Command executed: ${capability}.${command}(${JSON.stringify(args || [])})` 
            });
        } catch (error) {
            console.error('Error executing custom command (device control):', error);
            res.status(500).json({ error: 'Failed to execute custom command' });
        }
    });

    // Auth status routes (available regardless of coordinator)
    router.get('/auth/status', requireAuth, (req: Request, res: Response) => {
        const storageInfo = oauth.getStorageInfo();
        res.json({
            authenticated: oauth.isAuthenticated(),
            hasStoredTokens: storageInfo.hasTokens,
            tokenAge: storageInfo.age,
            tokenAgeHours: Math.round(storageInfo.age / (1000 * 60 * 60))
        });
    });

    router.post('/auth/clear-tokens', requireAuth, (req: Request, res: Response) => {
        try {
            oauth.clearStoredTokens();
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destroy error:', err);
                }
                res.json({ success: true, message: 'Authentication cleared' });
            });
        } catch (error) {
            console.error('Error clearing tokens:', error);
            res.status(500).json({ error: 'Failed to clear authentication' });
        }
    });


    return router;
}