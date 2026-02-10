import { DEFAULT_IDLE_TIMEOUT_MS } from '../../constants/voice-agent';
import { ConnectionState, DeepgramError, ServiceType } from '../../types';
import { AgentResponseType } from '../../types/agent';
import { functionCallLogger } from '../function-call-logger';
import { getLogger, type Logger } from '../logger';

/**
 * Event types emitted by the WebSocketManager
 */
export type WebSocketEvent = 
  | { type: 'state'; state: ConnectionState; isReconnection?: boolean }
  | { type: 'message'; data: unknown }
  | { type: 'binary'; data: ArrayBuffer }
  | { type: 'keepalive'; data: { type: string; timestamp: number; service: ServiceType } }
  | { type: 'error'; error: DeepgramError };

/**
 * Options for the WebSocketManager
 */
export interface WebSocketManagerOptions {
  /** 
   * URL to connect to 
   */
  url: string;
  
  /** 
   * API key for authentication (required for direct connection, empty for proxy mode)
   */
  apiKey?: string;
  
  /**
   * Authentication token for backend proxy (optional)
   * Used when connecting through backend proxy instead of directly to Deepgram
   */
  authToken?: string;
  
  /** 
   * Service type (for error reporting)
   */
  service: ServiceType;
  
  /**
   * Additional query parameters to add to the connection URL
   */
  queryParams?: Record<string, string | boolean | number>;
  
  /**
   * How often to send keepalive messages (in ms)
   */
  keepaliveInterval?: number;
  
  /**
   * Maximum time to wait for a connection before timing out (in ms)
   */
  connectionTimeout?: number;
  
  /**
   * Maximum time of inactivity before closing the connection (in ms)
   */
  idleTimeout?: number;
  
  /**
   * Enable verbose logging
   */
  debug?: boolean;
  
  /**
   * Callback for meaningful user activity (for idle timeout management)
   */
  onMeaningfulActivity?: (activity: string) => void;
}

/**
 * Default WebSocketManager options.
 * idleTimeout uses shared DEFAULT_IDLE_TIMEOUT_MS so it matches Settings (e.g. OpenAI proxy session).
 */
const DEFAULT_OPTIONS: Partial<WebSocketManagerOptions> = {
  keepaliveInterval: 5000, // 5 seconds - keep connection alive to prevent server timeout
  connectionTimeout: 10000, // 10 seconds - reasonable timeout for connection establishment
  idleTimeout: DEFAULT_IDLE_TIMEOUT_MS,
  debug: false,
};

import { normalizeApiKeyForWebSocket } from '../api-key-normalizer';

