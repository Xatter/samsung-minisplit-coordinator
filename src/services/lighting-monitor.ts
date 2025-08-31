import { SmartThingsDeviceManager } from '../smartthings/device-manager';
import { config } from '../config';

export interface LightingEvent {
    deviceId: string;
    deviceName: string;
    timestamp: number;
    previousState: string;
    action: 'turned_off' | 'already_off' | 'error';
    error?: string;
}

export interface LightingMonitorStatus {
    isRunning: boolean;
    enabled: boolean;
    checkIntervalMs: number;
    lastCheckTime: number;
    devicesWithLighting: string[];
    totalChecks: number;
    totalLightsOff: number;
    recentEvents: LightingEvent[];
}

export class LightingMonitor {
    private deviceManager: SmartThingsDeviceManager;
    private isRunning = false;
    private monitorTimer: NodeJS.Timeout | null = null;
    private lastCheckTime = 0;
    private totalChecks = 0;
    private totalLightsOff = 0;
    private recentEvents: LightingEvent[] = [];
    private devicesWithLighting: string[] = [];

    constructor(deviceManager: SmartThingsDeviceManager) {
        this.deviceManager = deviceManager;
        console.log('Lighting Monitor initialized');
    }

    public async start(): Promise<void> {
        if (!config.coordinator.lightingMonitor.enabled) {
            console.log('Lighting Monitor is disabled in configuration');
            return;
        }

        if (this.isRunning) {
            console.log('Lighting Monitor already running');
            return;
        }

        console.log('Starting Lighting Monitor...');

        // Initialize devices with lighting capability
        await this.initializeDevicesWithLighting();

        if (this.devicesWithLighting.length === 0) {
            console.log('No devices with lighting capability found');
            return;
        }

        this.isRunning = true;

        // Run initial check
        await this.checkAndTurnOffLighting();

        // Set up periodic monitoring
        const intervalMs = config.coordinator.lightingMonitor.checkIntervalMs;
        this.monitorTimer = setInterval(async () => {
            try {
                await this.checkAndTurnOffLighting();
            } catch (error) {
                console.error('Error in lighting monitor cycle:', error);
                this.addEvent({
                    deviceId: 'system',
                    deviceName: 'System',
                    timestamp: Date.now(),
                    previousState: 'unknown',
                    action: 'error',
                    error: `Monitor cycle error: ${error}`
                });
            }
        }, intervalMs);

        console.log(`Lighting Monitor started - checking every ${intervalMs / 1000} seconds`);
        console.log(`Monitoring ${this.devicesWithLighting.length} devices with lighting capability`);
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
        }

