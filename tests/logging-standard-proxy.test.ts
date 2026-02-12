/**
 * Issue #437: Tests that the OpenAI proxy respects LOG_LEVEL (logging standard).
 * Enforces that each executable treats logging per the standard; proxy must filter by level.
 *
 * @jest-environment node
 */

import {
  initProxyLogger,
  emitLog,
  shutdownProxyLogger,
  getLoggerForTesting,
  SeverityNumber,
} from '../scripts/openai-proxy/logger';

describe('OpenAI proxy logging standard (Issue #437)', () => {
  beforeEach(async () => {
    await shutdownProxyLogger();
  });

  afterAll(async () => {
    await shutdownProxyLogger();
  });

  describe('LOG_LEVEL filtering', () => {
    it('does not emit INFO when LOG_LEVEL=error', () => {
      initProxyLogger({ logLevel: 'error' });
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'session.created received',
        attributes: {},
      });
      expect(emitSpy).not.toHaveBeenCalled();
      emitSpy.mockRestore();
    });

    it('emits INFO when LOG_LEVEL=info', () => {
      initProxyLogger({ logLevel: 'info' });
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'session.created received',
        attributes: {},
      });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      emitSpy.mockRestore();
    });

    it('emits ERROR when LOG_LEVEL=error', () => {
      initProxyLogger({ logLevel: 'error' });
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'upstream error',
        attributes: {},
      });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      emitSpy.mockRestore();
    });

    it('does not emit DEBUG when LOG_LEVEL=info', () => {
      initProxyLogger({ logLevel: 'info' });
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'verbose',
        attributes: {},
      });
      expect(emitSpy).not.toHaveBeenCalled();
      emitSpy.mockRestore();
    });

    it('emits DEBUG when LOG_LEVEL=debug', () => {
      initProxyLogger({ logLevel: 'debug' });
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'verbose',
        attributes: {},
      });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      emitSpy.mockRestore();
    });
  });

  describe('process.env.LOG_LEVEL', () => {
    const origLogLevel = process.env.LOG_LEVEL;

    afterEach(() => {
      process.env.LOG_LEVEL = origLogLevel;
    });

    it('reads LOG_LEVEL from environment when no options passed', () => {
      process.env.LOG_LEVEL = 'warn';
      initProxyLogger();
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'info message',
        attributes: {},
      });
      expect(emitSpy).not.toHaveBeenCalled();
      emitLog({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'warn message',
        attributes: {},
      });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      emitSpy.mockRestore();
    });
  });
});
