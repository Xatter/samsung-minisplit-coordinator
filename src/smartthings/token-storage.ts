import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

export interface TokenStore {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string;
}

export class TokenStorage {
    private readonly tokenFilePath: string;
    private readonly encryptionKey: string;

    constructor(dataDir: string = './data', encryptionSecret: string) {
        // Ensure data directory exists
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        this.tokenFilePath = join(dataDir, 'smartthings-tokens.json');
        
        // Create a consistent 32-byte key from the secret
        this.encryptionKey = createHash('sha256').update(encryptionSecret).digest('hex').substring(0, 32);
    }

    private encrypt(text: string): string {
        try {
            const algorithm = 'aes-256-cbc';
            const iv = randomBytes(16);
            // Use createCipheriv with proper key buffer and IV
            const keyBuffer = Buffer.from(this.encryptionKey, 'hex').slice(0, 32);
            const cipher = createCipheriv(algorithm, keyBuffer, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Error encrypting token data:', error);
            throw new Error('Failed to encrypt token data');
        }
    }

    private decrypt(encryptedData: string): string {
        try {
            const algorithm = 'aes-256-cbc';
            const [ivHex, encryptedText] = encryptedData.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            // Use createDecipheriv with proper key buffer and IV
            const keyBuffer = Buffer.from(this.encryptionKey, 'hex').slice(0, 32);
            const decipher = createDecipheriv(algorithm, keyBuffer, iv);
            
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Error decrypting token data:', error);
            throw new Error('Failed to decrypt token data - token file may be corrupted');
        }
    }

    public saveTokens(tokens: TokenStore): void {
        try {
            console.log(`Attempting to save tokens to: ${this.tokenFilePath}`);
            
            // Ensure directory exists
            const dir = dirname(this.tokenFilePath);
            if (!existsSync(dir)) {
                console.log(`Creating directory: ${dir}`);
                mkdirSync(dir, { recursive: true });
            }
            
            const tokenJson = JSON.stringify(tokens, null, 2);
            const encryptedData = this.encrypt(tokenJson);
            
            writeFileSync(this.tokenFilePath, encryptedData, 'utf8');
            
            // Set file permissions to owner read/write only (600)
            try {
                chmodSync(this.tokenFilePath, 0o600);
            } catch (chmodError) {
                console.warn('Could not set token file permissions:', chmodError);
            }
            
            console.log(`SmartThings tokens saved successfully to: ${this.tokenFilePath}`);
            console.log(`File exists: ${existsSync(this.tokenFilePath)}`);
            console.log(`File size: ${readFileSync(this.tokenFilePath, 'utf8').length} bytes`);
        } catch (error) {
            console.error('Error saving tokens to disk:', error);
            console.error('Token file path:', this.tokenFilePath);
            console.error('Directory exists:', existsSync(dirname(this.tokenFilePath)));
            throw new Error('Failed to save tokens to disk');
        }
    }

    public loadTokens(): TokenStore | null {
        try {
            if (!existsSync(this.tokenFilePath)) {
                console.log('No stored SmartThings tokens found');
                return null;
            }

            const encryptedData = readFileSync(this.tokenFilePath, 'utf8');
            const decryptedJson = this.decrypt(encryptedData);
            const tokens = JSON.parse(decryptedJson) as TokenStore;

            // Validate token structure
            if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
                console.warn('Invalid token structure in stored file');
                return null;
            }

            console.log('SmartThings tokens loaded from disk');
            return tokens;
        } catch (error) {
            console.error('Error loading tokens from disk:', error);
            console.log('Tokens may be corrupted - will require re-authentication');
            return null;
        }
    }

    public deleteTokens(): void {
        try {
            if (existsSync(this.tokenFilePath)) {
                // Overwrite file with random data before deletion for security
                const randomData = randomBytes(1024).toString('hex');
                writeFileSync(this.tokenFilePath, randomData);
                writeFileSync(this.tokenFilePath, randomBytes(1024));
                
                // Actually delete the file
                require('fs').unlinkSync(this.tokenFilePath);
                console.log('SmartThings tokens securely deleted from disk');
            }
        } catch (error) {
            console.error('Error deleting tokens from disk:', error);
        }
    }

    public hasStoredTokens(): boolean {
        return existsSync(this.tokenFilePath);
    }

    public getTokenAge(): number {
        try {
            if (!existsSync(this.tokenFilePath)) {
                return -1;
            }
            
            const stats = require('fs').statSync(this.tokenFilePath);
            return Date.now() - stats.mtime.getTime();
        } catch (error) {
            return -1;
        }
    }
}