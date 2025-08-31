import { StateManager, MiniSplitState } from './state-manager';
import { WeatherService, WeatherData } from '../services/weather-service';
import { SmartThingsDeviceManager } from '../smartthings/device-manager';
import { LightingMonitor } from '../services/lighting-monitor';

export interface CoordinatorConfig {
    deviceIds: string[]; // Array of 4 mini-split device IDs
    roomNames: string[]; // Corresponding room names
    weatherService: WeatherService;
    deviceManager: SmartThingsDeviceManager;
    stateManager: StateManager;
    lightingMonitor: LightingMonitor;
}

export interface CoordinationResult {
    success: boolean;
    actions: CoordinationAction[];
    conflicts: string[];
    systemMode: 'heat' | 'cool' | 'off';
    reasoning: string;
}

export interface CoordinationAction {
    deviceId: string;
    action: 'setMode' | 'setTemperature' | 'setFanSpeed';
    value: any;
    reason: string;
}

export class HeatPumpCoordinator {
    private config: CoordinatorConfig;
    private isRunning = false;
    private coordinationTimer: NodeJS.Timeout | null = null;

    constructor(config: CoordinatorConfig) {
        this.config = config;
        console.log('Heat Pump Coordinator initialized for devices:', config.deviceIds);
        
        // Initialize device states if not already present
        this.initializeDeviceStates();
    }

    private async initializeDeviceStates(): Promise<void> {
        for (let i = 0; i < this.config.deviceIds.length; i++) {
            const deviceId = this.config.deviceIds[i];
            const roomName = this.config.roomNames[i] || `Room ${i + 1}`;
            
            const existingState = this.config.stateManager.getMiniSplitState(deviceId);
            if (!existingState) {
                this.config.stateManager.updateMiniSplitState(deviceId, {
                    name: `${roomName} Mini-Split`,
                    room: roomName,
                    priority: i === 0 ? 8 : 5, // First unit (living room?) gets higher priority
                    mode: 'off',
                    currentTemperature: 70,
                    targetTemperature: 70,
                    isOnline: false
                });
            }
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            console.log('Heat Pump Coordinator already running');
            return;
        }

        this.isRunning = true;
        console.log('Starting Heat Pump Coordinator...');

        // Start lighting monitor
        try {
            await this.config.lightingMonitor.start();
        } catch (error) {
            console.error('Error starting lighting monitor:', error);
        }

        // Initial sync of all devices
        await this.syncDeviceStates();

        // Run coordination logic immediately
        await this.runCoordinationCycle();

        // Set up periodic coordination (every 2 minutes)
        this.coordinationTimer = setInterval(async () => {
            try {
                await this.runCoordinationCycle();
            } catch (error) {
                console.error('Error in coordination cycle:', error);
            }
        }, 2 * 60 * 1000);

        console.log('Heat Pump Coordinator started - running coordination every 2 minutes');
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        if (this.coordinationTimer) {
            clearInterval(this.coordinationTimer);
            this.coordinationTimer = null;
        }

        // Stop lighting monitor
        try {
            await this.config.lightingMonitor.stop();
        } catch (error) {
            console.error('Error stopping lighting monitor:', error);
        }

        this.isRunning = false;
        console.log('Heat Pump Coordinator stopped');
    }

    public async runCoordinationCycle(): Promise<CoordinationResult> {
        console.log('Running coordination cycle...');

        try {
            // 1. Sync current device states from SmartThings
            await this.syncDeviceStates();

            // 2. Get current weather data
            const weather = await this.config.weatherService.getWeatherData();
            this.config.stateManager.updateOutsideTemperature(weather.temperature);

            // 3. Determine optimal system mode
            const systemMode = await this.determineOptimalSystemMode(weather);

            // 4. Check for conflicts and resolve them
            const conflicts = this.detectConflicts();

            // 5. Generate coordination actions
            const actions = await this.generateCoordinationActions(systemMode);

            // 6. Execute actions
            await this.executeCoordinationActions(actions);

            // 7. Update system state
            this.config.stateManager.updateGlobalMode(
                systemMode, 
                'coordinator_logic', 
                weather.temperature
            );

            const result: CoordinationResult = {
                success: true,
                actions,
                conflicts,
                systemMode,
                reasoning: this.generateReasoningExplanation(weather, systemMode, actions)
            };

            console.log(`Coordination complete - System mode: ${systemMode}, Actions: ${actions.length}`);
            return result;

        } catch (error) {
            console.error('Coordination cycle failed:', error);
            return {
                success: false,
                actions: [],
                conflicts: [`Coordination failed: ${error}`],
                systemMode: 'off',
                reasoning: `Error during coordination: ${error}`
            };
        }
    }

