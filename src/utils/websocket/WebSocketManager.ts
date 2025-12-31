import { ConnectionState, DeepgramError, ServiceType } from '../../types';
import { functionCallLogger } from '../function-call-logger';

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
 * Default WebSocketManager options
 */
const DEFAULT_OPTIONS: Partial<WebSocketManagerOptions> = {
  keepaliveInterval: 5000, // 5 seconds - keep connection alive to prevent server timeout
  connectionTimeout: 10000, // 10 seconds - reasonable timeout for connection establishment
  idleTimeout: 10000, // 10 seconds - client-side timeout for lazy reconnection testing
  debug: false,
};

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
  private connectionTimestamp: number | null = null; // Issue #341: Track when connection was established

  /**
   * Creates a new WebSocketManager
   */
  constructor(options: WebSocketManagerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.log('WebSocketManager created');
  }

  /**
   * Logs a message if debug is enabled
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log(`[WebSocketManager:${this.options.service}]`, ...args);
    }
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
        console.error('Error in WebSocketManager event listener:', error);
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
          console.log(`🔌 [WebSocketManager.connect] URL: ${url}`);
          console.log(`🔌 [WebSocketManager.connect] Is proxy mode: ${isProxyMode}`);
          console.log(`🔌 [WebSocketManager.connect] Service: ${this.options.service}`);
          console.log(`🔌 [WebSocketManager.connect] API key present: ${!!this.options.apiKey}`);
          console.log(`🔌 [WebSocketManager.connect] API key length: ${this.options.apiKey?.length || 0}`);
          console.log(`🔌 [WebSocketManager.connect] API key preview: ${this.options.apiKey ? `${this.options.apiKey.substring(0, 8)}...${this.options.apiKey.substring(this.options.apiKey.length - 4)}` : 'EMPTY'}`);
        }
        
        // Create WebSocket
        // In direct mode: use token protocol with API key
        // In proxy mode: connect without token protocol (backend handles auth)
        if (isProxyMode) {
          this.ws = new WebSocket(url);
          if (this.options.debug) {
            console.log(`🔌 [WebSocketManager.connect] Created WebSocket without token protocol (proxy mode)`);
          }
        } else {
          const apiKeyForProtocol = this.options.apiKey || '';
          if (this.options.debug) {
            console.log(`🔌 [WebSocketManager.connect] Creating WebSocket with token protocol, API key length: ${apiKeyForProtocol.length}`);
            if (!apiKeyForProtocol) {
              console.error(`🔌 [WebSocketManager.connect] ⚠️ WARNING: API key is empty! This will cause authentication failure.`);
            }
          }
          this.ws = new WebSocket(url, ['token', apiKeyForProtocol]);
          if (this.options.debug) {
            console.log(`🔌 [WebSocketManager.connect] Created WebSocket with token protocol (direct mode)`);
          }
        }
        
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
          
          // Issue #341: Record connection timestamp to diagnose immediate closure
          // Safety check: Only set if not already set (prevents overwriting on multiple onopen calls)
          if (this.connectionTimestamp === null) {
            this.connectionTimestamp = Date.now();
            console.log(`✅ [ISSUE #341] Connection established at ${this.connectionTimestamp}`);
          } else {
            this.log('⚠️ [ISSUE #341] Warning: connectionTimestamp already set, onopen may have been called multiple times');
          }
          
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
            this.log('Received ArrayBuffer binary data, emitting binary event...');
            this.emit({ type: 'binary', data: event.data });
          } else if (event.data instanceof Blob) {
            // Handle Blob data by converting to ArrayBuffer
            this.log(`Received Blob binary data (size: ${event.data.size}), converting to ArrayBuffer...`);
            
            // Issue #341: Ensure Blob conversion errors don't cause unhandled promise rejections
            // that could close the WebSocket connection
            event.data.arrayBuffer().then(arrayBuffer => {
              this.log(`Converted Blob to ArrayBuffer (byteLength: ${arrayBuffer.byteLength}), emitting binary event...`);
              this.emit({ type: 'binary', data: arrayBuffer });
            }).catch(error => {
              // Issue #341: Log error but don't let it propagate - connection should remain stable
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
              // Don't throw or close connection - error is logged and emitted for error handling callbacks
            });
          } else {
            // Log if data is neither string, ArrayBuffer, nor Blob
            this.log('Received message data of unexpected type:', event.data);
          }
        };

        this.ws.onerror = (event) => {
          // Issue #341: Enhanced error logging to diagnose connection closure
          const ws = event.target as WebSocket;
          const errorDetails = {
            type: event.type,
            target: ws?.constructor?.name || 'WebSocket',
            readyState: ws?.readyState,
            readyStateName: ws?.readyState === 0 ? 'CONNECTING' : 
                          ws?.readyState === 1 ? 'OPEN' : 
                          ws?.readyState === 2 ? 'CLOSING' : 
                          ws?.readyState === 3 ? 'CLOSED' : 'UNKNOWN',
            url: this.options.url,
            service: this.options.service,
            connectionState: this.connectionState,
            hasEverConnected: this.hasEverConnected,
            settingsSent: this.settingsSent,
          };
          
          this.log('🚨 WebSocket error event (Issue #341 investigation):', errorDetails);
          console.error('🚨 [ISSUE #341] WebSocket error details:', errorDetails);
          
          // Issue #341: Don't reject immediately - wait for onclose to get close code and reason
          // The error event doesn't provide close code/reason, but onclose will
          // This allows us to distinguish between connection rejection (1006) and other errors
          const errorMessage = `WebSocket connection error for ${this.options.service}`;
          this.emit({ 
            type: 'error', 
            error: {
              service: this.options.service,
              code: 'websocket_error',
              message: errorMessage,
              details: errorDetails
            }
          });
          this.updateState('error');
          
          // Issue #341: Only reject if connection was never established
          // If readyState is CLOSED and we never connected, reject immediately
          // Otherwise, wait for onclose to provide close code/reason
          if (ws?.readyState === 3 && !this.hasEverConnected) {
            // Connection was rejected before establishing - reject immediately
            reject(new Error(`${errorMessage} - Connection rejected (readyState: CLOSED)`));
          }
          // If connection was established, onclose will handle the rejection
        };

        this.ws.onclose = (event) => {
          // Issue #341: Enhanced close logging to diagnose immediate closure
          // Calculate time since connection for diagnostics
          const timeSinceConnection = this.connectionTimestamp ? Date.now() - this.connectionTimestamp : null;
          
          const closeDetails: {
            code: number;
            reason: string;
            wasClean: boolean;
            service: ServiceType;
            previousState: ConnectionState;
            hasEverConnected: boolean;
            settingsSent: boolean;
            url: string;
            timeSinceConnection?: number;
          } = {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            service: this.options.service,
            previousState: this.connectionState,
            hasEverConnected: this.hasEverConnected,
            settingsSent: this.settingsSent,
            url: this.options.url,
          };
          
          // Add timeSinceConnection if available
          if (timeSinceConnection !== null) {
            closeDetails.timeSinceConnection = timeSinceConnection;
          }
          
          this.log(`WebSocket closed: code=${event.code}, reason='${event.reason}', wasClean=${event.wasClean}`);
          console.log('🚨 [ISSUE #341] WebSocket close details:', closeDetails);
          
          // Issue #341: Log if connection closed immediately after being reported as connected
          if (this.connectionState === 'connected' || this.hasEverConnected) {
            const timeSinceConnectionForLog = timeSinceConnection ?? 0;
            console.warn(`🚨 [ISSUE #341] Connection closed ${timeSinceConnectionForLog}ms after being reported as connected`, closeDetails);
          }
          
          // Issue #341: If connection was rejected (code 1006) and never established, reject the promise
          // This handles the case where onerror fires but we waited for onclose to get close code
          if (event.code === 1006 && !this.hasEverConnected && this.connectionState === 'error') {
            const errorMessage = `WebSocket connection rejected for ${this.options.service} (code: ${event.code}, reason: ${event.reason || 'Abnormal Closure'})`;
            console.error(`🚨 [ISSUE #341] Connection rejected: ${errorMessage}`, closeDetails);
            reject(new Error(errorMessage));
          }
          
          this.stopKeepalive();
          this.stopIdleTimeout();
          window.clearTimeout(this.connectionTimeoutId!);
          this.connectionTimeoutId = null;
          
          // Reset settingsSent flag on close (for agent service)
          if (this.options.service === 'agent') {
            this.settingsSent = false;
          }
          
          // Issue #341: Reset connection timestamp
          this.connectionTimestamp = null;
          
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
      if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'Results') {
        const resultsData = data as { alternatives?: Array<{ transcript?: string }> };
        const hasAlternatives = resultsData.alternatives && resultsData.alternatives.length > 0;
        const hasTranscript = hasAlternatives && 
                              resultsData.alternatives![0] && 
                              resultsData.alternatives![0].transcript && 
                              resultsData.alternatives![0].transcript.trim().length > 0;
        
        // Only reset if there's actual transcript content
        if (hasTranscript) {
          this.log(`Resetting idle timeout - meaningful transcript: "${resultsData.alternatives![0].transcript}"`);
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
      // Type guard for message data
      if (typeof data === 'object' && data !== null && 'type' in data) {
        const messageData = data as { type: string };
        
        // User text injection (explicit user activity)
        if (messageData.type === 'InjectUserMessage') {
          this.options.onMeaningfulActivity?.(messageData.type);
          return true;
        }
        
        // Agent activity that should keep connection alive
        // Note: These are handled by agent state changes, but we keep them here
        // as a fallback in case state hasn't updated yet
        const agentActivityMessages = ['AgentThinking', 'AgentStartedSpeaking', 'AgentAudioDone']; // Agent responding
        
        if (agentActivityMessages.includes(messageData.type)) {
          this.options.onMeaningfulActivity?.(messageData.type);
          return true;
        }
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
      if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'Results') {
        const resultsData = data as { alternatives?: Array<{ transcript?: string }> };
        const hasAlternatives = resultsData.alternatives && resultsData.alternatives.length > 0;
        const firstAlternative = hasAlternatives && resultsData.alternatives ? resultsData.alternatives[0] : null;
        const hasTranscript = Boolean(
          firstAlternative && 
          firstAlternative.transcript && 
          firstAlternative.transcript.trim().length > 0
        );
        if (hasTranscript && firstAlternative) {
          this.options.onMeaningfulActivity?.(`Results with transcript: "${firstAlternative.transcript}"`);
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
    const triggerType = triggerMessage && typeof triggerMessage === 'object' && triggerMessage !== null && 'type' in triggerMessage 
      ? (triggerMessage as { type?: string }).type || 'unknown' 
      : 'unknown';
    const triggerInfo = triggerMessage ? ` (triggered by: ${triggerType})` : '';
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
        console.error(`[WebSocketManager.sendJSON] ❌ CRITICAL: Settings - WebSocket is null`);
        console.error(`[WebSocketManager.sendJSON] URL: ${this.options.url}, Service: ${this.options.service}`);
      }
      return false;
    }
    
    const wsState = this.ws.readyState;
    const wsStateName = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN';
    
    if (wsState !== 1) { // WebSocket.OPEN = 1
      this.log(`❌ Cannot send ${dataType} message, WebSocket not open (state: ${wsState} ${wsStateName})`);
      if (dataType === 'Settings') {
        console.error(`[WebSocketManager.sendJSON] ❌ CRITICAL: Settings message cannot be sent`);
        console.error(`[WebSocketManager.sendJSON] WebSocket state: ${wsState} (${wsStateName})`);
        console.error(`[WebSocketManager.sendJSON] WebSocket URL: ${this.options.url}`);
        console.error(`[WebSocketManager.sendJSON] WebSocket object:`, this.ws);
        console.error(`[WebSocketManager.sendJSON] WebSocket readyState property:`, this.ws.readyState);
      }
      return false;
    }
    
    try {
      const jsonString = JSON.stringify(data);
      
      // Debug logging for sendJSON calls
      if (this.options.debug) {
        const dataType = (data && typeof data === 'object' && 'type' in data) ? (data as { type?: string }).type || 'unknown' : 'unknown';
        console.log('📤 [WEBSOCKET.sendJSON] Called with type:', dataType);
        console.log('📤 [WEBSOCKET.sendJSON] DEBUG: data.type=' + dataType + ', isSettings=' + (dataType === 'Settings'));
        
        if (data && typeof data === 'object' && 'type' in data && (data as { type: string }).type === 'Settings') {
          console.log('📤 [WEBSOCKET.sendJSON] ✅ ENTERED Settings block!');
          
          // Expose Settings payload to window for automated testing (only in debug mode)
          // This is the exact JSON string that will be sent over WebSocket
          if (typeof window !== 'undefined') {
            console.log('📤 [WEBSOCKET.sendJSON] Setting window variables...');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__DEEPGRAM_WS_SETTINGS_PAYLOAD__ = jsonString;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__DEEPGRAM_WS_SETTINGS_PARSED__ = JSON.parse(jsonString);
              console.log('📤 [WEBSOCKET.sendJSON] ✅ Window variables set successfully');
            } catch (e) {
              console.error('📤 [WEBSOCKET.sendJSON] Error parsing JSON for window exposure:', e);
            }
          } else {
            console.log('📤 [WEBSOCKET.sendJSON] Window is undefined');
          }
          
          console.log('📤 [WEBSOCKET.sendJSON] ✅ Settings message detected!');
          console.log('📤 [WEBSOCKET.sendJSON] Settings message payload (exact JSON string):', jsonString);
          try {
            const parsed = JSON.parse(jsonString);
            console.log('📤 [WEBSOCKET.sendJSON] Settings message payload (parsed):', parsed);
          } catch (e) {
            console.error('📤 [WEBSOCKET.sendJSON] Error parsing JSON:', e);
          }
        } else {
          console.log('📤 [WEBSOCKET.sendJSON] NOT a Settings message, skipping');
        }
      }
      
      // Always expose Settings payload to window for automated testing (even without debug mode)
      // This is needed for E2E tests that check window variables
      if (data && typeof data === 'object' && 'type' in data && (data as { type: string }).type === 'Settings' && typeof window !== 'undefined') {
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
  public getState(): ConnectionState {
    return this.connectionState;
  }
} 