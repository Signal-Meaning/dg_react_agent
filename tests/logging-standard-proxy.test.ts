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
import { createOpenAIProxyServer } from '../packages/voice-agent-backend/scripts/openai-proxy/server';
import { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { createHash } from 'crypto';

/** InMemoryLogRecordExporter.reset() runs on shutdown; flush export then snapshot before shutdown. */
async function flushOtelLogExport(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('OpenAI proxy logging standard (Issue #437)', () => {
  beforeEach(async () => {
    await shutdownProxyLogger();
    jest.spyOn(console, 'dir').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    it('createOpenAIProxyServer with logLevel omitted still initializes logger (Issue #531 wire-up)', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.OPENAI_PROXY_DEBUG;
      const { wss, server: httpServer } = createOpenAIProxyServer({
        path: '/openai-logging-issue531',
        upstreamUrl: 'ws://127.0.0.1:59998/unused',
      });
      expect(getLoggerForTesting()).not.toBeNull();
      wss.close();
      httpServer.close();
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

  describe('Issue #565: OTel resource, trace context, compact console', () => {
    const expectedW3CTraceFromShortId = (correlation: string): string =>
      createHash('sha256').update(correlation, 'utf8').digest('hex').slice(0, 32);

    const expectedSpanIdFromCorrelation = (correlation: string): string =>
      createHash('sha256').update(`openai-proxy|${correlation}`, 'utf8').digest('hex').slice(0, 16);

    it('attaches service.name dg-openai-proxy on exported log resource', async () => {
      const memory = new InMemoryLogRecordExporter();
      initProxyLogger({ logLevel: 'info', logRecordExporter: memory });
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'hello',
        attributes: {},
      });
      await flushOtelLogExport();
      const finished = memory.getFinishedLogRecords().slice();
      await shutdownProxyLogger();
      expect(finished.length).toBe(1);
      expect(finished[0].resource.attributes['service.name']).toBe('dg-openai-proxy');
      expect(finished[0].resource.attributes['service.version']).toBe('1.0.0');
    });

    it('maps attributes.trace_id to W3C trace/span on LogRecord when trace_id is not 32 hex', async () => {
      const memory = new InMemoryLogRecordExporter();
      initProxyLogger({ logLevel: 'info', logRecordExporter: memory });
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'client connected',
        attributes: { [ATTR_TRACE_ID]: 'c1' },
      });
      await flushOtelLogExport();
      const rec = memory.getFinishedLogRecords()[0];
      await shutdownProxyLogger();
      expect(rec.spanContext).toBeDefined();
      expect(rec.spanContext!.traceId).toBe(expectedW3CTraceFromShortId('c1'));
      expect(rec.spanContext!.spanId).toBe(expectedSpanIdFromCorrelation('c1'));
    });

    it('uses stripped UUID as traceId when trace_id is a standard UUID string', async () => {
      const memory = new InMemoryLogRecordExporter();
      initProxyLogger({ logLevel: 'info', logRecordExporter: memory });
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'x',
        attributes: { [ATTR_TRACE_ID]: uuid },
      });
      await flushOtelLogExport();
      const rec = memory.getFinishedLogRecords()[0];
      await shutdownProxyLogger();
      expect(rec.spanContext!.traceId).toBe(uuid.replace(/-/g, '').toLowerCase());
    });

    it('does not set spanContext when trace_id attribute is absent', async () => {
      const memory = new InMemoryLogRecordExporter();
      initProxyLogger({ logLevel: 'info', logRecordExporter: memory });
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'no correlation',
        attributes: {},
      });
      await flushOtelLogExport();
      const rec = memory.getFinishedLogRecords()[0];
      await shutdownProxyLogger();
      expect(rec.spanContext).toBeUndefined();
    });

    it('compact console export omits traceId when there is no span context', () => {
      initProxyLogger({ logLevel: 'info' });
      const dirSpy = jest.spyOn(console, 'dir').mockImplementation(() => {});
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'plain',
        attributes: {},
      });
      expect(dirSpy).toHaveBeenCalledTimes(1);
      const payload = dirSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('traceId');
      expect(payload).not.toHaveProperty('spanId');
      expect(payload).not.toHaveProperty('traceFlags');
      expect((payload.resource as { attributes: Record<string, unknown> }).attributes['service.name']).toBe(
        'dg-openai-proxy'
      );
      dirSpy.mockRestore();
    });

    it('compact console export includes traceId/spanId/traceFlags when trace_id attribute is set', () => {
      initProxyLogger({ logLevel: 'info' });
      const dirSpy = jest.spyOn(console, 'dir').mockImplementation(() => {});
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'with trace',
        attributes: { [ATTR_TRACE_ID]: 'c1' },
      });
      expect(dirSpy).toHaveBeenCalledTimes(1);
      const payload = dirSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.traceId).toBe(expectedW3CTraceFromShortId('c1'));
      expect(payload.spanId).toBe(expectedSpanIdFromCorrelation('c1'));
      expect(typeof payload.traceFlags).toBe('number');
      dirSpy.mockRestore();
    });
  });
});
