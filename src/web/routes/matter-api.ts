import express, { Request, Response, Router } from 'express';

export function createMatterApiRoutes(matterBridge: any): Router {
    const router = express.Router();

    // Get Matter commissioning status and codes
    router.get('/status', async (req: Request, res: Response) => {
        try {
            const commissioningInfo = await matterBridge.getCommissioningInfo();
            res.json(commissioningInfo);
        } catch (error) {
            console.error('Error fetching Matter commissioning status:', error);
            res.status(500).json({ error: 'Failed to get Matter commissioning status' });
        }
    });

    // Reset Matter commissioning
    router.post('/reset', async (req: Request, res: Response) => {
        try {
            const result = await matterBridge.resetCommissioning();
            res.json(result);
        } catch (error) {
            console.error('Error resetting Matter commissioning:', error);
            res.status(500).json({ error: 'Failed to reset Matter commissioning' });
        }
    });

    // Get detailed commissioning status
    router.get('/commissioning-status', async (req: Request, res: Response) => {
        try {
            const status = await matterBridge.getCommissioningStatus();
            res.json(status);
        } catch (error) {
            console.error('Error fetching Matter commissioning status:', error);
            res.status(500).json({ error: 'Failed to get Matter commissioning status' });
        }
    });

    return router;
}