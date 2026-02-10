/**
 * Shared logger for Issue #412 — OpenTelemetry-style logging abstraction.
 * Single API for component, test-app, and scripts; level-based and supports
 * attributes (e.g. traceId, spanId) for correlation.
 *
 * Bootstrap exception: Fatal startup failures (e.g. cannot load config) may
 * use direct console.error only. All other logging should go through this
 * logger. See docs/issues/ISSUE-412/README.md.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void;

export interface LoggerOptions {
  level?: LogLevel;
  debug?: boolean;
  sink?: LogSink;
  /** Base attributes included in every log (e.g. from child()) */
  attributes?: Record<string, unknown>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function effectiveLevel(opts: LoggerOptions): LogLevel {
  if (opts.debug === true) return 'debug';
  return opts.level ?? 'info';
}

function defaultSink(entry: LogEntry): void {
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

function createLogger(opts: LoggerOptions): Logger {
  const level = effectiveLevel(opts);
  const minOrder = LEVEL_ORDER[level];
  const sink = opts.sink ?? defaultSink;
  const baseAttrs = { ...opts.attributes };

  function emit(level: LogLevel, message: string, attributes?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < minOrder) return;
    const merged = { ...baseAttrs, ...attributes };
    sink({
      level,
      message,
      timestamp: Date.now(),
      attributes: Object.keys(merged).length ? merged : {},
    });
  }

  const logger = {
    debug(msg: string, attrs?: Record<string, unknown>) {
      emit('debug', msg, attrs);
    },
    info(msg: string, attrs?: Record<string, unknown>) {
      emit('info', msg, attrs);
    },
    warn(msg: string, attrs?: Record<string, unknown>) {
      emit('warn', msg, attrs);
    },
    error(msg: string, attrs?: Record<string, unknown>) {
      emit('error', msg, attrs);
    },
    child(attributes: Record<string, unknown>): Logger {
      return createLogger({
        ...opts,
        attributes: { ...baseAttrs, ...attributes },
        sink,
        level,
        debug: opts.debug,
      });
    },
  };

  return logger;
}

export interface Logger {
  debug(message: string, attributes?: Record<string, unknown>): void;
  info(message: string, attributes?: Record<string, unknown>): void;
  warn(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, attributes?: Record<string, unknown>): void;
  child(attributes: Record<string, unknown>): Logger;
}

/**
 * Resolve log level: option > LOG_LEVEL env (Node) > default 'info'.
 */
function resolveLevel(options?: LoggerOptions): LogLevel | undefined {
  if (options?.level) return options.level;
  if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
    const v = process.env.LOG_LEVEL.toLowerCase();
    if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') return v;
  }
  return undefined;
}

/**
 * Get a logger instance. Use options.level or options.debug to control verbosity.
 * In Node, LOG_LEVEL env is used when options.level is not set.
 */
export function getLogger(options?: LoggerOptions): Logger {
  const level = resolveLevel(options);
  return createLogger({ ...options, level: level ?? options?.level ?? 'info' });
}