    private async syncDeviceStates(): Promise<void> {
        // Check if SmartThings authentication is available
        if (!this.config.deviceManager.isAuthenticated()) {
            console.log('SmartThings authentication not available - skipping device sync');
            console.log('Devices will remain in cached/default state until authentication is available');
            return;
        }

        console.log('Syncing device states from SmartThings...');
        
        for (const deviceId of this.config.deviceIds) {
            try {
                const status = await this.config.deviceManager.getDeviceStatus(deviceId);
                const mainComponent = status.components.main;

                if (mainComponent) {
                    const updates: Partial<MiniSplitState> = {
                        isOnline: true,
                        lastUpdated: Date.now()
                    };

                    if (mainComponent.temperatureMeasurement?.temperature) {
                        updates.currentTemperature = mainComponent.temperatureMeasurement.temperature.value;
                    }

                    if (mainComponent.thermostatHeatingSetpoint?.heatingSetpoint) {
                        updates.targetTemperature = mainComponent.thermostatHeatingSetpoint.heatingSetpoint.value;
                    } else if (mainComponent.thermostatCoolingSetpoint?.coolingSetpoint) {
                        updates.targetTemperature = mainComponent.thermostatCoolingSetpoint.coolingSetpoint.value;
                    }

                    if (mainComponent.thermostat?.thermostatMode) {
                        updates.mode = mainComponent.thermostat.thermostatMode.value as any;
                    }

                    this.config.stateManager.updateMiniSplitState(deviceId, updates);
                }
            } catch (error) {
                console.error(`Failed to sync device ${deviceId}:`, error);
                this.config.stateManager.updateMiniSplitState(deviceId, { 
                    isOnline: false,
                    lastUpdated: Date.now() 
                });
            }
        }
    }

    private async determineOptimalSystemMode(weather: WeatherData): Promise<'heat' | 'cool' | 'off'> {
        const state = this.config.stateManager.getSystemState();
        const preferences = this.config.stateManager.getUserPreferences();
        
        // Check if weather-based mode is disabled
        if (!preferences.weatherBasedModeEnabled) {
            return state.globalMode as 'heat' | 'cool' | 'off';
        }

        // Get active schedule
        const activeSchedule = this.config.stateManager.getActiveSchedule();
        const targetMinTemp = activeSchedule?.targetMinTemp || state.globalMinTemp;
        const targetMaxTemp = activeSchedule?.targetMaxTemp || state.globalMaxTemp;
        
        const averageDesired = (targetMinTemp + targetMaxTemp) / 2;
        const outsideTemp = weather.temperature;
        const hysteresis = preferences.modeHysteresis;
        const currentMode = state.globalMode;

        console.log(`Mode determination: Outside ${outsideTemp}°F, Target ${averageDesired}°F, Current mode: ${currentMode}`);

        // Determine new mode based on outside temperature and hysteresis
        if (outsideTemp < (averageDesired - hysteresis)) {
            // It's cold outside, we likely need heating
            if (currentMode === 'cool') {
                // Only switch if temperature difference is significant
                return outsideTemp < (averageDesired - hysteresis - 2) ? 'heat' : 'cool';
            }
            return 'heat';
        } else if (outsideTemp > (averageDesired + hysteresis)) {
            // It's hot outside, we likely need cooling
            if (currentMode === 'heat') {
                // Only switch if temperature difference is significant
                return outsideTemp > (averageDesired + hysteresis + 2) ? 'cool' : 'heat';
            }
            return 'cool';
        } else {
            // Temperature is in the comfort zone
            // Check indoor temperatures to decide
            const onlineUnits = this.config.stateManager.getOnlineMiniSplits();
            if (onlineUnits.length === 0) {
                return 'off';
            }

            const avgCurrentTemp = this.config.stateManager.getAverageCurrentTemperature();
            
            if (avgCurrentTemp < targetMinTemp) {
                return 'heat';
            } else if (avgCurrentTemp > targetMaxTemp) {
                return 'cool';
            } else {
                // Maintain current mode if in comfort range
                return currentMode === 'off' ? 'off' : (currentMode as 'heat' | 'cool' | 'off');
            }
        }
    }

