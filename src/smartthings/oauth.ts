import axios from 'axios';
import { config } from '../config';

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
}

export interface TokenStore {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string;
}

export class SmartThingsOAuth {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private tokenStore: TokenStore | null = null;

    constructor() {
        this.clientId = config.smartthings.clientId;
        this.clientSecret = config.smartthings.clientSecret;
        this.redirectUri = config.urls.callback;
    }

    getAuthorizationUrl(): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: 'r:devices:* x:devices:* r:locations:*',
            state: this.generateState(),
        });

        return `https://api.smartthings.com/oauth/authorize?${params.toString()}`;
    }

    async exchangeCodeForToken(code: string): Promise<TokenStore> {
        try {
            const response = await axios.post<TokenResponse>('https://api.smartthings.com/oauth/token', {
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri,
                code,
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
                },
            });

            const tokenData = response.data;
            this.tokenStore = {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: Date.now() + (tokenData.expires_in * 1000),
                scope: tokenData.scope,
            };

            return this.tokenStore;
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            throw new Error('Failed to exchange authorization code for access token');
        }
    }

    async refreshAccessToken(): Promise<TokenStore> {
        if (!this.tokenStore?.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post<TokenResponse>('https://api.smartthings.com/oauth/token', {
                grant_type: 'refresh_token',
                refresh_token: this.tokenStore.refreshToken,
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
                },
            });

            const tokenData = response.data;
            this.tokenStore = {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: Date.now() + (tokenData.expires_in * 1000),
                scope: tokenData.scope,
            };

            return this.tokenStore;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw new Error('Failed to refresh access token');
        }
    }

    async getValidToken(): Promise<string> {
        if (!this.tokenStore) {
            throw new Error('No token available. Please authenticate first.');
        }

        if (Date.now() >= this.tokenStore.expiresAt) {
            await this.refreshAccessToken();
        }

        return this.tokenStore.accessToken;
    }

    isAuthenticated(): boolean {
        return this.tokenStore !== null && Date.now() < this.tokenStore.expiresAt;
    }

    setTokenStore(tokenStore: TokenStore): void {
        this.tokenStore = tokenStore;
    }

    getTokenStore(): TokenStore | null {
        return this.tokenStore;
    }

    private generateState(): string {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
}