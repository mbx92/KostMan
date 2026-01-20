/**
 * Logger Utility for KostMan
 * 
 * Simple logging utility with support for:
 * - Log levels: debug, info, warn, error
 * - Colored console output (development)
 * - Structured JSON output (production)
 * - Database persistence with auto-purge
 * - Timestamps and context
 */

import { db } from './drizzle';
import { systemLogs, systemSettings } from '../database/schema';
import { lt, eq } from 'drizzle-orm';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

interface RequestLogData {
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
} as const;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default retention days
const DEFAULT_RETENTION_DAYS = 7;

class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;
  private dbEnabled: boolean = true;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.minLevel = this.isProduction ? 'info' : 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatForConsole(entry: LogEntry): string {
    const color = LOG_COLORS[entry.level];
    const reset = LOG_COLORS.reset;
    const levelUpper = entry.level.toUpperCase().padEnd(5);
    
    let output = `${color}[${entry.timestamp}] ${levelUpper}${reset} ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }
    
    return output;
  }

  private formatForProduction(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Save log entry to database (async, non-blocking)
   */
  private async saveToDatabase(
    level: LogLevel,
    message: string,
    context?: LogContext,
    requestData?: RequestLogData
  ): Promise<void> {
    if (!this.dbEnabled) return;
    
    try {
      await db.insert(systemLogs).values({
        level,
        message,
        method: requestData?.method,
        path: requestData?.path,
        statusCode: requestData?.statusCode,
        duration: requestData?.duration,
        userId: requestData?.userId,
        ip: requestData?.ip,
        userAgent: requestData?.userAgent,
        context: context ? JSON.stringify(context) : null,
      });
    } catch (error) {
      // Don't let DB errors break the application
      // Only log to console to avoid infinite loop
      console.error('Failed to save log to database:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, requestData?: RequestLogData): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: this.formatTimestamp(),
      ...(context && { context }),
    };

    // Console output
    const output = this.isProduction 
      ? this.formatForProduction(entry)
      : this.formatForConsole(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }

    // Save to database (non-blocking)
    this.saveToDatabase(level, message, context, requestData).catch(() => {});
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Log a request with full context (saved to database)
   */
  request(
    level: LogLevel,
    message: string,
    requestData: RequestLogData,
    context?: LogContext
  ): void {
    this.log(level, message, context, requestData);
  }

  /**
   * Log an error with stack trace
   */
  exception(message: string, error: Error, context?: LogContext): void {
    this.log('error', message, {
      ...context,
      error: error.message,
      stack: this.isProduction ? undefined : error.stack,
    });
  }

  /**
   * Create a child logger with preset context
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }

  /**
   * Enable/disable database logging
   */
  setDbEnabled(enabled: boolean): void {
    this.dbEnabled = enabled;
  }

  /**
   * Purge logs older than retention days
   */
  async purgeOldLogs(retentionDays?: number): Promise<number> {
    const days = retentionDays ?? DEFAULT_RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const result = await db
        .delete(systemLogs)
        .where(lt(systemLogs.createdAt, cutoffDate))
        .returning({ id: systemLogs.id });
      
      const count = result.length;
      this.info(`Purged ${count} log entries older than ${days} days`);
      return count;
    } catch (error) {
      this.error('Failed to purge old logs', { error: String(error) });
      throw error;
    }
  }

  /**
   * Get retention days from system settings
   */
  async getRetentionDays(): Promise<number> {
    try {
      const setting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'log_retention_days'))
        .limit(1);
      
      if (setting.length > 0) {
        return parseInt(setting[0].value, 10) || DEFAULT_RETENTION_DAYS;
      }
      return DEFAULT_RETENTION_DAYS;
    } catch {
      return DEFAULT_RETENTION_DAYS;
    }
  }

  /**
   * Set retention days in system settings
   */
  async setRetentionDays(days: number): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'log_retention_days'))
        .limit(1);
      
      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({ value: String(days) })
          .where(eq(systemSettings.key, 'log_retention_days'));
      } else {
        await db.insert(systemSettings).values({
          key: 'log_retention_days',
          value: String(days),
          description: 'Number of days to retain system logs before auto-purge',
        });
      }
    } catch (error) {
      this.error('Failed to set retention days', { error: String(error) });
      throw error;
    }
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, this.mergeContext(context));
  }

  exception(message: string, error: Error, context?: LogContext): void {
    this.parent.exception(message, error, this.mergeContext(context));
  }
}

// Singleton instance
export const logger = new Logger();

// Export types for external use
export type { LogLevel, LogContext, LogEntry, RequestLogData };