    private detectConflicts(): string[] {
        const conflicts: string[] = [];
        const onlineUnits = this.config.stateManager.getOnlineMiniSplits();
        
        if (onlineUnits.length < 2) {
            return conflicts; // No conflicts with less than 2 units
        }

        // Check for mode conflicts
        const activeModes = onlineUnits.map(unit => unit.mode).filter((mode): mode is 'heat' | 'cool' => mode !== 'off');
        const uniqueModes = [...new Set(activeModes)];
        
        if (uniqueModes.length > 1) {
            const conflictingUnits = onlineUnits.filter(unit => unit.mode !== 'off' && activeModes.includes(unit.mode as any));
            conflicts.push(`Mode conflict detected: Units ${conflictingUnits.map(u => u.name).join(', ')} have different modes`);
            
            this.config.stateManager.addConflictEvent(
                'mode_mismatch',
                `Multiple units have conflicting modes: ${uniqueModes.join(', ')}`,
                conflictingUnits.map(u => u.deviceId)
            );
        }

        // Check for extreme temperature differences (>10°F)
        const currentTemps = onlineUnits.map(unit => unit.currentTemperature);
        const minTemp = Math.min(...currentTemps);
        const maxTemp = Math.max(...currentTemps);
        
        if (maxTemp - minTemp > 10) {
            conflicts.push(`Large temperature variation detected: ${minTemp}°F to ${maxTemp}°F across units`);
        }

        // Check for rapid mode changes (more than 3 in last hour)
        const recentChanges = this.config.stateManager.getRecentModeChanges(1);
        if (recentChanges.length > 3) {
            conflicts.push(`Rapid mode switching detected: ${recentChanges.length} changes in the last hour`);
        }

        return conflicts;
    }

    private async generateCoordinationActions(systemMode: 'heat' | 'cool' | 'off'): Promise<CoordinationAction[]> {
        const actions: CoordinationAction[] = [];
        const onlineUnits = this.config.stateManager.getOnlineMiniSplits();
        const state = this.config.stateManager.getSystemState();

        for (const unit of onlineUnits) {
            // Set all units to the same mode
            if (unit.mode !== systemMode && systemMode !== 'off') {
                actions.push({
                    deviceId: unit.deviceId,
                    action: 'setMode',
                    value: systemMode,
                    reason: `Coordinating mode to ${systemMode} based on system logic`
                });
            }

            // Adjust temperatures to be within global range
            const minTemp = state.globalMinTemp;
            const maxTemp = state.globalMaxTemp;
            let targetTemp = unit.targetTemperature;

            if (systemMode === 'heat') {
                // For heating, aim for the higher end of the range
                targetTemp = Math.max(minTemp, Math.min(maxTemp - 1, unit.targetTemperature));
                if (targetTemp < minTemp + 1) {
                    targetTemp = minTemp + 1;
                }
            } else if (systemMode === 'cool') {
                // For cooling, aim for the lower end of the range
                targetTemp = Math.min(maxTemp, Math.max(minTemp + 1, unit.targetTemperature));
                if (targetTemp > maxTemp - 1) {
                    targetTemp = maxTemp - 1;
                }
            }

            // Adjust based on room priority
            if (unit.priority > 7) {
                // High priority rooms get slight preference
                if (systemMode === 'heat') {
                    targetTemp = Math.min(maxTemp, targetTemp + 1);
                } else if (systemMode === 'cool') {
                    targetTemp = Math.max(minTemp, targetTemp - 1);
                }
            }

            if (Math.abs(targetTemp - unit.targetTemperature) >= 1) {
                actions.push({
                    deviceId: unit.deviceId,
                    action: 'setTemperature',
                    value: targetTemp,
                    reason: `Adjusting temperature from ${unit.targetTemperature}°F to ${targetTemp}°F for coordination`
                });
            }
        }

        return actions;
    }

    private async executeCoordinationActions(actions: CoordinationAction[]): Promise<void> {
        if (!this.config.deviceManager.isAuthenticated()) {
            console.log(`Skipping ${actions.length} coordination actions - SmartThings authentication not available`);
            return;
        }

        console.log(`Executing ${actions.length} coordination actions...`);

        for (const action of actions) {
            try {
                console.log(`Executing: ${action.action} = ${action.value} on ${action.deviceId}`);
                
                switch (action.action) {
                    case 'setMode':
                        await this.config.deviceManager.setThermostatMode(action.deviceId, action.value as 'heat' | 'cool' | 'off');
                        break;
                    case 'setTemperature':
                        await this.config.deviceManager.setThermostatTemperature(action.deviceId, action.value);
                        break;
                    default:
                        console.warn(`Unknown action: ${action.action}`);
                }

                // Small delay to avoid overwhelming the devices
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`Failed to execute action ${action.action} on ${action.deviceId}:`, error);
            }
        }

