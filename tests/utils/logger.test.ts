/**
 * Unit tests for shared logger (Issue #412).
 * TDD: these tests define the logger API and behavior before implementation.
 */

import { getLogger } from '../../src/utils/logger';

describe('logger (Issue #412)', () => {
  const noop = () => {};

  describe('level filtering', () => {
    it('when level is "error", only error() emits', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'error', sink });
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      expect(sink).toHaveBeenCalledTimes(1);
      expect(sink.mock.calls[0][0].level).toBe('error');
      expect(sink.mock.calls[0][0].message).toBe('e');
    });

    it('when level is "warn", warn and error emit', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'warn', sink });
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink.mock.calls[0][0].level).toBe('warn');
      expect(sink.mock.calls[1][0].level).toBe('error');
    });

    it('when level is "info", info, warn and error emit', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'info', sink });
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      expect(sink).toHaveBeenCalledTimes(3);
      expect(sink.mock.calls[0][0].level).toBe('info');
    });

    it('when level is "debug", all levels emit', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'debug', sink });
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      expect(sink).toHaveBeenCalledTimes(4);
      expect(sink.mock.calls[0][0].level).toBe('debug');
    });
  });

  describe('debug flag', () => {
    it('when debug is true, effective level is debug even if level is info', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'info', debug: true, sink });
      log.debug('d');
      expect(sink).toHaveBeenCalledTimes(1);
      expect(sink.mock.calls[0][0].level).toBe('debug');
    });
  });

  describe('structured output', () => {
    it('each log call includes level, message, timestamp, and attributes', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'debug', sink });
      log.info('hello', { foo: 'bar' });
      expect(sink).toHaveBeenCalledTimes(1);
      const entry = sink.mock.calls[0][0];
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('hello');
      expect(entry.attributes).toEqual({ foo: 'bar' });
      expect(typeof entry.timestamp).toBe('number');
      expect(entry.timestamp).toBeLessThanOrEqual(Date.now() + 1000);
      expect(entry.timestamp).toBeGreaterThanOrEqual(Date.now() - 1000);
    });

    it('supports correlation attributes (traceId, spanId, sessionId)', () => {
      const sink = jest.fn();
      const log = getLogger({ level: 'info', sink });
      log.info('request', { traceId: 't1', spanId: 's1', sessionId: 'sess1' });
      expect(sink.mock.calls[0][0].attributes).toMatchObject({
        traceId: 't1',
        spanId: 's1',
        sessionId: 'sess1',
      });
    });
  });

  describe('child context', () => {
    it('child() returns a logger that includes given attributes in every log', () => {
      const sink = jest.fn();
      const parent = getLogger({ level: 'debug', sink });
      const child = parent.child({ traceId: 't1', spanId: 's1' });
      child.info('msg', { extra: 'e' });
      const entry = sink.mock.calls[0][0];
      expect(entry.attributes).toMatchObject({ traceId: 't1', spanId: 's1', extra: 'e' });
    });

    it('child can be nested; attributes merge', () => {
      const sink = jest.fn();
      const root = getLogger({ level: 'debug', sink });
      const child = root.child({ traceId: 't1' }).child({ spanId: 's1' });
      child.info('msg');
      expect(sink.mock.calls[0][0].attributes).toMatchObject({ traceId: 't1', spanId: 's1' });
    });
  });

  describe('default sink', () => {
    it('when no sink provided, does not throw and uses console', () => {
      const spyLog = jest.spyOn(console, 'log').mockImplementation(noop);
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(noop);
      const spyError = jest.spyOn(console, 'error').mockImplementation(noop);
      const log = getLogger({ level: 'debug' });
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      expect(spyLog).toHaveBeenCalled();
      expect(spyWarn).toHaveBeenCalled();
      expect(spyError).toHaveBeenCalled();
      spyLog.mockRestore();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });
  });
});
