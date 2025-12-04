import crypto from 'crypto';
import fs from 'fs-extra';
import { LICENSE_PATH, LICENSE_DIR, APP_SECRET } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { getHardwareId } from './hardwareFingerprint';

export interface LicenseData {
  licenseKey: string;
  hardwareId: string;
  locationName?: string;
  locationAddress?: string;
  activatedAt: number;
  expiresAt: number;
  gracePeriodEnd: number;
  lastValidation: number;
  validationToken: string;
  networkDbPath?: string; // Network database path for shared database
  version: number;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const CURRENT_VERSION = 1;

export class LicenseStorage {
  private licensePath: string;
  private encryptionKey: Buffer;

  constructor() {
    this.licensePath = LICENSE_PATH;
    
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
   * Save license data to encrypted file
   */
  async save(licenseData: LicenseData): Promise<void> {
    try {
      // Ensure directory exists
      await fs.ensureDir(LICENSE_DIR);
      
      // Set version
      licenseData.version = CURRENT_VERSION;
      
      // Encrypt data
      const encrypted = this.encrypt(JSON.stringify(licenseData));
      
      // Write to file
      await fs.writeFile(this.licensePath, encrypted, 'utf8');
      
      logger.info('License data saved successfully');
    } catch (error) {
      logger.error('Failed to save license data', error);
      throw error;
    }
  }

  /**
   * Load license data from encrypted file
   */
  async load(): Promise<LicenseData | null> {
    try {
      // Check if file exists
      if (!(await fs.pathExists(this.licensePath))) {
        logger.info('License file does not exist');
        return null;
      }
      
      // Read encrypted data
      const encrypted = await fs.readFile(this.licensePath, 'utf8');
      
      // Decrypt data
      const decrypted = this.decrypt(encrypted);
      
      // Parse JSON
      const licenseData: LicenseData = JSON.parse(decrypted);
      
      // Validate version
      if (licenseData.version !== CURRENT_VERSION) {
        logger.warn('License data version mismatch, may need re-activation');
      }
      
      logger.info('License data loaded successfully');
      return licenseData;
    } catch (error) {
      logger.error('Failed to load license data', error);
      return null;
    }
  }

  /**
   * Delete license data
   */
  async delete(): Promise<void> {
    try {
      if (await fs.pathExists(this.licensePath)) {
        await fs.remove(this.licensePath);
        logger.info('License data deleted');
      }
    } catch (error) {
      logger.error('Failed to delete license data', error);
      throw error;
    }
  }

  /**
   * Check if license file exists
   */
  async exists(): Promise<boolean> {
    return await fs.pathExists(this.licensePath);
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
export const licenseStorage = new LicenseStorage();

