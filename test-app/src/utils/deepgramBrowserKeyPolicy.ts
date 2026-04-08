/**
 * When the test-app must require VITE_DEEPGRAM_API_KEY in the browser.
 *
 * In **proxy** mode the page connects to a local backend; Deepgram/OpenAI credentials
 * belong in server env — not VITE_* — so text send must not be gated on a browser Deepgram key.
 *
 * In **direct** mode the component uses `apiKey` from VITE_DEEPGRAM_API_KEY; text submit uses the same constraint.
 */

export type TestAppConnectionMode = 'direct' | 'proxy';

export function isInvalidViteDeepgramKeyForDirectMode(key: string | undefined): boolean {
  if (!key || key.trim() === '') return true;
  if (key === 'your-deepgram-api-key-here' || key === 'your_actual_deepgram_api_key_here') return true;
  if (key.startsWith('test-')) return true;
  return false;
}

/** If true, `handleTextSubmit` should not call `injectUserMessage` and should log the Deepgram setup message. */
export function shouldBlockTextSubmitForMissingBrowserDeepgramKey(options: {
  connectionMode: TestAppConnectionMode;
  viteDeepgramApiKey: string | undefined;
}): boolean {
  if (options.connectionMode === 'proxy') return false;
  return isInvalidViteDeepgramKeyForDirectMode(options.viteDeepgramApiKey);
}
