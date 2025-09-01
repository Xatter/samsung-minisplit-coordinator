import express, { Request, Response, Router } from 'express';
import { HeatPumpCoordinator } from '../../coordinator/heat-pump-coordinator';

export function createCoordinatorApiRoutes(coordinator: HeatPumpCoordinator): Router {
    const router = express.Router();

    // Get coordinator status
    router.get('/status', (req: Request, res: Response) => {
        try {
            const status = coordinator.getCoordinatorStatus();
            res.json(status);
        } catch (error) {
            console.error('Error fetching coordinator status:', error);
            res.status(500).json({ error: 'Failed to get coordinator status' });
        }
    });

    // Set global mode
    router.post('/mode', async (req: Request, res: Response) => {
        try {
            const { mode, reason = 'api_request' } = req.body;

            // Validate mode parameter
            const validModes = ['heat', 'cool', 'off'];
            if (!mode || !validModes.includes(mode)) {
                return res.status(400).json({ 
                    error: 'Invalid mode. Must be heat, cool, or off' 
                });
            }

            await coordinator.setGlobalMode(mode, reason);
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting global mode:', error);
            res.status(500).json({ error: 'Failed to set global mode' });
        }
    });

    // Set temperature range
    router.post('/temperature-range', async (req: Request, res: Response) => {
        try {
            const { minTemp, maxTemp } = req.body;

            // Validate temperature parameters
            if (typeof minTemp !== 'number' || typeof maxTemp !== 'number') {
                return res.status(400).json({ 
                    error: 'Invalid temperature values. Both minTemp and maxTemp must be numbers' 
                });
            }

            if (minTemp >= maxTemp) {
                return res.status(400).json({ 
                    error: 'Minimum temperature must be less than maximum temperature' 
                });
            }

            if (minTemp < 50 || maxTemp > 90) {
                return res.status(400).json({ 
                    error: 'Temperature range must be between 50°F and 90°F' 
                });
            }

            await coordinator.setGlobalTemperatureRangeImmediate(minTemp, maxTemp);
            res.json({ success: true });
        } catch (error) {
            console.error('Error setting temperature range:', error);
            res.status(500).json({ error: 'Failed to set temperature range' });
        }
    });

    // Emergency off all units
    router.post('/emergency-off', async (req: Request, res: Response) => {
        try {
            const { reason = 'api_emergency_stop' } = req.body;
            
            await coordinator.emergencyOff(reason);
            res.json({ success: true });
        } catch (error) {
            console.error('Error executing emergency off:', error);
            res.status(500).json({ error: 'Failed to execute emergency off' });
        }
    });

    // Run coordination cycle manually
    router.post('/run-cycle', async (req: Request, res: Response) => {
        try {
            const result = await coordinator.runCoordinationCycle();
            res.json(result);
        } catch (error) {
            console.error('Error running coordination cycle:', error);
            res.status(500).json({ error: 'Failed to run coordination cycle' });
        }
    });

    return router;
}