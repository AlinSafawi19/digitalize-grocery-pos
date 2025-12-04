import { machineIdSync } from 'node-machine-id';
import os from 'os';
import crypto from 'crypto';

/**
 * Get hardware ID for license activation
 * Combines machine ID with hardware info for uniqueness
 */
export function getHardwareId(): string {
  try {
    const machineId = machineIdSync();
    
    // Secondary: Combine with hardware info for extra uniqueness
    const cpuInfo = os.cpus()[0]?.model || 'unknown';
    const totalMem = os.totalmem();
    const platform = os.platform();
    
    // Create hash of combined info
    const combined = `${machineId}-${cpuInfo}-${totalMem}-${platform}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    return hash.substring(0, 32); // 32-char hardware ID
  } catch {
    // Fallback if machineIdSync fails
    const fallback = `${os.hostname()}-${os.platform()}-${os.totalmem()}`;
    return crypto.createHash('sha256').update(fallback).digest('hex').substring(0, 32);
  }
}

/**
 * Get machine name for display
 */
export function getMachineName(): string {
  return os.hostname();
}

