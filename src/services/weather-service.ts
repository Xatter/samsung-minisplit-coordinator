import axios from 'axios';

export interface WeatherData {
    temperature: number; // in Fahrenheit
    humidity: number;
    description: string;
    timestamp: number;
    location: {
        lat: number;
        lon: number;
        name: string;
    };
}

export interface WeatherConfig {
    apiKey: string;
    lat?: number;
    lon?: number;
    zipCode?: string;
    countryCode?: string; // Default 'US'
    cacheDurationMs?: number; // Default 15 minutes
    units?: 'imperial' | 'metric'; // Default imperial for Fahrenheit
}

interface CompleteWeatherConfig {
    apiKey: string;
    lat?: number;
    lon?: number;
    zipCode?: string;
    countryCode: string;
    cacheDurationMs: number;
    units: 'imperial' | 'metric';
}

export class WeatherService {
    private config: CompleteWeatherConfig;
    private cachedData: WeatherData | null = null;
    private lastFetchTime: number = 0;
    private readonly API_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

    constructor(config: WeatherConfig) {
        this.config = {
            cacheDurationMs: 15 * 60 * 1000, // 15 minutes
            units: 'imperial' as const, // Fahrenheit
            countryCode: 'US',
            ...config
        };

        if (!this.config.apiKey) {
            throw new Error('OpenWeatherMap API key is required');
        }

        if (!this.config.lat && !this.config.lon && !this.config.zipCode) {
            throw new Error('Either coordinates (lat/lon) or zipCode must be provided');
        }
    }

    public async getCurrentTemperature(): Promise<number> {
        const weather = await this.getWeatherData();
        return weather.temperature;
    }

    public async getWeatherData(): Promise<WeatherData> {
        const now = Date.now();
        
        // Return cached data if still valid
        if (this.cachedData && (now - this.lastFetchTime) < this.config.cacheDurationMs) {
            console.log('Using cached weather data');
            return this.cachedData;
        }

        try {
            console.log('Fetching fresh weather data from OpenWeatherMap');
            const response = await this.fetchWeatherFromAPI();
            
            this.cachedData = {
                temperature: response.data.main.temp,
                humidity: response.data.main.humidity,
                description: response.data.weather[0].description,
                timestamp: now,
                location: {
                    lat: response.data.coord.lat,
                    lon: response.data.coord.lon,
                    name: response.data.name
                }
            };
            
            this.lastFetchTime = now;
            console.log(`Weather updated: ${this.cachedData.temperature}°F in ${this.cachedData.location.name}`);
            
            return this.cachedData;

        } catch (error) {
            console.error('Error fetching weather data:', error);
            
            // Return cached data if available, even if expired
            if (this.cachedData) {
                console.log('Returning expired cached weather data due to API error');
                return this.cachedData;
            }
            
            // Fallback to default temperature if no cached data
            console.log('Using fallback temperature data');
            return {
                temperature: 70, // Default fallback temperature
                humidity: 50,
                description: 'Unknown (API Error)',
                timestamp: now,
                location: {
                    lat: this.config.lat || 0,
                    lon: this.config.lon || 0,
                    name: 'Unknown Location'
                }
            };
        }
    }

    private async fetchWeatherFromAPI() {
        const params: any = {
            appid: this.config.apiKey,
            units: this.config.units
        };

        // Use coordinates or zip code
        if (this.config.lat && this.config.lon) {
            params.lat = this.config.lat;
            params.lon = this.config.lon;
        } else if (this.config.zipCode) {
            params.zip = `${this.config.zipCode},${this.config.countryCode}`;
        }

        const response = await axios.get(this.API_BASE_URL, {
            params,
            timeout: 10000, // 10 second timeout
        });

        if (!response.data || !response.data.main) {
            throw new Error('Invalid weather data received from API');
        }

        return response;
    }

    public isCacheValid(): boolean {
        const now = Date.now();
        return this.cachedData !== null && (now - this.lastFetchTime) < this.config.cacheDurationMs;
    }

    public getCacheAge(): number {
        if (!this.cachedData) return -1;
        return Date.now() - this.lastFetchTime;
    }

    public getLastUpdateTime(): Date | null {
        return this.cachedData ? new Date(this.cachedData.timestamp) : null;
    }

    public clearCache(): void {
        this.cachedData = null;
        this.lastFetchTime = 0;
        console.log('Weather cache cleared');
    }

    // For testing purposes
    public setMockWeather(temperature: number, description: string = 'Mock Weather'): void {
        this.cachedData = {
            temperature,
            humidity: 50,
            description,
            timestamp: Date.now(),
            location: {
                lat: this.config.lat || 0,
                lon: this.config.lon || 0,
                name: 'Mock Location'
            }
        };
        this.lastFetchTime = Date.now();
        console.log(`Mock weather set to ${temperature}°F`);
    }
}