/**
 * Issue #560 — Text submit must not require VITE_DEEPGRAM_API_KEY in proxy mode (OpenAI or Deepgram proxy).
 */
import {
  isInvalidViteDeepgramKeyForDirectMode,
  shouldBlockTextSubmitForMissingBrowserDeepgramKey,
} from '../../src/utils/deepgramBrowserKeyPolicy';

describe('deepgramBrowserKeyPolicy', () => {
  describe('isInvalidViteDeepgramKeyForDirectMode', () => {
    it('treats empty and placeholders as invalid', () => {
      expect(isInvalidViteDeepgramKeyForDirectMode(undefined)).toBe(true);
      expect(isInvalidViteDeepgramKeyForDirectMode('')).toBe(true);
      expect(isInvalidViteDeepgramKeyForDirectMode('your-deepgram-api-key-here')).toBe(true);
      expect(isInvalidViteDeepgramKeyForDirectMode('your_actual_deepgram_api_key_here')).toBe(true);
      expect(isInvalidViteDeepgramKeyForDirectMode('test-abc')).toBe(true);
    });

    it('treats a non-placeholder key as valid', () => {
      // Artificial hex fixture — not a real Deepgram key; only length/shape matters for this policy test.
      expect(isInvalidViteDeepgramKeyForDirectMode('61a75ff2deadbeef61a75ff2deadbeef61a75ff2')).toBe(false);
    });
  });

  describe('shouldBlockTextSubmitForMissingBrowserDeepgramKey', () => {
    it('never blocks in proxy mode (no browser Deepgram key required)', () => {
      expect(
        shouldBlockTextSubmitForMissingBrowserDeepgramKey({
          connectionMode: 'proxy',
          viteDeepgramApiKey: undefined,
        }),
      ).toBe(false);
      expect(
        shouldBlockTextSubmitForMissingBrowserDeepgramKey({
          connectionMode: 'proxy',
          viteDeepgramApiKey: '',
        }),
      ).toBe(false);
    });

    it('blocks in direct mode when key missing or placeholder', () => {
      expect(
        shouldBlockTextSubmitForMissingBrowserDeepgramKey({
          connectionMode: 'direct',
          viteDeepgramApiKey: undefined,
        }),
      ).toBe(true);
      expect(
        shouldBlockTextSubmitForMissingBrowserDeepgramKey({
          connectionMode: 'direct',
          viteDeepgramApiKey: 'your-deepgram-api-key-here',
        }),
      ).toBe(true);
    });

    it('does not block in direct mode with a real-looking key', () => {
      // Same artificial hex as above — mimics a valid-looking browser key without embedding secrets.
      expect(
        shouldBlockTextSubmitForMissingBrowserDeepgramKey({
          connectionMode: 'direct',
          viteDeepgramApiKey: '61a75ff2deadbeef61a75ff2deadbeef61a75ff2',
        }),
      ).toBe(false);
    });
  });
});
