/**
 * OpenAI proxy – OpenTelemetry logging (Issue #381, #437, #531, #565)
 *
 * Reads LOG_LEVEL (debug | info | warn | error) and only emits logs at or above that level.
 * OPENAI_PROXY_DEBUG=1 is treated as LOG_LEVEL=debug for backward compatibility.
 * When LOG_LEVEL is unset and no logLevel option is passed, the minimum level is **error** so
 * upstream Realtime `error` events are always logged without opt-in (Issue #531).
 * See https://opentelemetry.io/docs/specs/otel/logs/
 */

import { createHash } from 'crypto';
import { context, trace, TraceFlags, isValidTraceId, type Context } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
  type LogRecordExporter,
  type ReadableLogRecord,
} from '@opentelemetry/sdk-logs';

const LOGGER_NAME = 'openai-proxy';
const LOGGER_VERSION = '1.0.0';

/** Stable resource identity for aggregators (Issue #565); merged over default Resource so it wins on collision. */
export const PROXY_OTEL_SERVICE_NAME = 'dg-openai-proxy';

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
/** Issue #532: client leg WebSocket close (integrator-visible code vs upstream 1000). */
export const ATTR_CLIENT_CLOSE_CODE = 'client.close_code';
export const ATTR_CLIENT_CLOSE_REASON = 'client.close_reason';
/** Same-machine correlation with browser `Date.now()` (ms since Unix epoch). Issue #560 manual repro. */
export const ATTR_WALL_CLOCK_MS = 'debug.wall_clock_ms';

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

/**
 * Derive a W3C 128-bit trace id (32 lowercase hex) from the proxy correlation string.
 * Valid 32-hex ids (e.g. UUID without dashes) are reused; otherwise SHA-256 truncated.
 */
export function w3cTraceIdFromCorrelation(correlationId: string): string {
  const compact = correlationId.replace(/-/g, '').toLowerCase();
  if (compact.length === 32 && isValidTraceId(compact)) {
    return compact;
  }
  return createHash('sha256').update(correlationId, 'utf8').digest('hex').slice(0, 32);
}

/** Deterministic 64-bit span id for proxy logs tied to the same correlation id. */
export function w3cSpanIdForProxyCorrelation(correlationId: string): string {
  return createHash('sha256').update(`openai-proxy|${correlationId}`, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Console exporter that mirrors SDK behavior but omits traceId/spanId/traceFlags when there is
 * no span context, so debug JSON lines are not cluttered with `undefined` (Issue #565).
 */
class CompactProxyConsoleLogRecordExporter implements LogRecordExporter {
  export(logs: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
    for (const logRecord of logs) {
      const base: Record<string, unknown> = {
        resource: { attributes: logRecord.resource.attributes },
        timestamp: hrTimeToMicroseconds(logRecord.hrTime),
        severityText: logRecord.severityText,
        severityNumber: logRecord.severityNumber,
        body: logRecord.body,
        attributes: logRecord.attributes,
      };
      const sc = logRecord.spanContext;
      if (sc) {
        base.traceId = sc.traceId;
        base.spanId = sc.spanId;
        base.traceFlags = sc.traceFlags;
      }
      // eslint-disable-next-line no-console -- intentional diagnostic sink for proxy
      console.dir(base, { depth: 3 });
    }
    resultCallback?.({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export interface InitProxyLoggerOptions {
  /** Log level (debug | info | warn | error). Overrides process.env.LOG_LEVEL. */
  logLevel?: string;
  /**
   * When set, log records are exported here instead of the compact console exporter.
   * Intended for tests (Issue #565).
   */
  logRecordExporter?: LogRecordExporter;
}

function buildProxyLoggerResource(): Resource {
  return Resource.default().merge(
    new Resource({
      'service.name': PROXY_OTEL_SERVICE_NAME,
      'service.version': LOGGER_VERSION,
    })
  );
}

/**
 * Initialize OpenTelemetry logging for the proxy. Call once with desired log level.
 * Reads options.logLevel or process.env.LOG_LEVEL. If neither is set, uses minimum **error**
 * so ERROR logs (e.g. upstream Realtime failures) always emit (Issue #531).
 */
export function initProxyLogger(options?: InitProxyLoggerOptions): void {
  const level = options?.logLevel ?? process.env.LOG_LEVEL;
  if (level !== undefined && level !== '') {
    minSeverityNumber = severityNumberFromLevel(level);
  } else {
    minSeverityNumber = SEVERITY_ERROR;
  }
  if (loggerProvider) return;
  const exporter = options?.logRecordExporter ?? new CompactProxyConsoleLogRecordExporter();
  loggerProvider = new LoggerProvider({
    resource: buildProxyLoggerResource(),
  });
  loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporter));
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
  const rawTrace = attrs?.[ATTR_TRACE_ID];
  const correlation =
    typeof rawTrace === 'string' && rawTrace.trim() !== '' ? rawTrace.trim() : undefined;
  let emitContext: Context | undefined;
  if (correlation) {
    const traceId = w3cTraceIdFromCorrelation(correlation);
    const spanId = w3cSpanIdForProxyCorrelation(correlation);
    emitContext = trace.setSpanContext(context.active(), {
      traceId,
      spanId,
      traceFlags: TraceFlags.NONE,
    });
  }
  l.emit({
    severityNumber: params.severityNumber,
    severityText: params.severityText,
    body: params.body,
    attributes: filtered,
    context: emitContext,
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
