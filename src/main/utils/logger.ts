import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.logDir);
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${level}] ${message}${formattedArgs}\n`;
  }

  private async writeToFile(message: string): Promise<void> {
    try {
      await fs.appendFile(this.logFile, message);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage(level, message, ...args);
    
    // Console output
    if (level === LogLevel.ERROR) {
      console.error(formattedMessage.trim());
    } else if (level === LogLevel.WARN) {
      console.warn(formattedMessage.trim());
    } else {
      console.log(formattedMessage.trim());
    }

    // File output (async, don't wait)
    this.writeToFile(formattedMessage).catch(() => {
      // Silently fail if file write fails
    });
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  // POS-specific logging methods
  posTransaction(message: string, data: {
    transactionId?: number;
    transactionNumber?: string;
    type?: string;
    cashierId?: number;
    total?: number;
    itemCount?: number;
    [key: string]: unknown;
  }): void {
    this.info(`[POS Transaction] ${message}`, data);
  }

  posPayment(message: string, data: {
    transactionId?: number;
    paymentId?: number;
    amount?: number;
    received?: number;
    change?: number;
    cashierId?: number;
    [key: string]: unknown;
  }): void {
    this.info(`[POS Payment] ${message}`, data);
  }

  posCart(message: string, data: {
    action?: string;
    productId?: number;
    productName?: string;
    quantity?: number;
    userId?: number;
    [key: string]: unknown;
  }): void {
    this.info(`[POS Cart] ${message}`, data);
  }

  posReceipt(message: string, data: {
    transactionId?: number;
    transactionNumber?: string;
    filepath?: string;
    [key: string]: unknown;
  }): void {
    this.info(`[POS Receipt] ${message}`, data);
  }

  posAction(message: string, data: {
    action?: string;
    userId?: number;
    details?: string;
    [key: string]: unknown;
  }): void {
    this.info(`[POS Action] ${message}`, data);
  }
}

export const logger = new Logger();

