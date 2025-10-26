import { ConnectionState, DeepgramError, ServiceType } from '../../types';

/**
 * Event types emitted by the WebSocketManager
 */
export type WebSocketEvent = 
  | { type: 'state'; state: ConnectionState; isReconnection?: boolean }
  | { type: 'message'; data: any }
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
   * API key for authentication 
   */
  apiKey: string;
  
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
        
        // Create WebSocket with token protocol
        this.ws = new WebSocket(url, ['token', this.options.apiKey]);
        
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
          this.startKeepalive();
          this.startIdleTimeout();
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          // Log the type of data received for every message
          this.log(`Received message data type: ${typeof event.data}, is ArrayBuffer: ${event.data instanceof ArrayBuffer}, is Blob: ${event.data instanceof Blob}`);
          
          if (typeof event.data === 'string') {
            try {
              this.log('Received raw string message:', event.data);
              const data = JSON.parse(event.data);
              this.log('Parsed message into JSON:', data);
              
              // Only reset idle timeout on meaningful user activity (not every protocol message)
              const shouldResetTimeout = this.shouldResetIdleTimeout(data);
              if (shouldResetTimeout) {
                // If there's meaningful content, reset the idle timeout
                // But DON'T automatically re-enable idle timeout resets if they're disabled
                // This prevents the idle timeout from firing during agent responses
                if (this.idleTimeoutDisabled) {
                  console.log(`🎯 [IDLE_TIMEOUT] NOT re-enabling idle timeout resets due to meaningful activity: ${data.type} (resets are disabled)`);
                  // Don't re-enable idle timeout resets - let the component manage this
                } else {
                  // Only reset on truly meaningful user activity, not on every protocol message
                  if (this.isMeaningfulUserActivity(data)) {
                    this.resetIdleTimeout(data);
                  }
                }
              }
              
              this.emit({ type: 'message', data });
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
            
            // Convert Blob to ArrayBuffer
            event.data.arrayBuffer().then(arrayBuffer => {
              this.log(`Converted Blob to ArrayBuffer (byteLength: ${arrayBuffer.byteLength}), emitting binary event...`);
              this.emit({ type: 'binary', data: arrayBuffer });
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
          this.log(`WebSocket closed: code=${event.code}, reason='${event.reason}', wasClean=${event.wasClean}`);
          this.stopKeepalive();
          this.stopIdleTimeout();
          window.clearTimeout(this.connectionTimeoutId!);
          this.connectionTimeoutId = null;
          
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
      console.log('🔧 [WebSocketManager] Keepalive interval cleared and stopped');
    } else {
      this.log('No keepalive interval to stop');
      console.log('🔧 [WebSocketManager] No keepalive interval was running to stop');
    }
  }

  /**
   * Sends a keepalive message
   */
  private sendKeepalive(): void {
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
      console.log(`🎯 [IDLE_TIMEOUT] Stopped idle timeout for ${this.options.service}`);
    }
  }

  /**
   * Determines if a message should reset the idle timeout
   */
  private shouldResetIdleTimeout(data: any): boolean {
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
   */
  private isMeaningfulUserActivity(data: any): boolean {
    // Only reset idle timeout on ACTUAL user activity, not on every message
    
    // For agent service, only reset on user messages, not agent responses or protocol messages
    if (this.options.service === 'agent') {
      // Only reset on actual user messages
      const userActivityMessages = ['ConversationText']; // User sending text
      const isMeaningful = userActivityMessages.includes(data.type);
      if (isMeaningful) {
        this.options.onMeaningfulActivity?.(data.type);
      }
      return isMeaningful;
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
  public resetIdleTimeout(triggerMessage?: any): void {
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
  public sendJSON(data: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('Cannot send message, WebSocket not open');
      return false;
    }
    
    try {
      this.log('Sending JSON:', data);
      this.ws.send(JSON.stringify(data));
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
    this.log('Closing WebSocket');
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