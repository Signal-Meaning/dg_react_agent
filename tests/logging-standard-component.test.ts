/**
 * Issue #437: Tests that the component's logger (src/utils/logger.ts) respects log level.
 * Enforces logging standard per executable; component uses getLogger() with level filtering.
 *
 * @jest-environment node
 */

import { getLogger } from '../src/utils/logger';

describe('Component logger logging standard (Issue #437)', () => {
  describe('level filtering', () => {
    it('does not emit info when level is warn', () => {
      const entries: Array<{ level: string; message: string }> = [];
      const logger = getLogger({
        level: 'warn',
        sink: (e) => entries.push({ level: e.level, message: e.message }),
      });
      logger.info('should be suppressed');
      expect(entries).toHaveLength(0);
    });

    it('emits warn when level is warn', () => {
      const entries: Array<{ level: string; message: string }> = [];
      const logger = getLogger({
        level: 'warn',
        sink: (e) => entries.push({ level: e.level, message: e.message }),
      });
      logger.warn('should appear');
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('warn');
      expect(entries[0].message).toBe('should appear');
    });

    it('emits info when level is info', () => {
      const entries: Array<{ level: string; message: string }> = [];
      const logger = getLogger({
        level: 'info',
        sink: (e) => entries.push({ level: e.level, message: e.message }),
      });
      logger.info('should appear');
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
    });

    it('does not emit debug when level is info', () => {
      const entries: Array<{ level: string; message: string }> = [];
      const logger = getLogger({
        level: 'info',
        sink: (e) => entries.push({ level: e.level, message: e.message }),
      });
      logger.debug('should be suppressed');
      expect(entries).toHaveLength(0);
    });

    it('emits debug when level is debug', () => {
      const entries: Array<{ level: string; message: string }> = [];
      const logger = getLogger({
        level: 'debug',
        sink: (e) => entries.push({ level: e.level, message: e.message }),
      });
      logger.debug('should appear');
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('debug');
    });
  });
});
