/**
 * Types related to connections and endpoints
 *
 * Proxy contract: When the component connects to a proxy (e.g. OpenAI Realtime proxy)
 * instead of Deepgram directly, the proxy must speak the same protocol the component
 * expects: Deepgram Voice Agent message types (Settings, SettingsApplied,
 * InjectUserMessage, ConversationText, etc.). See docs/issues/ISSUE-381/API-DISCONTINUITIES.md
 * for the full contract and translation requirements.
 */

/**
 * Connection states for Deepgram services
 */
export type ConnectionState = 'connecting' | 'connected' | 'error' | 'closed';

/**
 * Service types used in status reporting
 */
export type ServiceType = 'transcription' | 'agent';

/**
 * Configuration for Deepgram API endpoints
 */
export interface EndpointConfig {
  /**
   * URL for the transcription WebSocket endpoint
   * Default: "wss://api.deepgram.com/v1/listen"
   */
  transcriptionUrl?: string;
  
  /**
   * URL for the agent WebSocket endpoint
   * Default: "wss://agent.deepgram.com/v1/agent/converse"
   */
  agentUrl?: string;
}

/**
 * Error object for the voice agent path (Deepgram Voice Agent or OpenAI proxy).
 * Used by the component for all agent-side errors (WebSocket, API, timeout, etc.).
 */
export interface VoiceAgentError {
  /**
   * Which service generated the error
   */
  service: ServiceType;

  /**
   * Error code (e.g., "connection_failed", "auth_error")
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Additional error details (original error, etc.)
   */
  details?: unknown;

  /**
   * When true, the error occurred after a successful turn (e.g. OpenAI sends an error after response completes).
   * Hosts can treat this as non-fatal: log or show a soft message and allow the user to continue or reconnect.
   */
  recoverable?: boolean;
}

/** @deprecated Use VoiceAgentError. Kept for backward compatibility. */
export type DeepgramError = VoiceAgentError;

/**
 * Connection options for Deepgram services
 */
export interface ConnectionOptions {
  /**
   * API key for authentication
   */
  apiKey: string;
  
  /**
   * Optional configuration for endpoints
   */
  endpointConfig?: EndpointConfig;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
} 