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