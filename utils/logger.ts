/**
 * SafeNest Logger Utility
 * Controls console output based on environment and log level
 * 
 * Usage:
 *   logger.info('[FeatureName] Message', data);
 *   logger.warn('[FeatureName] Warning message', data);
 *   logger.error('[FeatureName] Error message', error);
 *   logger.debug('[FeatureName] Debug info', data);
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private isDevelopment = (import.meta as any).env?.DEV ?? false;
  private minLevel: LogLevel = 'INFO';

  constructor() {
    // In production, only log WARN and ERROR
    // In development, log everything
    const envLevel = ((import.meta as any).env?.VITE_LOG_LEVEL as LogLevel) || 'INFO';
    this.minLevel = envLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };

    // In production, minimum ERROR
    if (!this.isDevelopment && levels[level] < levels.ERROR) {
      return false;
    }

    return levels[level] >= levels[this.minLevel];
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('DEBUG')) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('INFO')) {
      console.log(`[INFO] ${message}`, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('WARN')) {
      console.warn(`[WARN] ${message}`, data);
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('ERROR')) {
      console.error(`[ERROR] ${message}`, error);
    }
  }
}

export const logger = new Logger();
