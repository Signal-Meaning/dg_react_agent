/**
 * E2E app path constants and helpers
 *
 * Use RELATIVE paths for navigation so Playwright's baseURL (from playwright.config.mjs) is used.
 * baseURL is http or https depending on HTTPS=true in test-app/.env. Never hardcode http://localhost:5173.
 *
 * @see test-app/tests/playwright.config.mjs (baseURL)
 * @see docs/issues/ISSUE-383/E2E-SUMMARY-REPORT.md
 */

/** App root – use with page.goto(APP_ROOT) so config baseURL is applied */
export const APP_ROOT = '/';

/** Test mode – mocks, no real API */
export const APP_TEST_MODE = '/?test-mode=true';

/** Debug mode */
export const APP_DEBUG = '/?debug=true';

/** Test mode + debug */
export const APP_TEST_MODE_DEBUG = '/?test-mode=true&debug=true';

/**
 * Build a relative path with query params for page.goto().
 * Playwright resolves it against baseURL (http or https).
 * @param {Record<string, string>} params - Query params
 * @returns {string} Path like '/?key=value'
 */
export function pathWithQuery(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return APP_ROOT;
  return '/' + '?' + new URLSearchParams(entries).toString();
}
