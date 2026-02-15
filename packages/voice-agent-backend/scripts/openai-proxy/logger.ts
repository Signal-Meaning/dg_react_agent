/**
 * OpenAI proxy – OpenTelemetry logging (Issue #381, #437)
 *
 * Reads LOG_LEVEL (debug | info | warn | error) and only emits logs at or above that level.
 * OPENAI_PROXY_DEBUG=1 is treated as LOG_LEVEL=debug for backward compatibility.
 * See https://opentelemetry.io/docs/specs/otel/logs/
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
  ConsoleLogRecordExporter,
} from '@opentelemetry/sdk-logs';

const LOGGER_NAME = 'openai-proxy';
const LOGGER_VERSION = '1.0.0';

/** OTel SeverityNumber: DEBUG=5, INFO=9, WARN=13, ERROR=17. Emit when severity >= min. */
const SEVERITY_DEBUG = 5;
const SEVERITY_INFO = 9;
const SEVERITY_WARN = 13;
const SEVERITY_ERROR = 17;

let loggerProvider: LoggerProvider | null = null;
let logger: ReturnType<LoggerProvider['getLogger']> | null = null;
/** Minimum severity to emit (numeric). Undefined = no logging. */
let minSeverityNumber: number | undefined;

/** OTel attribute keys used by the proxy (standard + custom). Issue #412: trace_id for correlation. */
export const ATTR_CONNECTION_ID = 'connection_id';
export const ATTR_TRACE_ID = 'trace_id';
export const ATTR_DIRECTION = 'direction';
export const ATTR_MESSAGE_TYPE = 'message_type';
export const ATTR_ERROR_CODE = 'error.code';
export const ATTR_ERROR_MESSAGE = 'error.message';
export const ATTR_UPSTREAM_CLOSE_CODE = 'upstream.close_code';
export const ATTR_UPSTREAM_CLOSE_REASON = 'upstream.close_reason';

export type ProxyLogAttributes = Record<string, string | number | boolean | undefined>;

/** Map level string to OTel SeverityNumber (emit when severity >= this). Issue #437. */
function severityNumberFromLevel(level: string): number {
  const normalized = (level || '').toLowerCase();
  switch (normalized) {
    case 'debug':
      return SEVERITY_DEBUG;
    case 'info':
      return SEVERITY_INFO;
    case 'warn':
      return SEVERITY_WARN;
    case 'error':
      return SEVERITY_ERROR;
    default:
      return SEVERITY_INFO;
  }
}

export interface InitProxyLoggerOptions {
  /** Log level (debug | info | warn | error). Overrides process.env.LOG_LEVEL. */
  logLevel?: string;
}

/**
 * Initialize OpenTelemetry logging for the proxy. Call once with desired log level.
 * Reads options.logLevel or process.env.LOG_LEVEL; initializes OTel when a level is set.
 */
export function initProxyLogger(options?: InitProxyLoggerOptions): void {
  const level = options?.logLevel ?? process.env.LOG_LEVEL;
  if (level !== undefined && level !== '') {
    minSeverityNumber = severityNumberFromLevel(level);
  }
  if (loggerProvider) return;
  if (minSeverityNumber === undefined) return;
  loggerProvider = new LoggerProvider();
  loggerProvider.addLogRecordProcessor(
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
  );
  logger = loggerProvider.getLogger(LOGGER_NAME, LOGGER_VERSION);
}

/**
 * Get the OTel logger; returns null if initProxyLogger() was never called or level not set.
 */
function getLogger(): ReturnType<LoggerProvider['getLogger']> | null {
  return logger;
}

/** For tests only (Issue #437). Returns the internal OTel logger or null. */
export function getLoggerForTesting(): ReturnType<LoggerProvider['getLogger']> | null {
  return logger;
}

/**
 * Emit an OTel LogRecord. No-op if not initialized or severity below LOG_LEVEL.
 * Attributes should use ATTR_* keys where applicable for consistency.
 */
export function emitLog(params: {
  severityNumber: SeverityNumber;
  severityText: string;
  body: string;
  attributes?: ProxyLogAttributes;
}): void {
  if (minSeverityNumber !== undefined && params.severityNumber < minSeverityNumber) {
    return;
  }
  const l = getLogger();
  if (!l) return;
  const attrs = params.attributes;
  const filtered =
    attrs &&
    (Object.fromEntries(
      Object.entries(attrs).filter(([, v]) => v !== undefined)
    ) as Record<string, import('@opentelemetry/api').AttributeValue>);
  l.emit({
    severityNumber: params.severityNumber,
    severityText: params.severityText,
    body: params.body,
    attributes: filtered,
  });
}

/**
 * Shutdown the logger provider (e.g. on process exit). Resets internal state.
 */
export async function shutdownProxyLogger(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.shutdown();
    loggerProvider = null;
    logger = null;
  }
  minSeverityNumber = undefined;
}

export { SeverityNumber };