/**
 * Manages a WebSocket connection to Deepgram API endpoints
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private options: WebSocketManagerOptions;
  private eventListeners: Array<(event: WebSocketEvent) => void> = [];
  private keepaliveIntervalId: number | null = null;
  private connectionTimeoutId: number | null = null;
  private idleTimeoutId: number | null = null;
  private connectionState: ConnectionState = 'closed';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  // private reconnectDelay = 1000; // Start with 1 second - Unused for now
  private hasEverConnected = false;
  private idleTimeoutDisabled = false; // Flag to disable idle timeout resets
  private settingsSent = false; // Track if Settings has been sent (for agent service only)
  private logger: Logger;

  /**
   * Creates a new WebSocketManager
   */
  constructor(options: WebSocketManagerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = getLogger({ debug: !!this.options.debug });
    this.log('WebSocketManager created');
  }

  /**
   * Logs a message if debug is enabled
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    const msg = args.length > 0 && typeof args[0] === 'string' ? args[0] : '';
    const rest = args.length > 1 ? args.slice(1) : [];
    this.logger.debug(`[WebSocketManager:${this.options.service}] ${msg}`, rest.length ? { extra: rest } : undefined);
  }

  /**
   * Builds the WebSocket URL with query parameters
   */
  private buildUrl(): string {
    const url = new URL(this.options.url);
    
    // In proxy mode, add auth token as query parameter if provided
    // In direct mode, apiKey is handled via WebSocket protocol
    const isProxyMode = !this.options.apiKey || this.options.apiKey === '';
    if (isProxyMode && this.options.authToken) {
      url.searchParams.append('token', this.options.authToken);
    }
    
    // Add query parameters if provided
    if (this.options.queryParams) {
      // Format Deepgram specific parameters
      Object.entries(this.options.queryParams).forEach(([key, value]) => {
        // Handle boolean values specially for Deepgram API
        if (typeof value === 'boolean') {
          if (value === true) {
            url.searchParams.append(key, 'true');
          }
          // Skip false values as they should be omitted rather than set to 'false'
        } else {
          const stringValue = String(value);
          // Skip empty string values as they can cause "bad response from server" errors
          if (stringValue && stringValue.trim() !== '') {
            url.searchParams.append(key, stringValue);
          }
        }
      });
    }
    
    // Note: In direct mode, apiKey is passed via WebSocket protocol array ['token', apiKey]
    // We don't add it to query params here as it's handled in the WebSocket constructor
    // In proxy mode, no apiKey is used - backend proxy handles authentication
    
    this.log('Built URL with params:', url.toString());
    return url.toString();
  }

  /**
   * Adds an event listener
   */
  public addEventListener(listener: (event: WebSocketEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  /**
   * Emits an event to all listeners
   */
  private emit(event: WebSocketEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Error in WebSocketManager event listener', { error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  /**
   * Updates the connection state and emits a state event
   */
  private updateState(state: ConnectionState, isReconnection?: boolean): void {
    this.connectionState = state;
    this.emit({ type: 'state', state, isReconnection });
  }

  /**
   * Issue #353: Check if binary data contains JSON agent message
   * If it does, parse and route as 'message' event; otherwise route as 'binary' event
   */
  /**
   * Handles binary data (ArrayBuffer or Blob) that may contain JSON agent messages.
   * 
   * Attempts to decode the binary data as UTF-8 and parse as JSON. If the JSON
   * contains a known agent message type (from AgentResponseType enum), routes it
   * as a 'message' event. Otherwise, routes as 'binary' event.
   * 
   * Supported agent message types:
   * - FunctionCallRequest
   * - SettingsApplied
   * - ConversationText
   * - Error
   * - And all other AgentResponseType values
   * 
   * @param arrayBuffer - The binary data to process
   * @param source - The original source type ('ArrayBuffer' or 'Blob') for logging
   * @private
   */
  private handleBinaryData(arrayBuffer: ArrayBuffer, source: 'ArrayBuffer' | 'Blob'): void {
    try {
      // Try to decode as UTF-8 text
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(arrayBuffer);
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        
        // Check if it's an agent message (has a 'type' field)
        if (data && typeof data === 'object' && 'type' in data) {
          const messageType = data.type;
          
          // Validate it's a known agent message type from AgentResponseType enum
          // This prevents non-agent JSON from being incorrectly routed as messages
          if (Object.values(AgentResponseType).includes(messageType as AgentResponseType)) {
            // Log that we detected JSON in binary data
            this.log(`[Issue #353] Detected JSON agent message in binary ${source}: ${messageType}`);
            
            // Special handling for FunctionCallRequest (the main use case)
            if (messageType === AgentResponseType.FUNCTION_CALL_REQUEST) {
              this.log(`[Issue #353] Parsing FunctionCallRequest from binary ${source}`);
              functionCallLogger.websocketMessageReceived(data);
            }
            
            // Route as 'message' event (same as text JSON messages)
            this.log(`📨 [WEBSOCKET.onmessage] About to emit message event with type: ${messageType} (from binary ${source})`);
            this.emit({ type: 'message', data });
            this.log(`📨 [WEBSOCKET.onmessage] Emit completed for message type: ${messageType} (from binary ${source})`);
            return;
          } else {
            // Has 'type' field but not a known agent message type - route as binary
            this.log(`Binary ${source} contains JSON with unknown type '${messageType}', routing as binary event`);
          }
        }
      } catch (jsonError) {
        // Not valid JSON, continue to route as binary
        this.log(`Binary ${source} does not contain valid JSON, routing as binary event`);
      }
    } catch (decodeError) {
      // Failed to decode as UTF-8, continue to route as binary
      this.log(`Binary ${source} could not be decoded as UTF-8, routing as binary event`);
    }
    
    // Not JSON or not an agent message - route as binary event
    this.log(`Emitting binary event for ${source} (not JSON agent message)`);
    this.emit({ type: 'binary', data: arrayBuffer });
  }

  /**
   * Connects to the WebSocket
   */
  public connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.log('WebSocket already connected or connecting');
      return Promise.resolve();
    }

    this.log('Connecting to WebSocket...');
    this.updateState('connecting');

    return new Promise((resolve, reject) => {
      try {
        const url = this.buildUrl();
        this.log(`Connecting to ${url}`);
        
        // Determine if we're in proxy mode (no API key)
        const isProxyMode = !this.options.apiKey || this.options.apiKey === '';
        
        if (this.options.debug) {
          this.logger.debug(`[WebSocketManager.connect] URL=${url}, isProxyMode=${isProxyMode}, service=${this.options.service}`);
        }
        
        // Create WebSocket
        // In direct mode: use token protocol with API key
        // In proxy mode: connect without token protocol (backend handles auth)
        if (isProxyMode) {
          this.ws = new WebSocket(url);
          if (this.options.debug) {
            this.logger.debug('[WebSocketManager.connect] Created WebSocket without token protocol (proxy mode)');
          }
        } else {
          // For WebSocket authentication: Use normalized API key (raw key, prefix stripped if present)
          const apiKeyForAuth = normalizeApiKeyForWebSocket(this.options.apiKey);
          if (!apiKeyForAuth) {
            throw new Error('API key is required for direct mode connection');
          }
          this.ws = new WebSocket(url, ['token', apiKeyForAuth]);
          if (this.options.debug) {
            this.logger.debug('[WebSocketManager.connect] Created WebSocket with token protocol (direct mode)');
          }
        }
        // Ensure binary frames (e.g. TTS PCM from proxy) are delivered as ArrayBuffer for synchronous handling
        this.ws.binaryType = 'arraybuffer';
        
        // Log socket readyState
        this.log('Initial readyState:', this.ws.readyState);
        
        // Set connection timeout
        this.connectionTimeoutId = window.setTimeout(() => {
          if (this.connectionState === 'connecting') {
            const error: DeepgramError = {
              service: this.options.service,
              code: 'connection_timeout',
              message: 'Connection timed out',
            };
            this.log('Connection timeout reached');
            this.emit({ type: 'error', error });
            this.updateState('error');
            this.close();
            reject(new Error('Connection timed out'));
          }
        }, this.options.connectionTimeout);

        // Set up event handlers
        this.ws.onopen = () => {
          this.log('WebSocket connected');
          window.clearTimeout(this.connectionTimeoutId!);
          this.connectionTimeoutId = null;
          
          // Track if this is a reconnection
          const isReconnection = this.hasEverConnected;
          this.hasEverConnected = true;
          
          this.updateState('connected', isReconnection);
          this.enableIdleTimeoutResets(); // Re-enable idle timeout resets on new connection
          
          // For agent service, don't start keepalive until Settings is sent
          // This ensures Settings is always the first message after connection
          if (this.options.service === 'agent') {
            this.log('Agent service: Keepalive will start after Settings is sent');
            this.settingsSent = false; // Reset on new connection
            // Keepalive will be started when Settings is sent via markSettingsSent()
          } else {
            // For transcription service, start keepalive immediately
            this.startKeepalive();
          }
          
          this.startIdleTimeout();
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          // Log the type of data received for every message
          this.log(`📨 [WEBSOCKET.onmessage] Received message from server`);
          this.log(`Received message data type: ${typeof event.data}, is ArrayBuffer: ${event.data instanceof ArrayBuffer}, is Blob: ${event.data instanceof Blob}`);
          
          if (typeof event.data === 'string') {
            try {
              this.log(`📨 [WEBSOCKET.onmessage] Raw string message:`, event.data);
              const data = JSON.parse(event.data);
              this.log(`📨 [WEBSOCKET.onmessage] Parsed JSON message:`, data);
              
              // Issue #336: Enhanced logging for FunctionCallRequest messages
              if (data.type === 'FunctionCallRequest') {
                functionCallLogger.websocketMessageReceived(data);
              }
              
              // Only reset idle timeout on meaningful user activity (not every protocol message)
              const shouldResetTimeout = this.shouldResetIdleTimeout(data);
              if (shouldResetTimeout) {
                // If there's meaningful content, reset the idle timeout
                // But DON'T automatically re-enable idle timeout resets if they're disabled
                // This prevents the idle timeout from firing during agent responses
                if (this.idleTimeoutDisabled) {
                  this.log(`🎯 [IDLE_TIMEOUT] NOT re-enabling idle timeout resets due to meaningful activity: ${data.type} (resets are disabled)`);
                  // Don't re-enable idle timeout resets - let the component manage this
                } else {
                  // Only reset on truly meaningful user activity, not on every protocol message
                  if (this.isMeaningfulUserActivity(data)) {
                    this.resetIdleTimeout(data);
                  }
                }
              }
              
              this.log(`📨 [WEBSOCKET.onmessage] About to emit message event with type:`, data.type);
              this.emit({ type: 'message', data });
              this.log(`📨 [WEBSOCKET.onmessage] Emit completed for message type:`, data.type);
            } catch (error) {
              this.log('Error parsing message:', error);
              this.emit({ 
                type: 'error', 
                error: {
                  service: this.options.service,
                  code: 'parse_error',
                  message: 'Failed to parse WebSocket message',
                  details: error,
                }
              });
            }
          } else if (event.data instanceof ArrayBuffer) {
            // Issue #353: Check if binary ArrayBuffer contains JSON agent message
            this.log('Received ArrayBuffer binary data, checking if it contains JSON...');
            this.handleBinaryData(event.data, 'ArrayBuffer');
          } else if (event.data instanceof Blob) {
            // Issue #353: Check if binary Blob contains JSON agent message before converting
            this.log(`Received Blob binary data (size: ${event.data.size}), checking if it contains JSON...`);
            
            // Convert Blob to ArrayBuffer first to check for JSON
            event.data.arrayBuffer().then(arrayBuffer => {
              this.handleBinaryData(arrayBuffer, 'Blob');
            }).catch(error => {
              this.log('Error converting Blob to ArrayBuffer:', error);
              this.emit({
                type: 'error',
                error: {
                  service: this.options.service,
                  code: 'blob_conversion_error',
                  message: 'Failed to convert Blob to ArrayBuffer',
                  details: error,
                }
              });
            });
          } else {
            // Log if data is neither string, ArrayBuffer, nor Blob
            this.log('Received message data of unexpected type:', event.data);
          }
        };

        this.ws.onerror = (event) => {
          this.log('WebSocket error event:', event);
          const errorMessage = `WebSocket connection error for ${this.options.service}`;
          this.emit({ 
            type: 'error', 
            error: {
              service: this.options.service,
              code: 'websocket_error',
              message: errorMessage,
              details: {
                type: event.type,
                target: event.target?.constructor?.name || 'WebSocket',
                readyState: (event.target as WebSocket)?.readyState
              }
            }
          });
          this.updateState('error');
          reject(new Error(errorMessage));
        };

        this.ws.onclose = (event) => {
          // Always log connection close (not gated by debug) so operators see disconnects (Issue #412: use logger)
          this.logger.info(`WebSocket closed: code=${event.code}, reason='${event.reason || ''}', wasClean=${event.wasClean}`, { service: this.options.service });
          this.log(`WebSocket closed: code=${event.code}, reason='${event.reason}', wasClean=${event.wasClean}`);
          this.stopKeepalive();
          this.stopIdleTimeout();
          window.clearTimeout(this.connectionTimeoutId!);
          this.connectionTimeoutId = null;
          
          // Reset settingsSent flag on close (for agent service)
          if (this.options.service === 'agent') {
            this.settingsSent = false;
          }
          
          // Check if we were connected before updating state
          const wasConnected = this.connectionState === 'connected';
          this.updateState('closed');
          
          // LAZY RECONNECTION: Do not attempt automatic reconnection
          // Connections will timeout naturally and require manual reconnection
          // via resumeWithText() or resumeWithAudio() methods
          if (wasConnected) {
            this.log('🔄 [LAZY_RECONNECT] Connection closed - lazy reconnection enabled, waiting for manual trigger');
            this.log(`🔄 [LAZY_RECONNECT] Close details: code=${event.code}, reason='${event.reason}', wasClean=${event.wasClean}`);
            this.log(`🔄 [LAZY_RECONNECT] Previous connection state: ${this.connectionState}`);
            this.log(`🔄 [LAZY_RECONNECT] Reconnect attempts would have been: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          }
        };
      } catch (error) {
        this.log('Failed to create WebSocket:', error);
        this.updateState('error');
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  // private attemptReconnect(): void { // Unused for now
  //   this.reconnectAttempts++;
  //   const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1));
  //   
  //   this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
  //   
  //   setTimeout(() => {
  //     this.connect().catch(error => {
  //       this.log('Reconnection failed:', error);
  //     });
  //   }, delay);
  // }

  /**
   * Starts the keepalive interval
   */
  public startKeepalive(): void {
    if (this.keepaliveIntervalId !== null) {
      this.stopKeepalive();
    }
    
    // Only start keepalive if interval is greater than 0
    if (this.options.keepaliveInterval && this.options.keepaliveInterval > 0) {
      this.keepaliveIntervalId = window.setInterval(() => {
        this.sendKeepalive();
      }, this.options.keepaliveInterval);

      this.log('Started keepalive interval');
    } else {
      this.log('Keepalive disabled - connections will timeout naturally');
    }
  }

  /**
   * Stops the keepalive interval
   */
  public stopKeepalive(): void {
    if (this.keepaliveIntervalId !== null) {
      window.clearInterval(this.keepaliveIntervalId);
      this.keepaliveIntervalId = null;
      this.log('Stopped keepalive interval');
      this.log('🔧 [WebSocketManager] Keepalive interval cleared and stopped');
    } else {
      this.log('No keepalive interval to stop');
      this.log('🔧 [WebSocketManager] No keepalive interval was running to stop');
    }
  }

  /**
   * Sends a keepalive message
   * For agent service, only sends if Settings has been sent first
   */
  private sendKeepalive(): void {
    // For agent service, ensure Settings is sent before KeepAlive
    if (this.options.service === 'agent' && !this.settingsSent) {
      this.log('Keepalive blocked: Settings must be sent before KeepAlive for agent service');
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Only emit keepalive events in debug mode to reduce noise
      if (this.options.debug) {
        this.emit({ 
          type: 'keepalive', 
          data: { 
            type: 'KeepAlive', 
            timestamp: Date.now(),
            service: this.options.service 
          } 
        });
      }
      
      try {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
      } catch (error) {
        this.log('Error sending keepalive:', error);
      }
    }
  }
  
  /**
   * Checks if Settings has been sent
   * @returns true if Settings message has been sent
   */
  public hasSettingsBeenSent(): boolean {
    return this.settingsSent;
  }

  /**
   * Mark that Settings has been sent (for agent service)
   * This allows keepalive to start sending KeepAlive messages
   */
  public markSettingsSent(): void {
    if (this.options.service === 'agent') {
      this.settingsSent = true;
      this.log('Settings sent - keepalive can now send KeepAlive messages');
      // Start keepalive now that Settings has been sent
      if (this.connectionState === 'connected' && this.keepaliveIntervalId === null) {
        this.startKeepalive();
      }
    }
  }

  /**
   * Starts the idle timeout
   * 
   * ISSUE #149 FIX: Individual WebSocket timeouts are disabled in favor of
   * the centralized IdleTimeoutService to prevent conflicts and ensure
   * coordinated timeout behavior across all services.
   */
  public startIdleTimeout(): void {
    this.log(`🎯 [IDLE_TIMEOUT] Using centralized IdleTimeoutService for ${this.options.service}`);
    // Individual WebSocket timeouts are disabled - IdleTimeoutService handles all timeout logic
  }

  /**
   * Stops the idle timeout
   */
  private stopIdleTimeout(): void {
    if (this.idleTimeoutId !== null) {
      window.clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
      this.log(`🎯 [IDLE_TIMEOUT] Stopped idle timeout for ${this.options.service}`);
    }
  }

  /**
   * Determines if a message should reset the idle timeout
   */
  private shouldResetIdleTimeout(data: unknown): boolean {
    // Always reset on agent service messages (they're meaningful)
    if (this.options.service === 'agent') {
      return true;
    }
    
    // For transcription service, only reset on meaningful messages
    if (this.options.service === 'transcription') {
      // Don't reset on empty Results (silence)
      if (data.type === 'Results') {
        const hasAlternatives = data.alternatives && data.alternatives.length > 0;
        const hasTranscript = hasAlternatives && data.alternatives[0].transcript && data.alternatives[0].transcript.trim().length > 0;
        
        // Only reset if there's actual transcript content
        if (hasTranscript) {
          this.log(`Resetting idle timeout - meaningful transcript: "${data.alternatives[0].transcript}"`);
          return true;
        } else {
          this.log(`NOT resetting idle timeout - empty transcript`);
          return false;
        }
      }
      
      // Reset on other meaningful transcription messages (UtteranceEnd, UserStoppedSpeaking, etc.)
      return true;
    }
    
    return true; // Default to reset for unknown services
  }

  /**
   * Determines if a message represents meaningful user activity (not just protocol messages)
   * 
   * Note: ConversationText messages (both user and assistant) are redundant for idle timeout
   * management because:
   * - User text activity should be handled via onUserMessage callback/state updates
   * - Agent activity is already tracked via AgentThinking/AgentStartedSpeaking messages and state changes
   */
  private isMeaningfulUserActivity(data: unknown): boolean {
    // Only reset idle timeout on ACTUAL activity indicators, not transcript messages
    
    // For agent service, reset on activity indicators
    if (this.options.service === 'agent') {
      // User text injection (explicit user activity)
      if (data.type === 'InjectUserMessage') {
        this.options.onMeaningfulActivity?.(data.type);
        return true;
      }
      
      // Agent activity that should keep connection alive
      // Note: These are handled by agent state changes, but we keep them here
      // as a fallback in case state hasn't updated yet
      const agentActivityMessages = ['AgentThinking', 'AgentStartedSpeaking', 'AgentAudioDone']; // Agent responding
      
      if (agentActivityMessages.includes(data.type)) {
        this.options.onMeaningfulActivity?.(data.type);
        return true;
      }
      
      // ConversationText messages (both user and assistant) are redundant:
      // - User text: Should be handled via onUserMessage callback/state updates
      // - Assistant text: Agent activity already tracked via state changes and activity messages
      // So we don't reset timeout on ConversationText messages
      
      return false;
    }
    
    // For transcription service, only reset on actual speech activity
    if (this.options.service === 'transcription') {
      // Only reset on actual speech content, not empty results or protocol messages
      if (data.type === 'Results') {
        const hasAlternatives = data.alternatives && data.alternatives.length > 0;
        const hasTranscript = hasAlternatives && data.alternatives[0].transcript && data.alternatives[0].transcript.trim().length > 0;
        if (hasTranscript) {
          this.options.onMeaningfulActivity?.(`Results with transcript: "${data.alternatives[0].transcript}"`);
        }
        return hasTranscript; // Only reset if there's actual transcript content
      }
      
      // Don't reset on other transcription messages (UtteranceEnd, etc.)
      // These are protocol messages, not user activity
      return false;
    }
    
    return false; // Default to not reset for unknown services
  }

  /**
   * Resets the idle timeout (call when activity occurs)
   * 
   * ISSUE #149 FIX: Individual WebSocket timeout resets are disabled in favor of
   * the centralized IdleTimeoutService to prevent conflicts and ensure
   * coordinated timeout behavior across all services.
   */
  public resetIdleTimeout(triggerMessage?: unknown): void {
    const triggerInfo = triggerMessage ? ` (triggered by: ${triggerMessage.type || 'unknown'})` : '';
    this.log(`🎯 [IDLE_TIMEOUT] Using centralized IdleTimeoutService for ${this.options.service}${triggerInfo}`);
    // Individual WebSocket timeout resets are disabled - IdleTimeoutService handles all timeout logic
  }

  /**
   * Disables idle timeout resets (for UtteranceEnd scenarios)
   * 
   * ISSUE #149 FIX: Individual WebSocket timeout management is disabled in favor of
   * the centralized IdleTimeoutService to prevent conflicts and ensure
   * coordinated timeout behavior across all services.
   */
  public disableIdleTimeoutResets(): void {
    this.log(`🎯 [IDLE_TIMEOUT] Using centralized IdleTimeoutService for ${this.options.service}`);
    // Individual WebSocket timeout management is disabled - IdleTimeoutService handles all timeout logic
  }

  /**
   * Re-enables idle timeout resets (for reconnection scenarios)
   * 
   * ISSUE #149 FIX: Individual WebSocket timeout management is disabled in favor of
   * the centralized IdleTimeoutService to prevent conflicts and ensure
   * coordinated timeout behavior across all services.
   */
  public enableIdleTimeoutResets(): void {
    this.log(`🎯 [IDLE_TIMEOUT] Using centralized IdleTimeoutService for ${this.options.service}`);
    // Individual WebSocket timeout management is disabled - IdleTimeoutService handles all timeout logic
  }


  /**
   * Sends a JSON message over the WebSocket
   */
  public sendJSON(data: unknown): boolean {
    const dataType = data && typeof data === 'object' && 'type' in data ? (data as { type: string }).type : 'unknown';
    
    if (!this.ws) {
      this.log(`❌ Cannot send ${dataType} message, WebSocket is null`);
      if (dataType === 'Settings') {
        this.logger.error('Settings - WebSocket is null', { url: this.options.url, service: this.options.service });
      }
      return false;
    }
    
    const wsState = this.ws.readyState;
    const wsStateName = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN';
    
    if (wsState !== 1) { // WebSocket.OPEN = 1
      this.log(`❌ Cannot send ${dataType} message, WebSocket not open (state: ${wsState} ${wsStateName})`);
      if (dataType === 'Settings') {
        this.logger.error('Settings message cannot be sent - WebSocket not open', { wsState, wsStateName, url: this.options.url, service: this.options.service });
      }
      return false;
    }
    
    try {
      const jsonString = JSON.stringify(data);
      
      // Debug logging for sendJSON calls (Issue #412: use logger)
      if (this.options.debug) {
        const debugType = data && typeof data === 'object' && 'type' in data ? (data as { type: string }).type : 'unknown';
        this.logger.debug(`[WEBSOCKET.sendJSON] type=${debugType}, isSettings=${(data as { type?: string })?.type === 'Settings'}`);
        if (data && (data as { type?: string }).type === 'Settings') {
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__DEEPGRAM_WS_SETTINGS_PAYLOAD__ = jsonString;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__DEEPGRAM_WS_SETTINGS_PARSED__ = JSON.parse(jsonString);
            } catch (e) {
              this.logger.error('Error parsing JSON for window exposure', { error: e instanceof Error ? e.message : String(e) });
            }
          }
          try {
            JSON.parse(jsonString);
            this.logger.debug('[WEBSOCKET.sendJSON] Settings payload (parsed)', { length: jsonString.length });
          } catch (e) {
            this.logger.error('Error parsing Settings JSON', { error: e instanceof Error ? e.message : String(e) });
          }
        }
      }
      
      // Always expose Settings payload to window for automated testing (even without debug mode)
      // This is needed for E2E tests that check window variables
      if (data && data.type === 'Settings' && typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__DEEPGRAM_WS_SETTINGS_PAYLOAD__ = jsonString;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__DEEPGRAM_WS_SETTINGS_PARSED__ = JSON.parse(jsonString);
        } catch (e) {
          // Silently fail - window exposure is for testing only
        }
      }
      
      // For agent service, mark Settings as sent before actually sending
      // This ensures Settings is always the first message and keepalive can start
      if (data && typeof data === 'object' && 'type' in data && data.type === 'Settings' && this.options.service === 'agent') {
        this.markSettingsSent();
      }
      
      this.log('Sending JSON:', data);
      this.ws.send(jsonString);
      // Only reset idle timeout when sending meaningful user messages, not protocol messages
      if (this.isMeaningfulUserActivity(data)) {
        this.resetIdleTimeout(data);
      }
      return true;
    } catch (error) {
      this.log('Error sending JSON:', error);
      return false;
    }
  }

  /**
   * Sends binary data over the WebSocket
   */
  public sendBinary(data: ArrayBuffer | Blob): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('Cannot send binary data, WebSocket not open');
      return false;
    }
    
    try {
      this.log(`Sending binary data: ${data instanceof ArrayBuffer ? data.byteLength : data.size} bytes`);
      this.ws.send(data);
      // Audio data being sent is just a technical signal - not user activity
      // Don't reset idle timeout based on audio data transmission
      // Idle timeout should be based on actual speech detection, not mic being open
      return true;
    } catch (error) {
      this.log('Error sending binary data:', error);
      return false;
    }
  }

  /**
   * Sends a CloseStream message to finalize transcription
   */
  public sendCloseStream(): boolean {
    return this.sendJSON({ type: 'CloseStream' });
  }

  /**
   * Check if the WebSocket connection is open
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Closes the WebSocket connection
   */
  public close(): void {
    // Add stack trace to understand who is calling close()
    const stack = new Error().stack;
    this.log('Closing WebSocket');
    this.log(`🔧 [WebSocketManager] close() called from:`, stack?.split('\n').slice(2, 5).join('\n'));
    this.stopKeepalive();
    this.stopIdleTimeout();
    
    if (this.connectionTimeoutId !== null) {
      window.clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    
    if (this.ws) {
      try {
        this.ws.close(1000, 'Closed by client');
      } catch (error) {
        this.log('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    
    this.updateState('closed');
  }

  /**
   * Gets the current connection state
   */
  /**
   * Returns the underlying WebSocket readyState (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
   * or null if no socket. Used by callers that need to check socket openness before sending.
   */
  public getReadyState(): number | null {
    return this.ws === null ? null : this.ws.readyState;
  }

  public getState(): ConnectionState {
    return this.connectionState;
  }
} 