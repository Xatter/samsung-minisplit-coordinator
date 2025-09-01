import express, { Request, Response, Router } from 'express';

export function createAuthApiRoutes(oauthService: any): Router {
    const router = express.Router();

    // Get authentication status
    router.get('/status', (req: Request, res: Response) => {
        try {
            const isAuthenticated = oauthService.isAuthenticated();
            
            if (isAuthenticated) {
                const userInfo = oauthService.getUserInfo();
                res.json({
                    isAuthenticated: true,
                    user: userInfo,
                });
            } else {
                res.json({
                    isAuthenticated: false,
                    user: null,
                });
            }
        } catch (error) {
            console.error('Error checking authentication status:', error);
            res.status(500).json({ error: 'Failed to check authentication status' });
        }
    });

    // Get SmartThings OAuth authorization URL
    router.get('/url', (req: Request, res: Response) => {
        try {
            const authUrl = oauthService.getAuthorizationUrl();
            res.json({ authUrl });
        } catch (error) {
            console.error('Error getting authorization URL:', error);
            res.status(500).json({ error: 'Failed to get authorization URL' });
        }
    });

    // Logout user
    router.post('/logout', async (req: Request, res: Response) => {
        try {
            await oauthService.logout();
            res.json({ 
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            console.error('Error during logout:', error);
            res.status(500).json({ error: 'Failed to logout' });
        }
    });

    return router;
}