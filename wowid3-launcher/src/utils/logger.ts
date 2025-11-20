/**
 * Structured logging utility for the launcher application
 */

import { ENV_CONFIG } from '../config/constants';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  category?: string;
  userId?: string;
  sessionId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners = new Set<(entry: LogEntry) => void>();

  private constructor() {
    this.logLevel = this.getLogLevelFromEnv();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevelFromEnv(): LogLevel {
    switch (ENV_CONFIG.LOG_LEVEL) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(category: string, message: string, context?: LogContext): string {
    const parts = [`[${category}]`, message];

    if (context?.action) {
      parts.push(`| Action: ${context.action}`);
    }

    if (context?.metadata) {
      parts.push(`| Data: ${JSON.stringify(context.metadata)}`);
    }

    return parts.join(' ');
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      error,
    };
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, category, message, context, error);

    // Store log entry
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(entry));

    // Output to console
    const formattedMessage = this.formatMessage(category, message, context);
    const consoleMethod = this.getConsoleMethod(level);

    if (error) {
      consoleMethod(formattedMessage, error);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  public debug(category: string, message: string, context?: LogContext): void {
    if (ENV_CONFIG.ENABLE_DEBUG_LOGS) {
      this.log(LogLevel.DEBUG, category, message, context);
    }
  }

  public info(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  public warn(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  public error(category: string, message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, category, message, context, error);
  }

  public fatal(category: string, message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, category, message, context, error);
  }

  public getLogs(filter?: {
    level?: LogLevel;
    category?: string;
    since?: Date;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level !== undefined) {
      filtered = filtered.filter(log => log.level >= filter.level);
    }

    if (filter?.category) {
      filtered = filtered.filter(log => log.category === filter.category);
    }

    if (filter?.since) {
      const sinceTime = filter.since.getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= sinceTime);
    }

    return filtered;
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public exportLogs(): string {
    return this.logs
      .map(log => {
        const levelName = LogLevel[log.level];
        const base = `${log.timestamp} [${levelName}] [${log.category}] ${log.message}`;
        if (log.error) {
          return `${base}\n${log.error.stack || log.error.message}`;
        }
        return base;
      })
      .join('\n');
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logDebug = (category: string, message: string, context?: LogContext) =>
  logger.debug(category, message, context);

export const logInfo = (category: string, message: string, context?: LogContext) =>
  logger.info(category, message, context);

export const logWarn = (category: string, message: string, context?: LogContext) =>
  logger.warn(category, message, context);

export const logError = (category: string, message: string, error?: Error, context?: LogContext) =>
  logger.error(category, message, error, context);

export const logFatal = (category: string, message: string, error?: Error, context?: LogContext) =>
  logger.fatal(category, message, error, context);

// Log categories
export const LogCategory = {
  AUTH: 'Auth',
  MINECRAFT: 'Minecraft',
  MODPACK: 'Modpack',
  DISCORD: 'Discord',
  NETWORK: 'Network',
  UI: 'UI',
  WINDOW: 'Window',
  STORAGE: 'Storage',
  SYSTEM: 'System',
  UPDATER: 'Updater',
  AUDIO: 'Audio',
} as const;