import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { USER_DATA_PATH, APP_SECRET } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { getHardwareId } from './hardwareFingerprint';

export interface UserCredentials {
  username: string;
  password: string;
  createdAt: number;
  licenseKey?: string;
}

const CREDENTIALS_DIR = path.join(USER_DATA_PATH, 'license');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials.dat');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export class CredentialsStorage {
  private credentialsPath: string;
  private encryptionKey: Buffer;

  constructor() {
    this.credentialsPath = CREDENTIALS_PATH;
    
    // Derive encryption key from hardware ID + app secret
    const hardwareId = getHardwareId();
    this.encryptionKey = crypto.pbkdf2Sync(
      APP_SECRET,
      hardwareId,
      100000,
      32,
      'sha256'
    );
  }

  /**
   * Save credentials to encrypted file
   */
  async save(credentials: UserCredentials): Promise<void> {
    try {
      // Ensure directory exists
      await fs.ensureDir(CREDENTIALS_DIR);
      
      // Set creation timestamp if not set
      if (!credentials.createdAt) {
        credentials.createdAt = Date.now();
      }
      
      // Encrypt data
      const encrypted = this.encrypt(JSON.stringify(credentials));
      
      // Write to file
      await fs.writeFile(this.credentialsPath, encrypted, 'utf8');
      
      logger.info('Credentials saved successfully', { username: credentials.username });
    } catch (error) {
      logger.error('Failed to save credentials', error);
      throw error;
    }
  }

  /**
   * Load credentials from encrypted file
   */
  async load(): Promise<UserCredentials | null> {
    try {
      // Check if file exists
      if (!(await fs.pathExists(this.credentialsPath))) {
        logger.info('Credentials file does not exist');
        return null;
      }
      
      // Read encrypted data
      const encrypted = await fs.readFile(this.credentialsPath, 'utf8');
      
      // Decrypt data
      const decrypted = this.decrypt(encrypted);
      
      // Parse JSON
      const credentials: UserCredentials = JSON.parse(decrypted);
      
      logger.info('Credentials loaded successfully', { username: credentials.username });
      return credentials;
    } catch (error) {
      logger.error('Failed to load credentials', error);
      return null;
    }
  }

  /**
   * Delete credentials
   */
  async delete(): Promise<void> {
    try {
      if (await fs.pathExists(this.credentialsPath)) {
        await fs.remove(this.credentialsPath);
        logger.info('Credentials deleted');
      }
    } catch (error) {
      logger.error('Failed to delete credentials', error);
      throw error;
    }
  }

  /**
   * Check if credentials file exists
   */
  async exists(): Promise<boolean> {
    return await fs.pathExists(this.credentialsPath);
  }

  /**
   * Encrypt data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Return: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Singleton instance
export const credentialsStorage = new CredentialsStorage();

