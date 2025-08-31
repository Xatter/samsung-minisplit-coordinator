import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface MiniSplitState {
    deviceId: string;
    name: string;
    currentTemperature: number; // °F
    targetTemperature: number; // °F
    mode: 'heat' | 'cool' | 'off';
    isOnline: boolean;
    lastUpdated: number;
    room: string;
    priority: number; // 1-10, higher = more important for coordination
}

export interface SystemState {
    globalMode: 'heat' | 'cool' | 'off';
    globalMinTemp: number; // °F
    globalMaxTemp: number; // °F
    outsideTemperature: number; // °F
    lastOutsideWeatherUpdate: number;
    miniSplits: Map<string, MiniSplitState>;
    modeChangeHistory: ModeChangeEvent[];
    conflicts: ConflictEvent[];
}

export interface ModeChangeEvent {
    timestamp: number;
    deviceId?: string; // undefined for global changes
    previousMode: string;
    newMode: string;
    reason: 'user_request' | 'weather_based' | 'coordinator_logic' | 'schedule' | 'override';
    outsideTemp?: number;
}

export interface ConflictEvent {
    timestamp: number;
    conflictType: 'mode_mismatch' | 'temperature_range' | 'rapid_switching';
    description: string;
    deviceIds: string[];
    resolved: boolean;
    resolution?: string;
}

export interface UserPreferences {
    defaultMinTemp: number;
    defaultMaxTemp: number;
    schedules: Schedule[];
    roomPriorities: { [roomName: string]: number };
    weatherBasedModeEnabled: boolean;
    modeHysteresis: number; // degrees F to prevent rapid switching
}

export interface Schedule {
    id: string;
    name: string;
    enabled: boolean;
    timeStart: string; // "HH:MM"
    timeEnd: string; // "HH:MM"
    daysOfWeek: number[]; // 0-6, Sunday = 0
    targetMinTemp: number;
    targetMaxTemp: number;
    mode?: 'heat' | 'cool';
    rooms?: string[]; // If empty, applies to all rooms
}

export class StateManager {
    private state!: SystemState;
    private preferences!: UserPreferences;
    private readonly stateFilePath: string;
    private readonly preferencesFilePath: string;
    private readonly historyLimit = 1000; // Keep last 1000 mode changes
    private readonly conflictLimit = 100; // Keep last 100 conflicts

    constructor(dataDir: string = './data') {
        this.stateFilePath = join(dataDir, 'coordinator-state.json');
        this.preferencesFilePath = join(dataDir, 'user-preferences.json');
        
        this.loadState();
        this.loadPreferences();
        
        // Auto-save every 5 minutes
        setInterval(() => {
            this.saveState();
        }, 5 * 60 * 1000);
    }

    private loadState(): void {
        try {
            if (existsSync(this.stateFilePath)) {
                const data = JSON.parse(readFileSync(this.stateFilePath, 'utf8'));
                this.state = {
                    ...data,
                    miniSplits: new Map(Object.entries(data.miniSplits || {})),
                };
                console.log('Coordinator state loaded successfully');
            } else {
                this.initializeDefaultState();
            }
        } catch (error) {
            console.error('Error loading coordinator state:', error);
            this.initializeDefaultState();
        }
    }

    private loadPreferences(): void {
        try {
            if (existsSync(this.preferencesFilePath)) {
                this.preferences = JSON.parse(readFileSync(this.preferencesFilePath, 'utf8'));
                console.log('User preferences loaded successfully');
            } else {
                this.initializeDefaultPreferences();
            }
        } catch (error) {
            console.error('Error loading user preferences:', error);
            this.initializeDefaultPreferences();
        }
    }

    private initializeDefaultState(): void {
        this.state = {
            globalMode: 'off',
            globalMinTemp: 68,
            globalMaxTemp: 72,
            outsideTemperature: 70,
            lastOutsideWeatherUpdate: 0,
            miniSplits: new Map(),
            modeChangeHistory: [],
            conflicts: []
        };
        console.log('Initialized default coordinator state');
    }

    private initializeDefaultPreferences(): void {
        this.preferences = {
            defaultMinTemp: 68,
            defaultMaxTemp: 72,
            schedules: [],
            roomPriorities: {},
            weatherBasedModeEnabled: true,
            modeHysteresis: 2 // 2°F deadband
        };
        console.log('Initialized default user preferences');
    }

