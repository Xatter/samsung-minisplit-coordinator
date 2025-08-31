import { Router, Request, Response } from 'express';
import { SmartThingsOAuth } from '../../smartthings/oauth';

export function createAuthRoutes(oauth: SmartThingsOAuth): Router {
    const router = Router();

    router.get('/login', (req: Request, res: Response) => {
        if (oauth.isAuthenticated()) {
            return res.redirect('/admin/devices');
        }
        res.render('login', { 
            title: 'SmartThings Authentication',
            authUrl: oauth.getAuthorizationUrl()
        });
    });

    router.get('/callback', async (req: Request, res: Response) => {
        const { code, state, error } = req.query;

        if (error) {
            return res.render('error', { 
                title: 'Authentication Error',
                message: `Authentication failed: ${error}`
            });
        }

        if (!code || typeof code !== 'string') {
            return res.render('error', { 
                title: 'Authentication Error',
                message: 'No authorization code received'
            });
        }

        try {
            const tokens = await oauth.exchangeCodeForToken(code);
            
            req.session.tokenStore = tokens;
            oauth.setTokenStore(tokens);
            
            res.redirect('/admin/devices');
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.render('error', { 
                title: 'Authentication Error',
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