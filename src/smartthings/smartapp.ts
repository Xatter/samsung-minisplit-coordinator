import { SmartApp } from '@smartthings/smartapp';
import { config } from '../config';

export class MatterSmartApp {
    private app: any;

    constructor() {
        this.app = new SmartApp()
            .enableEventLogging(2)
            .appId(config.smartthings.appId)
            .clientId(config.smartthings.clientId)
            .clientSecret(config.smartthings.clientSecret)
            .redirectUri(config.urls.callback)
            .permissions(['r:devices:*', 'x:devices:*', 'r:locations:*'])
            .page('mainPage', (context: any, page: any) => {
                page.section('thermostats', (section: any) => {
                    section
                        .deviceSetting('leftThermostat')
                        .capabilities(['thermostat'])
                        .permissions('rx')
                        .required(false);
                    
                    section
                        .deviceSetting('rightThermostat')
                        .capabilities(['thermostat'])
                        .permissions('rx')
                        .required(false);
                });

                page.section('switches', (section: any) => {
                    section
                        .deviceSetting('switches')
                        .capabilities(['switch'])
                        .permissions('rx')
                        .multiple(true)
                        .required(false);
                });
            })
            .updated(async (context: any) => {
                console.log('SmartApp updated');
                await context.api.subscriptions.delete();
                
                if (context.config.leftThermostat?.[0]?.deviceConfig?.deviceId) {
                    await context.api.subscriptions.subscribeToDevices(
                        context.config.leftThermostat,
                        'thermostat',
                        '*',
                        'thermostatEventHandler'
                    );
                }

                if (context.config.rightThermostat?.[0]?.deviceConfig?.deviceId) {
                    await context.api.subscriptions.subscribeToDevices(
                        context.config.rightThermostat,
                        'thermostat',
                        '*',
                        'thermostatEventHandler'
                    );
                }

                if (context.config.switches) {
                    await context.api.subscriptions.subscribeToDevices(
                        context.config.switches,
                        'switch',
                        '*',
                        'switchEventHandler'
                    );
                }
            })
            .subscribedEventHandler('thermostatEventHandler', async (context: any, event: any) => {
                console.log(`Thermostat event: ${event.deviceId} - ${event.capability}.${event.attribute} = ${event.value}`);
                this.onThermostatEvent?.(event);
            })
            .subscribedEventHandler('switchEventHandler', async (context: any, event: any) => {
                console.log(`Switch event: ${event.deviceId} - ${event.capability}.${event.attribute} = ${event.value}`);
                this.onSwitchEvent?.(event);
            });
    }

    public onThermostatEvent?: (event: any) => void;
    public onSwitchEvent?: (event: any) => void;

    getApp(): any {
        return this.app;
    }

    handleHttpCallback(req: any, res: any): void {
        this.app.handleHttpCallback(req, res);
    }

    setThermostatEventHandler(handler: (event: any) => void): void {
        this.onThermostatEvent = handler;
    }

    setSwitchEventHandler(handler: (event: any) => void): void {
        this.onSwitchEvent = handler;
    }
}