import dotenv from 'dotenv';

dotenv.config();

export const config = {
    smartthings: {
        appId: process.env.SMARTTHINGS_APP_ID || '',
        clientId: process.env.SMARTTHINGS_CLIENT_ID || '',
        clientSecret: process.env.SMARTTHINGS_CLIENT_SECRET || '',
    },
    server: {
        url: process.env.SERVER_URL || 'http://localhost:3000',
        adminPort: parseInt(process.env.ADMIN_PORT || '3000'),
        matterPort: parseInt(process.env.MATTER_PORT || '5540'),
        sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    },
    urls: {
        callback: process.env.CALLBACK_URL || 'http://localhost:3000/auth/callback',
    },
    weather: {
        apiKey: process.env.OPENWEATHER_API_KEY || '',
        lat: process.env.LOCATION_LAT ? parseFloat(process.env.LOCATION_LAT) : undefined,
        lon: process.env.LOCATION_LON ? parseFloat(process.env.LOCATION_LON) : undefined,
        zipCode: process.env.LOCATION_ZIP || undefined,
        countryCode: process.env.LOCATION_COUNTRY || 'US',
        cacheDurationMs: parseInt(process.env.WEATHER_CACHE_MINUTES || '15') * 60 * 1000,
    },
    coordinator: {
        enabled: process.env.COORDINATOR_ENABLED === 'true',
        defaultMinTemp: parseInt(process.env.DEFAULT_MIN_TEMP || '68'),
        defaultMaxTemp: parseInt(process.env.DEFAULT_MAX_TEMP || '72'),
        modeHysteresis: parseInt(process.env.MODE_SWITCH_DEADBAND || '2'),
        coordinationIntervalMs: parseInt(process.env.COORDINATION_INTERVAL_MINUTES || '2') * 60 * 1000,
        miniSplitIds: [
            process.env.MINISPLIT_1_ID || '',
            process.env.MINISPLIT_2_ID || '',
            process.env.MINISPLIT_3_ID || '',
            process.env.MINISPLIT_4_ID || '',
        ].filter(id => id.length > 0),
        roomNames: [
            process.env.MINISPLIT_1_ROOM || 'Living Room',
            process.env.MINISPLIT_2_ROOM || 'Master Bedroom',
            process.env.MINISPLIT_3_ROOM || 'Guest Bedroom',
            process.env.MINISPLIT_4_ROOM || 'Office',
        ],
    }
};

export function validateConfig(): boolean {
    const required = [
        config.smartthings.appId,
        config.smartthings.clientId,
        config.smartthings.clientSecret,
    ];
    
    return required.every(val => val.length > 0);
}

export function validateCoordinatorConfig(): boolean {
    if (!config.coordinator.enabled) return false;
    
    const required = [
        config.weather.apiKey,
        config.coordinator.miniSplitIds.length >= 2, // At least 2 mini-splits for coordination
    ];
    
    const hasLocation = (config.weather.lat && config.weather.lon) || config.weather.zipCode;
    
    return required.every(Boolean) && Boolean(hasLocation);
}

export function validateWeatherConfig(): boolean {
    if (!config.weather.apiKey) return false;
    return Boolean((config.weather.lat && config.weather.lon) || config.weather.zipCode);
}