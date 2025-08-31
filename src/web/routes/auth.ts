import { Router, Request, Response } from 'express';
import { SmartThingsOAuth } from '../../smartthings/oauth';
import { HeatPumpCoordinator } from '../../coordinator/heat-pump-coordinator';

export function createAuthRoutes(oauth: SmartThingsOAuth, coordinator?: HeatPumpCoordinator): Router {
    const router = Router();

    router.get('/login', (req: Request, res: Response) => {
        if (oauth.isAuthenticated()) {
            return res.redirect('/admin/devices');
        }
        res.render('login', { 
            title: 'SmartThings Authentication',
            currentPage: 'login',
            showCoordinator: !!coordinator,
            authUrl: oauth.getAuthorizationUrl()
        });
    });

    router.get('/callback', async (req: Request, res: Response) => {
        const { code, state, error } = req.query;

        if (error) {
            return res.render('error', { 
                title: 'Authentication Error',
                currentPage: '',
                showCoordinator: !!coordinator,
                message: `Authentication failed: ${error}`
            });
        }

        if (!code || typeof code !== 'string') {
            return res.render('error', { 
                title: 'Authentication Error',
                currentPage: '',
                showCoordinator: !!coordinator,
                message: 'No authorization code received'
            });
        }

        try {
            const tokens = await oauth.exchangeCodeForToken(code);
            
            req.session.tokenStore = tokens;
            oauth.setTokenStore(tokens);
            
            // Trigger device sync if coordinator is available
            if (coordinator) {
                console.log('Authentication successful - triggering device sync...');
                try {
                    await coordinator.triggerDeviceSync();
                    console.log('Device sync completed after authentication');
                } catch (syncError) {
                    console.error('Device sync failed after authentication:', syncError);
                    // Don't fail the auth flow if sync fails
                }
            }
            
            res.redirect('/admin/devices');
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.render('error', { 
                title: 'Authentication Error',
                currentPage: '',
                showCoordinator: !!coordinator,
                message: 'Failed to exchange authorization code for access token'
            });
        }
    });

    router.post('/logout', (req: Request, res: Response) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
            }
            res.redirect('/auth/login');
        });
    });

    return router;
}