/**
 * Component → OpenAI proxy: legal client JSON `type` values (Issue #533).
 *
 * Single importable source of truth for strict-mode acceptance (no `disallowed_client_message_type`),
 * tests, docs generators, and validators. Binary PCM is separate (not JSON).
 */

/** Canonical `type` strings the proxy recognizes on the client leg (Voice Agent / component protocol). */
export const OPENAI_PROXY_CLIENT_JSON_TYPE = {
  Settings: 'Settings',
  InjectUserMessage: 'InjectUserMessage',
  FunctionCallResponse: 'FunctionCallResponse',
  KeepAlive: 'KeepAlive',
} as const;

export type OpenAIProxyClientJsonTypeKey = keyof typeof OPENAI_PROXY_CLIENT_JSON_TYPE;
export type OpenAIProxyClientJsonTypeValue =
  (typeof OPENAI_PROXY_CLIENT_JSON_TYPE)[OpenAIProxyClientJsonTypeKey];

/**
 * JSON message types accepted without Error when passthrough is off (Issue #533).
 * Order is stable for documentation and human-readable error text.
 */
export const OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES = [
  OPENAI_PROXY_CLIENT_JSON_TYPE.Settings,
  OPENAI_PROXY_CLIENT_JSON_TYPE.InjectUserMessage,
  OPENAI_PROXY_CLIENT_JSON_TYPE.FunctionCallResponse,
  OPENAI_PROXY_CLIENT_JSON_TYPE.KeepAlive,
] as const;

export type OpenAIProxyLegalClientJsonType = (typeof OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES)[number];

/**
 * Subset that the proxy translates to OpenAI Realtime client events (not raw passthrough).
 * Excludes KeepAlive (no-op — not an OpenAI Realtime client event).
 */
export const OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME = [
  OPENAI_PROXY_CLIENT_JSON_TYPE.Settings,
  OPENAI_PROXY_CLIENT_JSON_TYPE.InjectUserMessage,
  OPENAI_PROXY_CLIENT_JSON_TYPE.FunctionCallResponse,
] as const;

export type OpenAIProxyClientJsonTypeTranslatedToRealtime =
  (typeof OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME)[number];

const LEGAL_CLIENT_JSON_TYPE_SET = new Set<string>(OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES);

/** True if `type` is one of {@link OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES} (strict mode). */
export function isLegalOpenAIProxyClientJsonType(type: string | undefined): boolean {
  if (type === undefined || type === '') return false;
  return LEGAL_CLIENT_JSON_TYPE_SET.has(type);
}

/** Fragment after `Allowed: ` in proxy `disallowed_client_message_type` Error.description. */
export function getOpenAIProxyAllowedClientJsonTypesDescription(): string {
  return `${OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME.join(', ')}. KeepAlive is ignored.`;
}
