import express from 'express';
import session from 'express-session';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import cors from 'cors';
import { promises as fs } from 'fs';
import { config } from '../config';
import { SmartThingsOAuth, TokenStore } from '../smartthings/oauth';
import { SmartThingsDeviceManager } from '../smartthings/device-manager';
import { MatterSmartApp } from '../smartthings/smartapp';
import { HeatPumpCoordinator } from '../coordinator/heat-pump-coordinator';
import { createAuthRoutes } from './routes/auth';
import { createAdminRoutes } from './routes/admin';
import { createApiRoutes } from './routes/api';

declare module 'express-session' {
    interface SessionData {
        tokenStore: TokenStore;
    }
}

export class AdminServer {
    private app: express.Application;
    private server?: any;
    private oauth: SmartThingsOAuth;
    private deviceManager: SmartThingsDeviceManager;
    private smartapp: MatterSmartApp;
    private coordinator?: HeatPumpCoordinator;
    private matterCommissioning?: { qrCode?: string; manualCode?: string };
    private wasResetRecently = false;

    constructor() {
        this.app = express();
        this.oauth = new SmartThingsOAuth();
        this.deviceManager = new SmartThingsDeviceManager(this.oauth);
        this.smartapp = new MatterSmartApp();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        // Enable CORS for React development
        this.app.use(cors({
            origin: ['http://localhost:5173', 'http://localhost:3000'],
            credentials: true
        }));
        
        // IMPORTANT: JSON and URL-encoded middleware MUST come before expressLayouts
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, '../../views'));
        
        // Middleware to skip express-ejs-layouts for API routes
        this.app.use((req, res, next) => {
            if (req.path.startsWith('/api/')) {
                // Skip layouts for API routes
                res.locals.layout = false;
            }
            next();
        });
        
        // Configure express-ejs-layouts AFTER body parsers
        this.app.use(expressLayouts);
        this.app.set('layout', 'layout');
        this.app.set('layout extractScripts', false); // Disable script extraction to avoid syntax errors
        this.app.set('layout extractStyles', true);
        
        this.app.use(express.static(path.join(__dirname, '../../public')));
        
        this.app.use(session({
            secret: config.server.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false, // Set to true in production with HTTPS
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            },
        }));
    }

    private setupRoutes() {
        // Test direct API route
        const directRoute = this.app.get('/api/direct-test', (req, res) => {
            console.log('Direct test route hit');
            res.json({ message: 'Direct API test works' });
        });
        console.log('Direct route registered:', !!directRoute);
        
        // Register API routes FIRST (before any view-rendering middleware affects them)
        const apiRouter = createApiRoutes(this.deviceManager);
        console.log('Registering API routes at /api with', apiRouter.stack?.length, 'routes');
        this.app.use('/api', apiRouter);
        
        // Debug: List all registered routes
        console.log('All app routes after API registration:');
        const router = (this.app as any)._router;
        if (router && router.stack) {
            router.stack.forEach((layer: any) => {
                if (layer.route) {
                    console.log('  Route:', layer.route.path, Object.keys(layer.route.methods));
                } else if (layer.name === 'router') {
                    console.log('  Router middleware at:', layer.regexp);
                }
            });
        } else {
            console.log('  No router stack found');
        }
        
        // Then register other routes
        this.app.get('/', (req, res) => {
            res.redirect('/auth/login');
        });

        this.app.use('/auth', createAuthRoutes(this.oauth, this.coordinator));
        this.app.use('/admin', createAdminRoutes(this.oauth, this.deviceManager, () => this.coordinator));
        
        this.app.post('/smartapp', (req, res) => {
            this.smartapp.handleHttpCallback(req, res);
        });

        this.app.get('/matter/setup', (req, res) => {
            res.render('matter-setup', {
                title: 'Matter/HomeKit Setup',
                currentPage: 'matter',
                showCoordinator: !!this.coordinator,
                commissioning: this.matterCommissioning || {},
                wasResetRecently: this.wasResetRecently
            });
        });

        this.app.post('/matter/reset', async (req, res) => {
            try {
                console.log('🔄 Resetting Matter device commissioning state...');
                
                // Remove Matter storage directory
                const matterStoragePath = './data/matter-storage';
                try {
                    await fs.rm(matterStoragePath, { recursive: true, force: true });
                    console.log('✅ Matter storage cleared');
                } catch (error) {
                    console.warn('⚠️ Failed to clear Matter storage:', error);
                }
                
                // Recreate empty storage directory
                try {
                    await fs.mkdir(matterStoragePath, { recursive: true });
                    console.log('✅ Matter storage directory recreated');
                } catch (error) {
                    console.warn('⚠️ Failed to recreate Matter storage:', error);
                }
                
                // Clear commissioning data and set reset flag
                this.matterCommissioning = {};
                this.wasResetRecently = true;
                
                // Send success response
                res.json({ 
                    success: true, 
                    message: 'Matter device reset successfully. Restart the service to get new commissioning codes.' 
                });
                
                console.log('🔄 Matter device reset complete - service restart required for new commissioning codes');
                
            } catch (error) {
                console.error('❌ Error resetting Matter device:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to reset Matter device' 
                });
            }
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        this.app.use((req, res) => {
            // Return JSON for API routes
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ error: 'API endpoint not found' });
            }
            
            res.status(404).render('error', {
                title: 'Page Not Found',
                currentPage: '',
                showCoordinator: !!this.coordinator,
                message: 'The page you requested could not be found.'
            });
        });

        this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Express error:', err);
            res.status(500).render('error', {
                title: 'Server Error',
                currentPage: '',
                showCoordinator: !!this.coordinator,
                message: 'An internal server error occurred.'
            });
        });
    }


    public getSmartApp(): MatterSmartApp {
        return this.smartapp;
    }

    public getDeviceManager(): SmartThingsDeviceManager {
        return this.deviceManager;
    }

    public setCoordinator(coordinator: HeatPumpCoordinator): void {
        this.coordinator = coordinator;
        console.log('🔧 Coordinator set');
    }

    public setMatterCommissioning(commissioning: { qrCode?: string; manualCode?: string }): void {
        this.matterCommissioning = commissioning;
        this.wasResetRecently = false; // Clear reset flag when new commissioning data is available
    }

    public start(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(config.server.adminPort, () => {
                console.log(`Admin server running on http://localhost:${config.server.adminPort}`);
                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((error: any) => {
                    if (error) {
                        console.error('Error stopping admin server:', error);
                        reject(error);
                    } else {
                        console.log('Admin server stopped');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}