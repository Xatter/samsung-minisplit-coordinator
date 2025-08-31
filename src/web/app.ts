import express from 'express';
import session from 'express-session';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import { config } from '../config';
import { SmartThingsOAuth, TokenStore } from '../smartthings/oauth';
import { SmartThingsDeviceManager } from '../smartthings/device-manager';
import { MatterSmartApp } from '../smartthings/smartapp';
import { HeatPumpCoordinator } from '../coordinator/heat-pump-coordinator';
import { createAuthRoutes } from './routes/auth';
import { createAdminRoutes } from './routes/admin';

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

    constructor() {
        this.app = express();
        this.oauth = new SmartThingsOAuth();
        this.deviceManager = new SmartThingsDeviceManager(this.oauth);
        this.smartapp = new MatterSmartApp();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, '../../views'));
        
        // Configure express-ejs-layouts
        this.app.use(expressLayouts);
        this.app.set('layout', 'layout');
        this.app.set('layout extractScripts', true);
        this.app.set('layout extractStyles', true);
        
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
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
                commissioning: this.matterCommissioning || {}
            });
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        this.app.use((req, res) => {
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