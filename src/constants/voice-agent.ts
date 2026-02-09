/**
 * Shared constants for the voice agent component.
 * Used by WebSocketManager, useIdleTimeoutManager, and Settings (so the OpenAI proxy
 * can use the same idle timeout in session.update).
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 10000; // 10 seconds
