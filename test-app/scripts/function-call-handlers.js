/**
 * Common function-call handlers for test-app backend (Issue #407).
 * Not Deepgram- or OpenAI-specific; one set of handlers for both backends (DRY).
 * Contract: see docs/issues/ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md
 */

/**
 * get_current_time — returns current time, optionally in a timezone.
 * @param {object} args - Parsed arguments (e.g. { timezone?: string })
 * @returns {{ time: string }}
 */
function getCurrentTime(args = {}) {
  const tz = args.timezone || 'UTC';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const time = formatter.format(now);
  return { time, timezone: tz };
}

const HANDLERS = {
  get_current_time: getCurrentTime,
};

/**
 * Execute a function by name with parsed arguments.
 * @param {string} name - Function name (e.g. 'get_current_time')
 * @param {object} args - Parsed arguments object
 * @returns {{ content: string } | { error: string }}
 */
export function executeFunctionCall(name, args) {
  const handler = HANDLERS[name];
  if (!handler) {
    return { error: `Unknown function: ${name}` };
  }
  try {
    const result = handler(args || {});
    return { content: JSON.stringify(result) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
