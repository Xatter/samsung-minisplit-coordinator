import { Router, Request, Response } from 'express';
import { SmartThingsOAuth } from '../../smartthings/oauth';
import { SmartThingsDeviceManager } from '../../smartthings/device-manager';
import { HeatPumpCoordinator } from '../../coordinator/heat-pump-coordinator';

export function createAdminRoutes(oauth: SmartThingsOAuth, deviceManager: SmartThingsDeviceManager, coordinator?: HeatPumpCoordinator): Router {
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
                showCoordinator: !!coordinator,
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
                showCoordinator: !!coordinator,
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
    if (coordinator) {
        router.get('/coordinator', requireAuth, async (req: Request, res: Response) => {
            try {
                const status = coordinator.getCoordinatorStatus();
                const systemState = coordinator['config'].stateManager.getSystemState();
                const preferences = coordinator['config'].stateManager.getUserPreferences();
                const onlineUnits = coordinator['config'].stateManager.getOnlineMiniSplits();
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
                    showCoordinator: !!coordinator,
                    message: 'Failed to load coordinator status'
                });
            }
        });

        router.get('/coordinator/status', requireAuth, async (req: Request, res: Response) => {
            try {
                const status = coordinator.getCoordinatorStatus();
                res.json(status);
            } catch (error) {
                console.error('Error getting coordinator status:', error);
                res.status(500).json({ error: 'Failed to get coordinator status' });
            }
        });

        router.post('/coordinator/mode', requireAuth, async (req: Request, res: Response) => {
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
            try {
                const result = await coordinator.runCoordinationCycle();
                res.json(result);
            } catch (error) {
                console.error('Error running coordination cycle:', error);
                res.status(500).json({ error: 'Failed to run coordination cycle' });
            }
        });

        // Add route to manually trigger device sync
        router.post('/coordinator/sync-devices', requireAuth, async (req: Request, res: Response) => {
            try {
                await coordinator.triggerDeviceSync();
                res.json({ success: true, message: 'Device sync completed' });
            } catch (error) {
                console.error('Error syncing devices:', error);
                res.status(500).json({ error: 'Failed to sync devices' });
            }
        });
    }

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