    public saveState(): void {
        try {
            const dataToSave = {
                ...this.state,
                miniSplits: Object.fromEntries(this.state.miniSplits),
            };
            writeFileSync(this.stateFilePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving coordinator state:', error);
        }
    }

    public savePreferences(): void {
        try {
            writeFileSync(this.preferencesFilePath, JSON.stringify(this.preferences, null, 2));
            console.log('User preferences saved');
        } catch (error) {
            console.error('Error saving user preferences:', error);
        }
    }

    // State getters and setters
    public getSystemState(): SystemState {
        return this.state;
    }

    public getUserPreferences(): UserPreferences {
        return this.preferences;
    }

    public updateGlobalTemperatureRange(minTemp: number, maxTemp: number): void {
        if (minTemp >= maxTemp) {
            throw new Error('Minimum temperature must be less than maximum temperature');
        }
        if (minTemp < 50 || maxTemp > 90) {
            throw new Error('Temperature range must be between 50°F and 90°F');
        }

        this.state.globalMinTemp = minTemp;
        this.state.globalMaxTemp = maxTemp;
        console.log(`Global temperature range updated: ${minTemp}°F - ${maxTemp}°F`);
    }

    public updateGlobalMode(newMode: 'heat' | 'cool' | 'off', reason: ModeChangeEvent['reason'], outsideTemp?: number): void {
        const previousMode = this.state.globalMode;
        if (previousMode !== newMode) {
            this.state.globalMode = newMode;
            this.addModeChangeEvent(undefined, previousMode, newMode, reason, outsideTemp);
            console.log(`Global mode changed from ${previousMode} to ${newMode} (reason: ${reason})`);
        }
    }

    public updateOutsideTemperature(temperature: number): void {
        this.state.outsideTemperature = temperature;
        this.state.lastOutsideWeatherUpdate = Date.now();
    }

    public updateMiniSplitState(deviceId: string, updates: Partial<MiniSplitState>): void {
        const existing = this.state.miniSplits.get(deviceId);
        const updated: MiniSplitState = {
            deviceId,
            name: existing?.name || `Mini-Split ${deviceId.slice(-4)}`,
            currentTemperature: existing?.currentTemperature || 70,
            targetTemperature: existing?.targetTemperature || 70,
            mode: existing?.mode || 'off',
            isOnline: existing?.isOnline || false,
            lastUpdated: Date.now(),
            room: existing?.room || 'Unknown',
            priority: existing?.priority || 5,
            ...updates
        };

        // Track mode changes for individual devices
        if (existing && existing.mode !== updated.mode) {
            this.addModeChangeEvent(deviceId, existing.mode, updated.mode, 'user_request');
        }

        this.state.miniSplits.set(deviceId, updated);
        console.log(`Mini-split ${deviceId} updated:`, updates);
    }

    public getMiniSplitState(deviceId: string): MiniSplitState | undefined {
        return this.state.miniSplits.get(deviceId);
    }

    public getAllMiniSplitStates(): MiniSplitState[] {
        return Array.from(this.state.miniSplits.values());
    }

    public getOnlineMiniSplits(): MiniSplitState[] {
        return this.getAllMiniSplitStates().filter(ms => ms.isOnline);
    }

    public getAverageDesiredTemperature(): number {
        const onlineUnits = this.getOnlineMiniSplits();
        if (onlineUnits.length === 0) return (this.state.globalMinTemp + this.state.globalMaxTemp) / 2;

        const totalTarget = onlineUnits.reduce((sum, unit) => sum + unit.targetTemperature, 0);
        return totalTarget / onlineUnits.length;
    }

    public getAverageCurrentTemperature(): number {
        const onlineUnits = this.getOnlineMiniSplits();
        if (onlineUnits.length === 0) return 70; // Default fallback

        const totalCurrent = onlineUnits.reduce((sum, unit) => sum + unit.currentTemperature, 0);
        return totalCurrent / onlineUnits.length;
    }

    private addModeChangeEvent(deviceId: string | undefined, previousMode: string, newMode: string, reason: ModeChangeEvent['reason'], outsideTemp?: number): void {
        const event: ModeChangeEvent = {
            timestamp: Date.now(),
            deviceId,
            previousMode,
            newMode,
            reason,
            outsideTemp
        };

        this.state.modeChangeHistory.push(event);

        // Limit history size
        if (this.state.modeChangeHistory.length > this.historyLimit) {
            this.state.modeChangeHistory = this.state.modeChangeHistory.slice(-this.historyLimit);
        }
    }

    public addConflictEvent(conflictType: ConflictEvent['conflictType'], description: string, deviceIds: string[]): void {
        const conflict: ConflictEvent = {
            timestamp: Date.now(),
            conflictType,
            description,
            deviceIds,
            resolved: false
        };

        this.state.conflicts.push(conflict);
        console.warn(`Conflict detected: ${description}`);

        // Limit conflict history size
        if (this.state.conflicts.length > this.conflictLimit) {
            this.state.conflicts = this.state.conflicts.slice(-this.conflictLimit);
        }
    }

    public resolveConflict(conflictIndex: number, resolution: string): void {
        if (conflictIndex < this.state.conflicts.length) {
            this.state.conflicts[conflictIndex].resolved = true;
            this.state.conflicts[conflictIndex].resolution = resolution;
            console.log(`Conflict resolved: ${resolution}`);
        }
    }

    public getUnresolvedConflicts(): ConflictEvent[] {
        return this.state.conflicts.filter(c => !c.resolved);
    }

    public getRecentModeChanges(hours: number = 24): ModeChangeEvent[] {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return this.state.modeChangeHistory.filter(event => event.timestamp > cutoff);
    }

    // Schedule management
    public addSchedule(schedule: Omit<Schedule, 'id'>): string {
        const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newSchedule: Schedule = { ...schedule, id };
        this.preferences.schedules.push(newSchedule);
        this.savePreferences();
        console.log(`Schedule "${schedule.name}" added with ID: ${id}`);
        return id;
    }

    public updateSchedule(scheduleId: string, updates: Partial<Schedule>): boolean {
        const index = this.preferences.schedules.findIndex(s => s.id === scheduleId);
        if (index !== -1) {
            this.preferences.schedules[index] = { ...this.preferences.schedules[index], ...updates };
            this.savePreferences();
            console.log(`Schedule ${scheduleId} updated`);
            return true;
        }
        return false;
    }

    public deleteSchedule(scheduleId: string): boolean {
        const initialLength = this.preferences.schedules.length;
        this.preferences.schedules = this.preferences.schedules.filter(s => s.id !== scheduleId);
        if (this.preferences.schedules.length < initialLength) {
            this.savePreferences();
            console.log(`Schedule ${scheduleId} deleted`);
            return true;
        }
        return false;
    }

    public getActiveSchedule(): Schedule | null {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = now.getDay();

        for (const schedule of this.preferences.schedules) {
            if (!schedule.enabled) continue;
            if (!schedule.daysOfWeek.includes(currentDay)) continue;
            if (currentTime >= schedule.timeStart && currentTime <= schedule.timeEnd) {
                return schedule;
            }
        }

        return null;
    }
}