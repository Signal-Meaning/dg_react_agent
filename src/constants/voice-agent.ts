/**
 * Voice agent timeouts and intervals (client settings):
 *
 * - Server timeout: How long the server keeps the connection open. The server may close the
 *   connection if the client sends nothing over the WebSocket within that period (we send
 *   keepalives to stay under it). When the backend closes for that reason, it sends error
 *   code `SERVER_TIMEOUT_ERROR_CODE` ('idle_timeout') — that is the server timeout firing,
 *   not the client idle timeout. Defined here so tests and docs have a single reference.
 *
 * - Connection timeout: Max time the client waits for the WebSocket to open (connect()).
 *   If the socket does not reach 'open' within this period, we fail with connection_timeout.
 *   Not the same as server timeout or idle timeout.
 *
 * - Keepalive interval: How often the client sends keepalive messages so the server does
 *   not close us (server timeout). Must be less than DEFAULT_SERVER_TIMEOUT_MS.
 *
 * - Idle timeout (client): How long the client keeps its own connection open by watching
 *   server events. The client fires when both the user and the agent are non-busy.
 *   Overridable via agentOptions.idleTimeoutMs.
 */
export const DEFAULT_SERVER_TIMEOUT_MS = 60000;

/** Sentinel for "no server timeout" (e.g. OpenAI with turn_detection: null). Used in proxy docs and when we do not send idle_timeout_ms. */
export const NO_SERVER_TIMEOUT_MS = -1;

/** Error code from the API when the server closed due to its inactivity limit (server timeout). */
export const SERVER_TIMEOUT_ERROR_CODE = 'idle_timeout' as const;

/** Error code from the API when the session hit max duration (e.g. 60 min). */
export const SESSION_MAX_DURATION_ERROR_CODE = 'session_max_duration' as const;

/** Max time to wait for WebSocket to open (connection establishment). */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10000;

/** How often to send keepalive so the server does not close the connection. */
export const DEFAULT_KEEPALIVE_INTERVAL_MS = 5000;

export const DEFAULT_IDLE_TIMEOUT_MS = 10000; // client idle timeout (default 10s)
