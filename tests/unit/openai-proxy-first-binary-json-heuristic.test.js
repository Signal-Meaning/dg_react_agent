/**
 * Issue #414: Unit tests for "first binary chunk must not be JSON" heuristic.
 *
 * The E2E (openai-proxy-tts-diagnostic) asserts that the first binary frame from the proxy
 * is not valid JSON with a type field. If the proxy sends JSON as binary (e.g. conversation.item.added),
 * the component would route it to handleAgentAudio and corrupt playback.
 *
 * This heuristic is used in test-app E2E helpers (isFirstBinaryChunkLikelyJson); we test the same
 * logic here so the regression guard is documented and covered by unit tests.
 */

/**
 * Same logic as test-app/tests/e2e/helpers/test-helpers.js isFirstBinaryChunkLikelyJson.
 * Returns true if base64-decoded payload looks like JSON (object with string 'type').
 */
function isFirstBinaryChunkLikelyJson(base64) {
  if (!base64 || typeof base64 !== 'string') return false;
  try {
    const buf = Buffer.from(base64, 'base64');
    const text = buf.toString('utf8');
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && typeof parsed.type === 'string';
  } catch {
    return false;
  }
}

describe('Issue #414: first binary chunk must not be JSON (proxy integration coverage)', () => {
  it('returns true when payload is valid JSON object with string type (catches JSON sent as binary)', () => {
    const json = JSON.stringify({ type: 'conversation.item.added', item: { id: 'x' } });
    const base64 = Buffer.from(json, 'utf8').toString('base64');
    expect(isFirstBinaryChunkLikelyJson(base64)).toBe(true);
  });

  it('returns true for conversation.item.done (typical JSON event sent as binary in bug)', () => {
    const json = JSON.stringify({ type: 'conversation.item.done', item: { id: 'y' } });
    const base64 = Buffer.from(json, 'utf8').toString('base64');
    expect(isFirstBinaryChunkLikelyJson(base64)).toBe(true);
  });

  it('returns false when payload is PCM (not valid UTF-8 JSON)', () => {
    const pcm = Buffer.alloc(320, 0);
    const base64 = pcm.toString('base64');
    expect(isFirstBinaryChunkLikelyJson(base64)).toBe(false);
  });

  it('returns false when payload is valid JSON but no type field', () => {
    const json = JSON.stringify({ foo: 'bar' });
    const base64 = Buffer.from(json, 'utf8').toString('base64');
    expect(isFirstBinaryChunkLikelyJson(base64)).toBe(false);
  });

  it('returns false when payload is valid JSON but type is not a string', () => {
    const json = JSON.stringify({ type: 123 });
    const base64 = Buffer.from(json, 'utf8').toString('base64');
    expect(isFirstBinaryChunkLikelyJson(base64)).toBe(false);
  });

  it('returns false for empty or invalid base64', () => {
    expect(isFirstBinaryChunkLikelyJson('')).toBe(false);
    expect(isFirstBinaryChunkLikelyJson(null)).toBe(false);
    expect(isFirstBinaryChunkLikelyJson(undefined)).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(isFirstBinaryChunkLikelyJson(123)).toBe(false);
  });
});
