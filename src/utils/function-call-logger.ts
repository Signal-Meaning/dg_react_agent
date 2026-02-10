/**
 * Centralized logging utility for function calling diagnostics
 * 
 * This utility provides consistent logging for function call-related events
 * and can be conditionally enabled/disabled based on debug flags or test mode.
 */

import { getLogger } from './logger';
import type { FunctionCallRequest } from '../../types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface WindowWithDeepgramTestMode extends Window {
  __DEEPGRAM_TEST_MODE__?: boolean;
}

interface FunctionCallLoggerOptions {
  enabled?: boolean;
  logLevel?: LogLevel;
  prefix?: string;
}

class FunctionCallLogger {
  private enabled: boolean;
  private logLevel: LogLevel;
  private prefix: string;
  private logger = getLogger({ debug: false, level: 'debug' });

  constructor(options: FunctionCallLoggerOptions = {}) {
    this.enabled = options.enabled ?? this.shouldEnableLogging();
    this.logLevel = options.logLevel || 'debug';
    this.prefix = options.prefix || '🔧 [FUNCTION]';
    this.logger = getLogger({ debug: this.enabled, level: this.logLevel });
  }

  private shouldEnableLogging(): boolean {
    // Enable logging in test mode or when explicitly enabled
    if (typeof window !== 'undefined') {
      return !!(window as WindowWithDeepgramTestMode).__DEEPGRAM_TEST_MODE__;
    }
    // In Node.js environment (tests), check for environment variable
    return process.env.DEEPGRAM_FUNCTION_CALL_DEBUG === 'true';
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(message: string, ...args: unknown[]): string {
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    return `${this.prefix} ${message}${formattedArgs ? ' ' + formattedArgs : ''}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) this.logger.debug(this.formatMessage(message, ...args));
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) this.logger.info(this.formatMessage(message, ...args));
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) this.logger.warn(this.formatMessage(message, ...args));
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) this.logger.error(this.formatMessage(message, ...args));
  }

  // Convenience methods for common function call events
  functionCallRequestReceived(request: unknown): void {
    this.debug('FunctionCallRequest received from Deepgram');
    this.debug('Full FunctionCallRequest message:', request);
  }

  functionsArrayInfo(functions: Array<{ name?: string; description?: string }>): void {
    this.debug('Functions array length:', functions.length);
    if (functions.length > 0) {
      this.debug('Functions:', functions.map(f => ({ name: f.name, description: f.description?.substring(0, 50) + '...' })));
    }
  }

  clientSideFunctionDetected(hasClientSide: boolean): void {
    if (hasClientSide) {
      this.debug('Client-side function detected, transitioning to thinking state.');
    }
  }

  callbackInvoked(functionCall: FunctionCallRequest, hasCallback: boolean): void {
    this.debug('Calling onFunctionCallRequest callback with:', {
      id: functionCall.id,
      name: functionCall.name,
      hasCallback: !!hasCallback
    });
  }

  callbackResult(hasResult: boolean): void {
    this.debug('onFunctionCallRequest callback result:', hasResult ? 'returned value' : 'void (imperative)');
  }

  websocketMessageReceived(data: unknown): void {
    this.debug('FunctionCallRequest message received at WebSocket level');
    this.debug('FunctionCallRequest data:', data);
  }
}

// Export singleton instance
export const functionCallLogger = new FunctionCallLogger();

// Export class for custom instances if needed
export { FunctionCallLogger };

