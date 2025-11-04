/**
 * 로깅 유틸리티
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    console.error(this.formatMessage(LogLevel.WARN, message, ...args));
  }

  info(message: string, ...args: any[]): void {
    console.error(this.formatMessage(LogLevel.INFO, message, ...args));
  }

  debug(message: string, ...args: any[]): void {
    console.error(this.formatMessage(LogLevel.DEBUG, message, ...args));
  }
}

export const logger = new Logger();

