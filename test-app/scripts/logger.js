/**
 * Shared logger for test-app scripts (Issue #412).
 * Same API as src/utils/logger.ts so backend and scripts align; usable from Node without building the component.
 * LOG_LEVEL env: debug | info | warn | error. Use logger.child({ traceId }) for request-scoped correlation.
 */

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

function resolveLevel(options = {}) {
  if (options.level) return options.level;
  const env = typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL;
  if (env) {
    const v = env.toLowerCase();
    if (LEVEL_ORDER[v] !== undefined) return v;
  }
  return 'info';
}

function defaultSink(entry) {
  if (typeof console === 'undefined') return;
  const payload = entry.attributes && Object.keys(entry.attributes).length
    ? [entry.message, entry.attributes]
    : [entry.message];
  switch (entry.level) {
    case 'debug':
    case 'info':
      console.log(entry.level, ...payload);
      break;
    case 'warn':
      console.warn(entry.level, ...payload);
      break;
    case 'error':
      console.error(entry.level, ...payload);
      break;
  }
}

function createLogger(opts = {}) {
  const level = opts.debug === true ? 'debug' : resolveLevel(opts);
  const minOrder = LEVEL_ORDER[level];
  const sink = opts.sink || defaultSink;
  const baseAttrs = { ...(opts.attributes || {}) };

  function emit(lvl, message, attributes) {
    if (LEVEL_ORDER[lvl] < minOrder) return;
    const merged = { ...baseAttrs, ...(attributes || {}) };
    sink({
      level: lvl,
      message,
      timestamp: Date.now(),
      attributes: Object.keys(merged).length ? merged : {},
    });
  }

  return {
    debug(msg, attrs) { emit('debug', msg, attrs); },
    info(msg, attrs) { emit('info', msg, attrs); },
    warn(msg, attrs) { emit('warn', msg, attrs); },
    error(msg, attrs) { emit('error', msg, attrs); },
    child(attributes) {
      return createLogger({
        ...opts,
        attributes: { ...baseAttrs, ...attributes },
        sink,
        level,
        debug: opts.debug,
      });
    },
  };
}

export function getLogger(options) {
  return createLogger(options || {});
}

/** Generate a simple trace/request ID when client does not send one. */
export function generateTraceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