        this.isRunning = false;
        console.log('Lighting Monitor stopped');
    }

    private async initializeDevicesWithLighting(): Promise<void> {
        if (!this.deviceManager.isAuthenticated()) {
            console.log('SmartThings authentication not available - skipping lighting device initialization');
            return;
        }

        try {
            console.log('Discovering devices with lighting capability...');
            
            // Check all mini-split devices for lighting capability
            const miniSplitIds = config.coordinator.miniSplitIds;
            this.devicesWithLighting = [];

            for (const deviceId of miniSplitIds) {
                try {
                    const hasLighting = await this.deviceManager.hasLightingCapability(deviceId);
                    if (hasLighting) {
                        this.devicesWithLighting.push(deviceId);
                        console.log(`Device ${deviceId} has lighting capability`);
                    }
                } catch (error) {
                    console.error(`Error checking lighting capability for device ${deviceId}:`, error);
                }
            }

            console.log(`Found ${this.devicesWithLighting.length} devices with lighting capability`);
        } catch (error) {
            console.error('Error initializing devices with lighting:', error);
        }
    }

    public async checkAndTurnOffLighting(): Promise<void> {
        if (!this.deviceManager.isAuthenticated()) {
            console.log('SmartThings authentication not available - skipping lighting check');
            return;
        }

        this.lastCheckTime = Date.now();
        this.totalChecks++;

        console.log(`Lighting Monitor: Checking ${this.devicesWithLighting.length} devices...`);

        for (const deviceId of this.devicesWithLighting) {
            try {
                const lightingState = await this.deviceManager.getLightingStatus(deviceId);
                
                if (lightingState === null) {
                    // Device doesn't have lighting or couldn't get status
                    continue;
                }

                if (lightingState === 'on') {
                    console.log(`Device ${deviceId} lighting is ON - turning OFF`);
                    
                    try {
                        await this.deviceManager.turnOffLighting(deviceId);
                        this.totalLightsOff++;
                        
                        this.addEvent({
                            deviceId,
                            deviceName: this.getDeviceName(deviceId),
                            timestamp: Date.now(),
                            previousState: 'on',
                            action: 'turned_off'
                        });

                        console.log(`Successfully turned off lighting for device ${deviceId}`);
                    } catch (error) {
                        console.error(`Failed to turn off lighting for device ${deviceId}:`, error);
                        
                        this.addEvent({
                            deviceId,
                            deviceName: this.getDeviceName(deviceId),
                            timestamp: Date.now(),
                            previousState: 'on',
                            action: 'error',
                            error: `Failed to turn off: ${error}`
                        });
                    }
                } else {
                    // Lighting is already off - this is normal, no need to log unless in debug mode
                    this.addEvent({
                        deviceId,
                        deviceName: this.getDeviceName(deviceId),
                        timestamp: Date.now(),
                        previousState: 'off',
                        action: 'already_off'
                    });
                }
            } catch (error) {
                console.error(`Error checking lighting status for device ${deviceId}:`, error);
                
                this.addEvent({
                    deviceId,
                    deviceName: this.getDeviceName(deviceId),
                    timestamp: Date.now(),
                    previousState: 'unknown',
                    action: 'error',
                    error: `Check failed: ${error}`
                });
            }
        }
    }

    public async manualTurnOffAllLighting(): Promise<{ success: number; failed: number; errors: string[] }> {
        const results = { success: 0, failed: 0, errors: [] as string[] };

        if (!this.deviceManager.isAuthenticated()) {
            results.errors.push('SmartThings authentication not available');
            return results;
        }

        console.log('Manual lighting turn off requested for all devices');

        for (const deviceId of this.devicesWithLighting) {
            try {
                await this.deviceManager.turnOffLighting(deviceId);
                results.success++;
                
                this.addEvent({
                    deviceId,
                    deviceName: this.getDeviceName(deviceId),
                    timestamp: Date.now(),
                    previousState: 'unknown',
                    action: 'turned_off'
                });
            } catch (error) {
                results.failed++;
                const errorMsg = `Failed to turn off lighting for ${deviceId}: ${error}`;
                results.errors.push(errorMsg);
                
                this.addEvent({
                    deviceId,
                    deviceName: this.getDeviceName(deviceId),
                    timestamp: Date.now(),
                    previousState: 'unknown',
                    action: 'error',
                    error: errorMsg
                });
            }
        }

        this.totalLightsOff += results.success;
        
        console.log(`Manual lighting turn off complete: ${results.success} success, ${results.failed} failed`);
        return results;
    }

    private getDeviceName(deviceId: string): string {
        const index = config.coordinator.miniSplitIds.indexOf(deviceId);
        if (index !== -1 && index < config.coordinator.roomNames.length) {
            return `${config.coordinator.roomNames[index]} Mini-Split`;
        }
        return `Device ${deviceId.substring(0, 8)}...`;
    }

    private addEvent(event: LightingEvent): void {
        this.recentEvents.unshift(event);
        
        // Keep only the last 50 events
        if (this.recentEvents.length > 50) {
            this.recentEvents = this.recentEvents.slice(0, 50);
        }
    }

    public getStatus(): LightingMonitorStatus {
        return {
            isRunning: this.isRunning,
            enabled: config.coordinator.lightingMonitor.enabled,
            checkIntervalMs: config.coordinator.lightingMonitor.checkIntervalMs,
            lastCheckTime: this.lastCheckTime,
            devicesWithLighting: this.devicesWithLighting,
            totalChecks: this.totalChecks,
            totalLightsOff: this.totalLightsOff,
            recentEvents: this.recentEvents.slice(0, 10) // Return only the 10 most recent events
        };
    }

    public getRecentEvents(count: number = 20): LightingEvent[] {
        return this.recentEvents.slice(0, count);
    }

    public async refreshDevices(): Promise<void> {
        console.log('Refreshing devices with lighting capability...');
        await this.initializeDevicesWithLighting();
    }
}