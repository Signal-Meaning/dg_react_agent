/**
 * OpenAI proxy – OpenTelemetry logging (Issue #381)
 *
 * When OPENAI_PROXY_DEBUG=1, emits OTel LogRecords (SeverityNumber, body, attributes)
 * so logs can be correlated by connection_id and exported to OTLP/collectors.
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

let loggerProvider: LoggerProvider | null = null;
let logger: ReturnType<LoggerProvider['getLogger']> | null = null;

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

/**
 * Initialize OpenTelemetry logging for the proxy. Call once when debug is true.
 * Uses LoggerProvider + SimpleLogRecordProcessor + ConsoleLogRecordExporter.
 */
export function initProxyLogger(): void {
  if (loggerProvider) return;
  loggerProvider = new LoggerProvider();
  loggerProvider.addLogRecordProcessor(
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
  );
  logger = loggerProvider.getLogger(LOGGER_NAME, LOGGER_VERSION);
}

/**
 * Get the OTel logger; returns null if initProxyLogger() was never called (debug off).
 */
function getLogger(): ReturnType<LoggerProvider['getLogger']> | null {
  return logger;
}

/**
 * Emit an OTel LogRecord. No-op if debug logging was not initialized.
 * Attributes should use ATTR_* keys where applicable for consistency.
 * Undefined attribute values are omitted (OTel attribute values must be defined).
 */
export function emitLog(params: {
  severityNumber: SeverityNumber;
  severityText: string;
  body: string;
  attributes?: ProxyLogAttributes;
}): void {
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
}

export { SeverityNumber };