        console.log('Coordination actions completed');
    }

    private generateReasoningExplanation(weather: WeatherData, systemMode: string, actions: CoordinationAction[]): string {
        const parts = [];
        
        parts.push(`Outside temperature: ${weather.temperature}°F`);
        
        const state = this.config.stateManager.getSystemState();
        const avgDesired = (state.globalMinTemp + state.globalMaxTemp) / 2;
        parts.push(`Target range: ${state.globalMinTemp}°F - ${state.globalMaxTemp}°F (avg: ${avgDesired}°F)`);
        
        if (weather.temperature < avgDesired - 2) {
            parts.push('Outside is cold relative to desired temperature → Heat mode selected');
        } else if (weather.temperature > avgDesired + 2) {
            parts.push('Outside is warm relative to desired temperature → Cool mode selected');
        } else {
            parts.push('Outside temperature is moderate → Mode based on indoor conditions');
        }

        if (actions.length > 0) {
            parts.push(`Applied ${actions.length} adjustments to maintain coordination`);
        } else {
            parts.push('No adjustments needed - all units already coordinated');
        }

        return parts.join('. ');
    }

    // Manual override methods
    public async setGlobalMode(mode: 'heat' | 'cool' | 'off', reason: string = 'manual_override'): Promise<void> {
        console.log(`Manual override: Setting global mode to ${mode}`);
        
        this.config.stateManager.updateGlobalMode(mode, reason as any);
        
        // Apply to all online units immediately
        const actions: CoordinationAction[] = [];
        const onlineUnits = this.config.stateManager.getOnlineMiniSplits();
        
        for (const unit of onlineUnits) {
            if (unit.mode !== mode) {
                actions.push({
                    deviceId: unit.deviceId,
                    action: 'setMode',
                    value: mode,
                    reason: `Manual override to ${mode}`
                });
            }
        }

        await this.executeCoordinationActions(actions);
    }

    public async setGlobalTemperatureRange(minTemp: number, maxTemp: number): Promise<void> {
        console.log(`Setting global temperature range: ${minTemp}°F - ${maxTemp}°F`);
        
        this.config.stateManager.updateGlobalTemperatureRange(minTemp, maxTemp);
        
        // Trigger coordination to apply new range
        await this.runCoordinationCycle();
    }

    public async emergencyOff(reason: string = 'emergency_stop'): Promise<void> {
        console.log(`EMERGENCY STOP: Turning off all units - ${reason}`);
        
        const actions: CoordinationAction[] = [];
        const allUnits = this.config.stateManager.getAllMiniSplitStates();
        
        for (const unit of allUnits) {
            actions.push({
                deviceId: unit.deviceId,
                action: 'setMode',
                value: 'off',
                reason: `Emergency stop: ${reason}`
            });
        }

        await this.executeCoordinationActions(actions);
        this.config.stateManager.updateGlobalMode('off', reason as any);
    }

    public async triggerDeviceSync(): Promise<void> {
        console.log('Manually triggering device sync...');
        await this.syncDeviceStates();
    }

    public getCoordinatorStatus() {
        const state = this.config.stateManager.getSystemState();
        const onlineUnits = this.config.stateManager.getOnlineMiniSplits();
        const conflicts = this.config.stateManager.getUnresolvedConflicts();
        const lightingStatus = this.config.lightingMonitor.getStatus();
        
        return {
            isRunning: this.isRunning,
            isAuthenticated: this.config.deviceManager.isAuthenticated(),
            globalMode: state.globalMode,
            globalRange: { min: state.globalMinTemp, max: state.globalMaxTemp },
            outsideTemperature: state.outsideTemperature,
            lastWeatherUpdate: new Date(state.lastOutsideWeatherUpdate),
            onlineUnits: onlineUnits.length,
            totalUnits: this.config.deviceIds.length,
            unresolvedConflicts: conflicts.length,
            weatherCacheValid: this.config.weatherService.isCacheValid(),
            lightingMonitor: lightingStatus
        };
    }

    // Lighting monitor methods
    public getLightingMonitorStatus() {
        return this.config.lightingMonitor.getStatus();
    }

    public async manualTurnOffAllLighting() {
        return await this.config.lightingMonitor.manualTurnOffAllLighting();
    }

    public async refreshLightingDevices() {
        return await this.config.lightingMonitor.refreshDevices();
    }

    public getLightingRecentEvents(count: number = 20) {
        return this.config.lightingMonitor.getRecentEvents(count);
    }
}