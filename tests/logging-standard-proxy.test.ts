/**
 * Issue #437: Tests that the OpenAI proxy respects LOG_LEVEL (logging standard).
 * Issue #531: When LOG_LEVEL is unset, ERROR logs still emit (upstream failures visible).
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
  ATTR_TRACE_ID,
} from '../packages/voice-agent-backend/scripts/openai-proxy/logger';

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

  describe('Issue #531: ERROR without LOG_LEVEL', () => {
    const origLogLevel = process.env.LOG_LEVEL;
    const origOpenaiProxyDebug = process.env.OPENAI_PROXY_DEBUG;

    afterEach(() => {
      if (origLogLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = origLogLevel;
      }
      if (origOpenaiProxyDebug === undefined) {
        delete process.env.OPENAI_PROXY_DEBUG;
      } else {
        process.env.OPENAI_PROXY_DEBUG = origOpenaiProxyDebug;
      }
    });

    it('initializes OTel and emits ERROR when LOG_LEVEL and OPENAI_PROXY_DEBUG are unset', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.OPENAI_PROXY_DEBUG;
      initProxyLogger();
      const logger = getLoggerForTesting();
      expect(logger).not.toBeNull();
      const emitSpy = jest.spyOn(logger!, 'emit');
      emitLog({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'upstream Realtime error',
        attributes: { 'error.message': 'model_failed', connection_id: 'c1' },
      });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy.mock.calls[0][0]).toMatchObject({
        body: 'upstream Realtime error',
        severityNumber: SeverityNumber.ERROR,
      });
      emitSpy.mockRestore();
    });

    it('does not emit INFO when only the default error floor is active', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.OPENAI_PROXY_DEBUG;
      initProxyLogger();
      const logger = getLoggerForTesting();
      expect(logger).not.toBeNull();
      const emitSpy = jest.spyOn(logger!, 'emit');
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'session.created received',
        attributes: {},
      });
      expect(emitSpy).not.toHaveBeenCalled();
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

  describe('tracing (Phase 3)', () => {
    it('includes trace_id in emitted log record when provided in attributes', () => {
      initProxyLogger({ logLevel: 'info' });
      const logger = getLoggerForTesting();
      if (!logger) {
        throw new Error('Logger not initialized or getLoggerForTesting not available');
      }
      const emitSpy = jest.spyOn(logger, 'emit');
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'client connected',
        attributes: { [ATTR_TRACE_ID]: 'test-trace-123', connection_id: 'c1' },
      });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emitted = emitSpy.mock.calls[0][0];
      expect(emitted?.attributes).toBeDefined();
      expect(emitted?.attributes?.[ATTR_TRACE_ID]).toBe('test-trace-123');
      emitSpy.mockRestore();
    });

    it('includes trace_id in every log for correlation (OTel attribute)', () => {
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
        attributes: { [ATTR_TRACE_ID]: 'correlation-id-456' },
      });
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({ trace_id: 'correlation-id-456' }),
        })
      );
      emitSpy.mockRestore();
    });
  });
});
