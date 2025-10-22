import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef } from 'react';
import {
  AgentState,
  DeepgramError,
  DeepgramVoiceInteractionHandle,
  DeepgramVoiceInteractionProps,
  LLMResponse,
  TranscriptResponse,
  UpdateInstructionsPayload,
  ConversationMessage,
  ConversationRole,
  AgentOptions,
  ConnectionState
} from '../../types';
import { WebSocketManager, WebSocketEvent } from '../../utils/websocket/WebSocketManager';
import { AudioManager, AudioEvent } from '../../utils/audio/AudioManager';
import {
  VoiceInteractionState,
  initialState,
  stateReducer,
} from '../../utils/state/VoiceInteractionState';
import { 
  transformConversationHistory, 
  generateSessionId, 
  LAZY_RECONNECT_CONFIG 
} from '../../utils/conversation-context';

// Default endpoints
const DEFAULT_ENDPOINTS = {
  transcriptionUrl: 'wss://api.deepgram.com/v1/listen',
  agentUrl: 'wss://agent.deepgram.com/v1/agent/converse',
};

/**
 * Helper function to warn about non-memoized options in development mode
 * @param propName - The name of the prop being checked
 * @param options - The options object to check
 */
function warnAboutNonMemoizedOptions(propName: string, options: unknown): void {
  if (!options || typeof options !== 'object') {
    return;
  }
  
  // Check if the object appears to be an inline object (not memoized)
  // We use a heuristic: if the object has a constructor that's not Object
  // or if it's not frozen, it might be an inline object
  const isLikelyInlineObject = 
    options.constructor === Object && 
    !Object.isFrozen(options) &&
    Object.getOwnPropertyNames(options).length > 0;
  
  if (isLikelyInlineObject) {
    try {
      console.warn(
        `[DeepgramVoiceInteraction] ${propName} prop detected. ` +
        'For optimal performance, memoize this prop with useMemo() to prevent unnecessary re-initialization. ' +
        'See component documentation for details.'
      );
    } catch (error) {
      // Silently fail if console.warn is not available
    }
  }
}

/**
 * DeepgramVoiceInteraction component
 * 
 * A headless React component for real-time transcription and/or agent interaction using Deepgram's WebSocket APIs.
 * 
 * @component
 * 
 * IMPORTANT: The component can operate in three distinct modes depending on the options provided:
 * 
 * 1. Dual Mode (Transcription + Agent):
 *    - Provide both `transcriptionOptions` and `agentOptions` props
 *    - Uses separate WebSocket connections for transcription and agent
 *    - Enables independent transcription with full customization options
 *    - Can display live transcripts while also having agent conversations
 * 
 * 2. Transcription-Only Mode:
 *    - Provide `transcriptionOptions` prop, completely OMIT `agentOptions` prop
 *    - Only connects to transcription service
 *    - Ideal for applications that only need speech-to-text capabilities
 *    - Lighter weight without agent or audio playback functionality
 * 
 * 3. Agent-Only Mode:
 *    - Provide `agentOptions` prop, completely OMIT `transcriptionOptions` prop
 *    - Only connects to agent service (agent handles its own transcription internally)
 *    - Ideal for voice assistant applications that don't need separate transcription results
 *    - Agent uses its own internal transcription via the `listenModel` option
 * 
 * IMPORTANT: To use a specific mode, you must completely OMIT (not pass) the options prop
 * for any service you don't want to use. Passing an empty object ({}) will still initialize
 * that service.
 * 
 * CRITICAL: Options Props Must Be Memoized
 * =======================================
 * 
 * The `agentOptions` and `transcriptionOptions` props MUST be memoized using `useMemo` to prevent
 * unnecessary re-initialization and infinite reconnection loops.
 * 
 * ✅ CORRECT Usage:
 * ```tsx
 * const agentOptions = useMemo(() => ({
 *   language: 'en',
 *   listenModel: 'nova-3',
 *   // ... other options
 * }), []); // Empty dependency array for static config
 * 
 * <DeepgramVoiceInteraction agentOptions={agentOptions} />
 * ```
 * 
 * ❌ INCORRECT Usage (causes infinite re-initialization):
 * ```tsx
 * <DeepgramVoiceInteraction 
 *   agentOptions={{
 *     language: 'en',
 *     listenModel: 'nova-3',
 *     // ... other options
 *   }}
 * />
 * ```
 * 
 * This is because the component's main useEffect depends on these props, and inline objects
 * create new references on every render, causing the component to tear down and recreate
 * WebSocket connections constantly.
 */
function DeepgramVoiceInteraction(
  props: DeepgramVoiceInteractionProps,
  ref: React.Ref<DeepgramVoiceInteractionHandle>
) {
  const {
    apiKey,
    // Change defaults from {} to undefined for stability
    transcriptionOptions, // = {}, - remove default
    agentOptions, // = {}, - remove default
    endpointConfig,
    onReady,
    onConnectionStateChange,
    onTranscriptUpdate,
    onAgentStateChange,
    onAgentUtterance,
    onUserMessage,
    onUserStartedSpeaking,
    onUserStoppedSpeaking,
    onUtteranceEnd,
    onVADEvent,
    onKeepalive,
    onPlaybackStateChange,
    onError,
    debug: debugProp = false,
    // Auto-connect dual mode props
    autoConnect,
    microphoneEnabled,
    onMicToggle,
    onConnectionReady,
    onAgentSpeaking,
    onAgentSilent,
    ttsMuted = false,
    onTtsMuteToggle,
  } = props;

  // Internal state
  const [state, dispatch] = useReducer(stateReducer, initialState);
  
  // Ref to hold the latest state value, avoiding stale closures in callbacks
  const stateRef = useRef<VoiceInteractionState>(state);
  
  // Ref to track if we're in the middle of a lazy reconnection
  const isLazyReconnectingRef = useRef<boolean>(false);
  
  // Ref to track connection type immediately and synchronously
  const isNewConnectionRef = useRef<boolean>(true);

  // Managers - these may be null if the service is not required
  const transcriptionManagerRef = useRef<WebSocketManager | null>(null);
  const agentManagerRef = useRef<WebSocketManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  
  // Tracking user speaking state
  const userSpeakingRef = useRef(false);
  
  // Track if auto-connect has been attempted to prevent multiple attempts
  const autoConnectAttemptedRef = useRef(false);
  const hasSentSettingsRef = useRef(false);
  
  // Track when settings were sent to add proper delay
  const settingsSentTimeRef = useRef<number | null>(null);
  
  // Global flag to prevent settings from being sent multiple times across component instances
  if (!(window as any).globalSettingsSent) {
    (window as any).globalSettingsSent = false;
  }
  
  // Global flag to prevent multiple auto-connect attempts across component re-initializations
  if (!(window as any).globalAutoConnectAttempted) {
    (window as any).globalAutoConnectAttempted = false;
  }
  
  // Global flag to prevent multiple component initializations during HMR
  if (!(window as any).componentInitializationCount) {
    (window as any).componentInitializationCount = 0;
  }
  (window as any).componentInitializationCount++;
  
  // Remove HMR prevention logic - it's causing React hook errors
  
  // Global flag to track if audio is currently being captured
  if (!(window as any).audioCaptureInProgress) {
    (window as any).audioCaptureInProgress = false;
  }
  
  // Debug: Log component initialization (but limit frequency to avoid spam)
  // Moved inside useEffect to only log when component actually initializes, not on every render
  
  
  // Track if we're waiting for user voice after waking from sleep
  const isWaitingForUserVoiceAfterSleep = useRef(false);
  
  // Track keepalive state - disable after UserStoppedSpeaking to allow natural timeout
  const keepaliveEnabledRef = useRef(true);
  
  // Track last connection states to prevent duplicate logging
  const lastConnectionStates = useRef<{ transcription?: ConnectionState; agent?: ConnectionState }>({});
  
  // Control keepalives based on user speaking state
  const updateKeepaliveState = (enabled: boolean) => {
    if (enabled && !keepaliveEnabledRef.current) {
      // Enable keepalives
      keepaliveEnabledRef.current = true;
      if (agentManagerRef.current) {
        agentManagerRef.current.startKeepalive();
        log('Keepalives enabled');
      }
    } else if (!enabled && keepaliveEnabledRef.current) {
      // Disable keepalives
      keepaliveEnabledRef.current = false;
      if (agentManagerRef.current) {
        agentManagerRef.current.stopKeepalive();
        log('Keepalives disabled - allowing natural timeout');
      }
    }
  };
  
  // Refs to track previous state values to prevent redundant callback calls
  const prevIsReadyRef = useRef<boolean | undefined>(undefined);
  const prevAgentStateRef = useRef<AgentState | undefined>(undefined);
  const prevIsPlayingRef = useRef<boolean | undefined>(undefined);
  
  // VAD event tracking for redundancy detection
  const vadEventHistory = useRef<Array<{ type: string; speechDetected: boolean; timestamp: number; source: string }>>([]);
  
  // Constants for VAD tracking
  const VAD_TRACKING_CONSTANTS = {
    HISTORY_RETENTION_MS: 5000,
    REDUNDANCY_WINDOW_MS: 1000,
    CONFLICT_WINDOW_MS: 2000,
    MAX_HISTORY_SIZE: 50
  } as const;
  
  // Track VAD events and detect redundancy/conflicts
  const trackVADEvent = (event: { type: string; speechDetected: boolean; timestamp: number; source: string }) => {
    try {
      // Add new event
      vadEventHistory.current.push(event);
      
      // Prevent memory leaks - limit history size
      if (vadEventHistory.current.length > VAD_TRACKING_CONSTANTS.MAX_HISTORY_SIZE) {
        vadEventHistory.current = vadEventHistory.current.slice(-VAD_TRACKING_CONSTANTS.MAX_HISTORY_SIZE);
      }
      
      // Keep only recent events
      const cutoffTime = Date.now() - VAD_TRACKING_CONSTANTS.HISTORY_RETENTION_MS;
      vadEventHistory.current = vadEventHistory.current.filter(e => e.timestamp > cutoffTime);
      
      // Detect redundancy for same event type
      const recentEvents = vadEventHistory.current.filter(e => 
        e.timestamp > Date.now() - VAD_TRACKING_CONSTANTS.REDUNDANCY_WINDOW_MS &&
        e.speechDetected === event.speechDetected
      );
      
      if (recentEvents.length > 1) {
        console.log('🔄 [VAD] Redundant signals detected:', recentEvents.map(e => `${e.source}:${e.type}`));
      }
      
      // Detect conflicts (opposite speech states within short time)
      const conflictingEvents = vadEventHistory.current.filter(e => 
        e.timestamp > Date.now() - VAD_TRACKING_CONSTANTS.CONFLICT_WINDOW_MS &&
        e.speechDetected !== event.speechDetected
      );
      
      if (conflictingEvents.length > 0) {
        console.warn('⚠️ [VAD] Conflicting signals detected:', {
          current: `${event.source}:${event.type} (${event.speechDetected})`,
          conflicts: conflictingEvents.map(e => `${e.source}:${e.type} (${e.speechDetected})`)
        });
      }
    } catch (error) {
      console.error('Error tracking VAD event:', error);
    }
  };
  
  // DRY helper for idle timeout management
  const manageIdleTimeoutResets = useCallback((action: 'enable' | 'disable', context: string) => {
    try {
      const logPrefix = action === 'enable' ? '🎯 [IDLE_TIMEOUT] Re-enabling' : '🎯 [IDLE_TIMEOUT] Disabling';
      console.log(`${logPrefix} idle timeout resets for both services (${context})`);
      
      if (agentManagerRef.current) {
        agentManagerRef.current[action === 'enable' ? 'enableIdleTimeoutResets' : 'disableIdleTimeoutResets']();
      }
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current[action === 'enable' ? 'enableIdleTimeoutResets' : 'disableIdleTimeoutResets']();
      }
    } catch (error) {
      console.error(`Error managing idle timeout resets (${action}):`, error);
    }
  }, []); // Empty deps - uses refs which are stable
  
  // Debug logging
  const log = (...args: unknown[]) => {
    if (props.debug) {
      console.log('[DeepgramVoiceInteraction]', ...args);
    }
  };
  
  // Targeted sleep/wake logging
  const sleepLog = (...args: unknown[]) => {
    if (props.debug) {
      console.log('[SLEEP_CYCLE][CORE]', ...args);
    }
  };

  // Update stateRef whenever state changes
  useEffect(() => {
    stateRef.current = state;
    
    // If we just entered the 'entering_sleep' state, schedule the final transition
    if (state.agentState === 'entering_sleep') {
      const timerId = setTimeout(() => {
        sleepLog('Transitioning from entering_sleep to sleeping after timeout');
        // Ensure we are still in entering_sleep before finalizing
        // (Could have been woken up or stopped during the timeout)
        if (stateRef.current.agentState === 'entering_sleep') {
          dispatch({ type: 'AGENT_STATE_CHANGE', state: 'sleeping' });
        }
      }, 50); // 50ms delay - adjust if needed
      
      // Cleanup timeout if component unmounts or state changes away from entering_sleep
      return () => clearTimeout(timerId);
    }
  }, [state]);

  // Handle errors
  const handleError = (error: DeepgramError) => {
    console.log('🚨 [ERROR] Deepgram error received:', error);
    console.log('🚨 [ERROR] Error service:', error.service);
    console.log('🚨 [ERROR] Error code:', error.code);
    console.log('🚨 [ERROR] Error message:', error.message);
    console.log('🚨 [ERROR] Error details:', error.details);
    
    log('Error:', error);
    dispatch({ type: 'ERROR', message: error.message });
    onError?.(error);
  };

  // Initialize the component based on provided options
  useEffect(() => {
    // Debug: Log component initialization (but limit frequency to avoid spam)
    const initTime = Date.now();
    if (!(window as any).lastComponentInitTime || initTime - (window as any).lastComponentInitTime > 1000) {
      console.log('🔧 [Component] DeepgramVoiceInteraction component initialized');
      (window as any).lastComponentInitTime = initTime;
    }
    
    // Initialize connection type ref for first connection
    isNewConnectionRef.current = true;
    
    // Check if we're in a CI environment or package import context
    const isCIEnvironment = typeof process !== 'undefined' && (process.env.CI === 'true' || process.env.NODE_ENV === 'test');
    const isPackageImport = typeof window === 'undefined' || !window.document;
    
    // Validate API key
    if (!apiKey) {
      // In CI or package import context, just log a warning instead of erroring
      if (isCIEnvironment || isPackageImport) {
        console.log('⚠️ [DeepgramVoiceInteraction] No API key provided in CI/import context - component will not initialize');
        return;
      }
      
      handleError({
        service: 'transcription',
        code: 'invalid_api_key',
        message: 'API key is required',
      });
      return;
    }

    // Development warning for non-memoized options
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      warnAboutNonMemoizedOptions('agentOptions', agentOptions);
      warnAboutNonMemoizedOptions('transcriptionOptions', transcriptionOptions);
    }

    // Determine which services are being configured
    const isTranscriptionConfigured = !!transcriptionOptions;
    const isAgentConfigured = !!agentOptions;
    
    // Enhanced logging for debugging initialization issues
    console.log('🔧 [INIT] Service configuration check:');
    console.log('  - transcriptionOptions:', transcriptionOptions);
    console.log('  - agentOptions:', agentOptions);
    console.log('  - isTranscriptionConfigured:', isTranscriptionConfigured);
    console.log('  - isAgentConfigured:', isAgentConfigured);
    console.log('  - apiKey present:', !!apiKey);
    console.log('  - apiKey length:', apiKey ? apiKey.length : 0);
    
    if (!isTranscriptionConfigured && !isAgentConfigured) {
      // In CI or package import context, just log a warning instead of erroring
      if (isCIEnvironment || isPackageImport) {
        console.log('⚠️ [DeepgramVoiceInteraction] No services configured in CI/import context - component will not initialize');
        return;
      }
      
      log('No services configured! Either transcriptionOptions or agentOptions must be provided.');
      handleError({
        service: 'transcription',
        code: 'invalid_configuration',
        message: 'Either transcriptionOptions or agentOptions must be provided',
      });
      return;
    }
    
    // Log which services are being configured (always show this critical info)
    const mode = isTranscriptionConfigured && isAgentConfigured ? 'DUAL MODE' : 
      isTranscriptionConfigured ? 'TRANSCRIPTION-ONLY MODE' : 'AGENT-ONLY MODE';
    console.log(`[DeepgramVoiceInteraction] Initializing in ${mode}`);
    log(`Initializing in ${mode}`);

    // Prepare endpoints, using defaults ONLY if endpointConfig prop is not provided
    const currentEndpointConfig = endpointConfig || {};
    const endpoints = {
      transcriptionUrl: currentEndpointConfig.transcriptionUrl || DEFAULT_ENDPOINTS.transcriptionUrl,
      agentUrl: currentEndpointConfig.agentUrl || DEFAULT_ENDPOINTS.agentUrl,
    };

    // --- Event listener cleanup functions ---
    let transcriptionUnsubscribe: () => void = () => {};
    let agentUnsubscribe: () => void = () => {};
    let audioUnsubscribe: () => void = () => {};

    // --- TRANSCRIPTION SETUP (CONDITIONAL) ---
    if (isTranscriptionConfigured) {
      console.log('🔧 [TRANSCRIPTION] Transcription service is configured, proceeding with setup');
      console.log('🔧 [TRANSCRIPTION] transcriptionManagerRef.current:', transcriptionManagerRef.current);
      
      if (!transcriptionManagerRef.current) {
        try {
          log('🔧 [TRANSCRIPTION] Starting transcription setup');
          console.log('🔧 [TRANSCRIPTION] Creating new transcription manager...');
      let transcriptionUrl = endpoints.transcriptionUrl;
      let transcriptionQueryParams: Record<string, string | boolean | number> = {};

      // Base transcription parameters
      const baseTranscriptionParams = {
      ...transcriptionOptions,
      sample_rate: transcriptionOptions.sample_rate || 16000,
      encoding: transcriptionOptions.encoding || 'linear16',
      channels: transcriptionOptions.channels || 1,
    };

      // Add VAD configuration if provided
      if (transcriptionOptions.utterance_end_ms) {
        baseTranscriptionParams.utterance_end_ms = transcriptionOptions.utterance_end_ms;
        console.log(`VAD: utterance_end_ms set to ${transcriptionOptions.utterance_end_ms}ms`);
      }
      
      if (transcriptionOptions.interim_results !== undefined) {
        baseTranscriptionParams.interim_results = transcriptionOptions.interim_results;
        console.log(`VAD: interim_results set to ${transcriptionOptions.interim_results}`);
      }

      // Check for Nova-3 Keyterm Prompting conditions
      const useKeytermPrompting = 
        baseTranscriptionParams.model === 'nova-3' &&
        Array.isArray(baseTranscriptionParams.keyterm) &&
        baseTranscriptionParams.keyterm.length > 0;

      if (useKeytermPrompting) {
        log('Nova-3 and keyterms detected. Building transcription URL with keyterm parameters.');
        // Build URL manually, appending keyterms
        const url = new URL(transcriptionUrl);
        const params = new URLSearchParams();
        
        // Append all other options EXCEPT keyterm array itself
        for (const [key, value] of Object.entries(baseTranscriptionParams)) {
          if (key !== 'keyterm' && value !== undefined) {
            params.append(key, String(value));
          }
        }
        
        // Append each keyterm as a separate parameter
        baseTranscriptionParams.keyterm?.forEach(term => {
          if (term) { // Ensure term is not empty
            params.append('keyterm', term);
          }
        });

        url.search = params.toString();
        transcriptionUrl = url.toString();
        log('Constructed transcription URL with keyterms:', transcriptionUrl);
        // queryParams remain empty as they are in the URL now
      } else {
        // Standard setup: Build queryParams object, excluding array types like keyterm and keywords
        log('Not using keyterm prompting. Building queryParams object excluding array types.');
        const { ...otherParams } = baseTranscriptionParams;
        
        // Ensure only primitive types are included in queryParams
        const filteredParams: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(otherParams)) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            filteredParams[key] = value;
          } else {
            log(`Skipping non-primitive param ${key} for queryParams object.`);
          }
        }
        transcriptionQueryParams = filteredParams;
      }
      
      // Log final transcription URL with VAD parameters
      console.log('Final transcription URL:', transcriptionUrl);
      if (props.debug) {
        console.log('🔧 [VAD] VAD configuration check:');
        console.log('  - vad_events in baseTranscriptionParams:', baseTranscriptionParams.vad_events);
        console.log('  - vad_events in transcriptionOptions:', transcriptionOptions.vad_events);
        console.log('  - utterance_end_ms in baseTranscriptionParams:', baseTranscriptionParams.utterance_end_ms);
        console.log('  - utterance_end_ms in transcriptionOptions:', transcriptionOptions.utterance_end_ms);
      }
      
      if (useKeytermPrompting) {
        log('Using keyterm prompting - VAD params in URL');
        if (props.debug) {
          console.log('🔧 [VAD] URL contains VAD params:', transcriptionUrl.includes('vad_events'));
        }
      } else {
        log('Using queryParams - VAD params:', transcriptionQueryParams);
        if (props.debug) {
          console.log('🔧 [VAD] queryParams contains vad_events:', 'vad_events' in transcriptionQueryParams);
        }
      }
      
      // Create Transcription WebSocket manager
      console.log('🔧 [TRANSCRIPTION] Creating WebSocketManager with config:');
      console.log('  - url:', transcriptionUrl);
      console.log('  - apiKey present:', !!apiKey);
      console.log('  - service: transcription');
      console.log('  - queryParams:', useKeytermPrompting ? 'undefined (using keyterm prompting)' : transcriptionQueryParams);
      console.log('  - debug:', props.debug);
      
    transcriptionManagerRef.current = new WebSocketManager({
        url: transcriptionUrl,
      apiKey,
      service: 'transcription',
        queryParams: useKeytermPrompting ? undefined : transcriptionQueryParams, 
      debug: props.debug,
      keepaliveInterval: 0, // Disable keepalives for transcription service
    });
    
    console.log('🔧 [TRANSCRIPTION] WebSocketManager created successfully:', !!transcriptionManagerRef.current);

    // Set up event listeners for transcription WebSocket
      transcriptionUnsubscribe = transcriptionManagerRef.current.addEventListener((event: WebSocketEvent) => {
      if (event.type === 'state') {
        // Only log and dispatch if state actually changed
        if (props.debug) {
          console.log('🔧 [DEBUG] Transcription state event:', event.state, 'Previous:', lastConnectionStates.current.transcription);
        }
        if (lastConnectionStates.current.transcription !== event.state) {
          log('Transcription state:', event.state);
          dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'transcription', state: event.state });
          onConnectionStateChange?.('transcription', event.state);
          lastConnectionStates.current.transcription = event.state;
        } else {
          if (props.debug) {
            console.log('🔧 [DEBUG] Transcription state unchanged, skipping:', event.state);
          }
        }
      } else if (event.type === 'message') {
        handleTranscriptionMessage(event.data);
      } else if (event.type === 're_enable_idle_timeout') {
        // Re-enable idle timeout resets for the other service when one detects meaningful activity
        console.log('🔄 [IDLE_TIMEOUT] Re-enabling idle timeout resets for agent service due to transcription activity');
        if (agentManagerRef.current) {
          agentManagerRef.current.enableIdleTimeoutResets();
        }
      } else if (event.type === 'error') {
        handleError(event.error);
      }
    });
        } catch (error) {
          console.error('Exception in transcription setup:', error);
          handleError({
            service: 'transcription',
            code: 'setup_error',
            message: `Transcription setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      } else {
        log('Transcription manager already exists, skipping setup');
      }
    } else {
      console.log('🔧 [TRANSCRIPTION] Transcription service NOT configured, skipping setup');
      log('Transcription service not configured, skipping setup');
    }

    // --- AGENT SETUP (CONDITIONAL) ---
    if (isAgentConfigured) {
      // Create Agent WebSocket manager
      agentManagerRef.current = new WebSocketManager({
        url: endpoints.agentUrl,
        apiKey,
        service: 'agent',
        debug: props.debug,
      });

    // Set up event listeners for agent WebSocket
      const unsubscribeResult = agentManagerRef.current.addEventListener((event: WebSocketEvent) => {
      if (event.type === 'state') {
        // Only log and dispatch if state actually changed
        if (props.debug) {
          console.log('🔧 [DEBUG] Agent state event:', event.state, 'Previous:', lastConnectionStates.current.agent);
        }
        if (lastConnectionStates.current.agent !== event.state) {
          log('Agent state:', event.state);
          if (event.state === 'connected') {
            console.info('🔗 [Protocol] Agent WebSocket connected');
            
            // Handle reconnection logic
            if (event.isReconnection) {
              log('Agent WebSocket reconnected - resetting greeting state');
              dispatch({ type: 'CONNECTION_TYPE_CHANGE', isNew: false });
              dispatch({ type: 'RESET_GREETING_STATE' });
            } else {
              log('Agent WebSocket connected for first time');
              dispatch({ type: 'CONNECTION_TYPE_CHANGE', isNew: true });
            }
          }
          
          dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'agent', state: event.state });
          onConnectionStateChange?.('agent', event.state);
          lastConnectionStates.current.agent = event.state;
        } else {
          if (props.debug) {
            console.log('🔧 [DEBUG] Agent state unchanged, skipping:', event.state);
          }
        }
        
        // Reset settings flag when connection closes for lazy reconnection
        if (event.state === 'closed') {
          if (props.debug) {
            console.log('🔧 [Connection] Agent connection closed - checking for errors or reasons');
            console.log('🔧 [Connection] Connection close event details:', event);
          }
          
          dispatch({ type: 'SETTINGS_SENT', sent: false });
          hasSentSettingsRef.current = false; // Reset ref when connection closes
          (window as any).globalSettingsSent = false; // Reset global flag when connection closes
          settingsSentTimeRef.current = null; // Reset settings time
          if (props.debug) {
            console.log('🔧 [Connection] hasSentSettingsRef and globalSettingsSent reset to false due to connection close');
          }
          lazyLog('Reset hasSentSettings flag due to connection close');
          
          // Disable microphone when connection closes (async operation)
          if (audioManagerRef.current && audioManagerRef.current.isRecordingActive()) {
            if (props.debug) {
              console.log('🔧 [Connection] Connection closed, disabling microphone');
            }
            // Use setTimeout to avoid blocking the event handler
            setTimeout(async () => {
              try {
                await audioManagerRef.current?.stopRecording();
                dispatch({ type: 'MIC_ENABLED_CHANGE', enabled: false });
                onMicToggle?.(false);
                if (props.debug) {
                  console.log('🔧 [Connection] Microphone disabled due to connection close');
                }
              } catch (error) {
                if (props.debug) {
                  console.log('🔧 [Connection] Error disabling microphone:', error);
                }
              }
            }, 0);
          }
        }
        
        // Send settings message when connection is established (unless we're lazy reconnecting)
        // Only send settings if they haven't been sent AND we're not in auto-connect mode
        // (auto-connect will handle settings sending via its own timeout)
        if (event.state === 'connected' && !isLazyReconnectingRef.current && !hasSentSettingsRef.current && !(window as any).globalSettingsSent && !autoConnect) {
          log('Connection established, sending settings via connection state handler');
          sendAgentSettings();
        } else if (event.state === 'connected' && isLazyReconnectingRef.current) {
          lazyLog('Skipping automatic settings send - lazy reconnection in progress');
        } else if (event.state === 'connected' && state.hasSentSettings) {
          log('Connection established but settings already sent, skipping');
        } else if (event.state === 'connected' && autoConnect) {
          log('Connection established but auto-connect will handle settings sending, skipping');
        }
      } else if (event.type === 'keepalive') {
        // Handle keepalive messages for logging
        if (props.debug) {
          console.log('🔧 [DEBUG] Agent keepalive event received:', event.data.service);
        }
        onKeepalive?.(event.data.service);
      } else if (event.type === 'message') {
        handleAgentMessage(event.data);
      } else if (event.type === 'binary') {
        handleAgentAudio(event.data);
      } else if (event.type === 're_enable_idle_timeout') {
        // Re-enable idle timeout resets for the other service when one detects meaningful activity
        console.log('🔄 [IDLE_TIMEOUT] Re-enabling idle timeout resets for transcription service due to agent activity');
        if (transcriptionManagerRef.current) {
          transcriptionManagerRef.current.enableIdleTimeoutResets();
        }
      } else if (event.type === 'error') {
        handleError(event.error);
      }
    });
      console.log('Agent unsubscribe result:', typeof unsubscribeResult, unsubscribeResult);
      agentUnsubscribe = unsubscribeResult;
    } else {
      log('Agent service not configured, skipping setup');
    }

    // --- AUDIO SETUP (CONDITIONAL) ---
    // We need audio for recording (transcription) or playback (agent)
    // For AGENT-ONLY mode, we can skip AudioManager initialization if we only need text interactions
    const needsAudioManager = isTranscriptionConfigured || (isAgentConfigured && agentOptions?.voice);
    
    if (needsAudioManager) {
      // Create audio manager
      audioManagerRef.current = new AudioManager({
        debug: props.debug,
      });

      // Set initial TTS mute state
      audioManagerRef.current.setTtsMuted(ttsMuted);
      dispatch({ type: 'TTS_MUTE_CHANGE', muted: ttsMuted });
      log(`🔇 Initial TTS mute state set to: ${ttsMuted}`);

    // Set up event listeners for audio manager
      audioUnsubscribe = audioManagerRef.current.addEventListener((event: AudioEvent) => {
      if (event.type === 'ready') {
        log('Audio manager ready');
      } else if (event.type === 'recording') {
        log('Recording state:', event.isRecording);
        dispatch({ type: 'RECORDING_STATE_CHANGE', isRecording: event.isRecording });
      } else if (event.type === 'playing') {
        log('Playing state:', event.isPlaying);
        dispatch({ type: 'PLAYBACK_STATE_CHANGE', isPlaying: event.isPlaying });
        
        // Check if we should re-enable idle timeout resets when audio stops playing
        if (!event.isPlaying) {
          const agentIdle = stateRef.current.agentState === 'idle';
          const userNotSpeaking = !stateRef.current.isUserSpeaking;
          
          if (agentIdle && userNotSpeaking) {
            manageIdleTimeoutResets('enable', 'AudioStopped+AllIdle');
          }
        }
      } else if (event.type === 'error') {
        handleError(event.error);
      } else if (event.type === 'data') {
        sendAudioData(event.data);
      }
    });

    // Component is ready immediately when configured - AudioManager is not a prerequisite
    // The component can accept text interactions and manual connections without audio
    dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
    
    // Initialize AudioManager for playback readiness (Issue #43 fix)
    // This ensures AudioContext is ready when greeting audio arrives
    audioManagerRef.current.initialize()
      .then(() => {
        log('AudioManager initialized successfully for playback readiness');
        
        // CRITICAL FIX for Issue #43: Ensure AudioContext is ready for playback
        // AudioContext may be suspended until user interaction, but we need it ready for greetings
        if (audioManagerRef.current && audioManagerRef.current.getAudioContext) {
          const audioContext = audioManagerRef.current.getAudioContext();
          
          // Expose AudioContext to window for testing (Issue #43 investigation)
          if (typeof window !== 'undefined') {
            (window as any).audioContext = audioContext;
            log('AudioContext exposed to window for testing');
          }
          
          if (audioContext && audioContext.state === 'suspended') {
            log('AudioContext is suspended - attempting to resume for greeting playback');
            audioContext.resume().then(() => {
              log('AudioContext resumed successfully - ready for greeting audio playback');
            }).catch((error: Error) => {
              log('Failed to resume AudioContext:', error);
              log('Note: AudioContext may require user interaction to resume');
            });
          } else {
            log(`AudioContext is already ${audioContext?.state} - ready for greeting audio playback`);
          }
        }
      })
      .catch((error: Error) => {
        log('AudioManager failed to initialize:', error);
        // Don't change isReady here - component can still work without audio
        // Audio features will be disabled, but text interactions still work
      });
    } else {
      log('AudioManager not needed for this configuration, skipping setup');
      // For text-only agent interactions, we can be ready immediately
      dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
    }

    // Auto-connect dual mode logic
    console.log('Auto-connect check:', { autoConnect, isAgentConfigured, isTranscriptionConfigured, agentManagerRef: !!agentManagerRef.current, transcriptionManagerRef: !!transcriptionManagerRef.current });
    if (autoConnect === true && isAgentConfigured && !autoConnectAttemptedRef.current && !(window as any).globalAutoConnectAttempted) {
      // Validate API key before attempting connection
      const isValidApiKey = apiKey && 
        apiKey !== 'your-deepgram-api-key-here' && 
        apiKey !== 'your_actual_deepgram_api_key_here' &&
        !apiKey.startsWith('test-') && 
        apiKey.length >= 20;
      
      if (!isValidApiKey) {
        log('⚠️ Auto-connect skipped: Invalid or missing API key');
        log(`API key status: ${apiKey ? `"${apiKey.substring(0, 10)}..."` : 'undefined'}`);
        dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
        return;
      }
      
      log('Auto-connect dual mode enabled, establishing connection');
      
      // For auto-connect dual mode, set ready immediately since the user can interact via text
      // even if audio is not available
      dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
      
      // Auto-connect to both services in dual mode
      setTimeout(async () => {
        // Check again inside setTimeout to prevent multiple executions
        if (autoConnectAttemptedRef.current) {
          console.log('Auto-connect already attempted, skipping');
          return;
        }
        autoConnectAttemptedRef.current = true; // Mark as attempted
        
        console.log('Auto-connect timeout executing, agentManagerRef.current:', !!agentManagerRef.current, 'transcriptionManagerRef.current:', !!transcriptionManagerRef.current);
        
        try {
          // Connect transcription service if configured
          if (transcriptionManagerRef.current) {
            console.log('Auto-connect: Connecting transcription service...');
            await transcriptionManagerRef.current.connect();
            console.log('Auto-connect: Transcription service connected');
          }
          
          // Connect agent service if configured
          if (agentManagerRef.current) {
            console.log('Auto-connect: Connecting agent service...');
            await agentManagerRef.current.connect();
            console.log('Auto-connect: Agent service connected');
            
            // Wait for connection to be fully established (simplified)
            await new Promise(resolve => setTimeout(resolve, 200)); // Simple wait
            
            // Send settings immediately after connection to enable greeting
            if (agentManagerRef.current.getState() === 'connected') {
              log('Auto-connect: Connection established, sending settings for greeting');
              // Only send settings if they haven't been sent yet
              if (!hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
                sendAgentSettings();
              } else {
                log('Auto-connect: Settings already sent, skipping');
              }
            } else {
              log('Auto-connect: Connection not fully established after waiting');
            }
          }
        } catch (error) {
          log('Auto-connect failed:', error);
        }
      }, 100); // Small delay to ensure audio manager is ready
    } else {
      log('Auto-connect disabled or agent not configured', { autoConnect, isAgentConfigured });
      // Component is already ready from the AudioManager initialization above
    }

    // Clean up
    return () => {
      transcriptionUnsubscribe();
      if (isAgentConfigured && typeof agentUnsubscribe === 'function') {
        agentUnsubscribe();
      }
      audioUnsubscribe();
      
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current.close();
      transcriptionManagerRef.current = null;
      }
      
      if (agentManagerRef.current) {
        agentManagerRef.current.close();
      agentManagerRef.current = null;
      }
      
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
      audioManagerRef.current = null;
      }
      
      // Ensure state is reset on unmount
      dispatch({ type: 'READY_STATE_CHANGE', isReady: false });
      dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'transcription', state: 'closed' });
      dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'agent', state: 'closed' });
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
      dispatch({ type: 'RECORDING_STATE_CHANGE', isRecording: false });
      dispatch({ type: 'PLAYBACK_STATE_CHANGE', isPlaying: false });
    };
  }, [apiKey, transcriptionOptions, agentOptions, endpointConfig, props.debug, autoConnect]); 

  // Notify ready state changes ONLY when the value actually changes
  useEffect(() => {
    if (onReady && state.isReady !== prevIsReadyRef.current) {
      log('Notifying parent: isReady changed to', state.isReady);
      onReady(state.isReady);
      prevIsReadyRef.current = state.isReady;
    }
  }, [state.isReady, onReady]);

  // Handle idle timeout resets when audio finishes playing
  useEffect(() => {
    // When audio finishes playing AND both agent and user are idle, re-enable idle timeout
    // Agent should be idle (not thinking, speaking, or sleeping) and user not speaking
    const agentIdle = state.agentState === 'idle';
    const audioNotPlaying = !state.isPlaying;
    const userNotSpeaking = !state.isUserSpeaking;
    
    if (agentIdle && audioNotPlaying && userNotSpeaking) {
      manageIdleTimeoutResets('enable', 'AudioFinished+AllIdle');
    }
  }, [state.isPlaying, state.isUserSpeaking, state.agentState, manageIdleTimeoutResets]);

  // Handle idle timeout resets for user speaking events
  useEffect(() => {
    if (onUserStartedSpeaking) {
      // EXTEND: User started speaking, disable idle timeout resets
      manageIdleTimeoutResets('disable', 'UserStartedSpeaking');
    }
  }, [onUserStartedSpeaking, manageIdleTimeoutResets]);

  useEffect(() => {
    if (onUserStoppedSpeaking) {
      // END: User stopped speaking, enable idle timeout resets
      manageIdleTimeoutResets('enable', 'UserStoppedSpeaking');
    }
  }, [onUserStoppedSpeaking, manageIdleTimeoutResets]);

  useEffect(() => {
    if (onUtteranceEnd) {
      // END: UtteranceEnd detected, enable idle timeout resets
      manageIdleTimeoutResets('enable', 'UtteranceEnd');
    }
  }, [onUtteranceEnd, manageIdleTimeoutResets]);

  useEffect(() => {
    if (onUserMessage) {
      // EXTEND: User sent text message, disable idle timeout resets
      manageIdleTimeoutResets('disable', 'UserMessage');
    }
  }, [onUserMessage, manageIdleTimeoutResets]);

  // Notify agent state changes ONLY when the value actually changes
  useEffect(() => {
    if (onAgentStateChange && state.agentState !== prevAgentStateRef.current) {
      log('Notifying parent: agentState changed to', state.agentState);
      onAgentStateChange(state.agentState);
      prevAgentStateRef.current = state.agentState;
      
      // Handle idle timeout resets based on agent state changes
      if (state.agentState === 'listening' || state.agentState === 'thinking' || state.agentState === 'speaking') {
        // EXTEND: Agent is active, disable idle timeout resets
        manageIdleTimeoutResets('disable', `AgentState:${state.agentState}`);
      } else if (state.agentState === 'idle' || state.agentState === 'sleeping') {
        // END: Agent is idle/sleeping, enable idle timeout resets (if user not speaking)
        if (!state.isUserSpeaking) {
          manageIdleTimeoutResets('enable', `AgentState:${state.agentState}`);
        }
      }
    }
  }, [state.agentState, onAgentStateChange, state.isUserSpeaking, manageIdleTimeoutResets]);

  // Notify playback state changes ONLY when the value actually changes
  useEffect(() => {
    if (onPlaybackStateChange && state.isPlaying !== prevIsPlayingRef.current) {
      log('Notifying parent: isPlaying changed to', state.isPlaying);
      onPlaybackStateChange(state.isPlaying);
      prevIsPlayingRef.current = state.isPlaying;
      
      // Handle idle timeout resets based on playback state changes
      if (state.isPlaying) {
        // EXTEND: Audio is playing, disable idle timeout resets
        manageIdleTimeoutResets('disable', 'PlaybackStarted');
      } else {
        // END: Audio finished playing, enable idle timeout resets (if agent and user idle)
        if (state.agentState === 'idle' && !state.isUserSpeaking) {
          manageIdleTimeoutResets('enable', 'PlaybackFinished');
        }
      }
    }
  }, [state.isPlaying, onPlaybackStateChange, state.agentState, state.isUserSpeaking, manageIdleTimeoutResets]);

  // Type guard for transcription messages
  const isTranscriptionMessage = (data: unknown): data is { type: string; [key: string]: unknown } => {
    const isObject = typeof data === 'object';
    const isNotNull = data !== null;
    const hasType = isObject && isNotNull && 'type' in data;
    const result = isObject && isNotNull && hasType;
    
    if (props.debug) {
      console.log('🔍 [DEBUG] isTranscriptionMessage check:', {
        data: data,
        isObject,
        isNotNull,
        hasType,
        result
      });
    }
    return result;
  };

  // Handle transcription messages - only relevant if transcription is configured
  const handleTranscriptionMessage = (data: unknown) => {
    if (props.debug) {
      console.log('🔍 [DEBUG] handleTranscriptionMessage called with:', data);
    }
    
    // Add simplified transcript log for better readability - always show with [TRANSCRIPT] prefix
    if (typeof data === 'object' && data !== null && 'alternatives' in data) {
      const transcriptData = data as { 
        alternatives?: Array<{ transcript?: string }>; 
        is_final?: boolean;
        speech_final?: boolean;
      };
      const transcript = transcriptData.alternatives?.[0]?.transcript;
      if (transcript && transcript.trim()) {
        console.log(`[TRANSCRIPT] "${transcript}" ${transcriptData.is_final ? '(final)' : '(interim)'}${transcriptData.speech_final ? ' [SPEECH_FINAL]' : ''}`);
        
        // CRITICAL FIX: Use Deepgram's recommended end-of-speech signals
        if (transcriptData.speech_final === true) {
          // speech_final=true - Deepgram's endpointing detected speech has ended
          if (props.debug) {
            console.log('🎯 [SPEECH] speech_final=true received - user finished speaking (endpointing)');
          }
          
          // Re-enable idle timeout resets when user finishes speaking
          manageIdleTimeoutResets('enable', 'speech_final=true received');
          
          // User stopped speaking
          if (userSpeakingRef.current) {
            userSpeakingRef.current = false;
            onUserStoppedSpeaking?.();
          }
          dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          updateKeepaliveState(false);
          
          if (stateRef.current.agentState === 'listening') {
            dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
          }
        } else if (transcriptData.is_final && !transcriptData.speech_final) {
          // Final transcript without speech_final - user finished speaking (fallback)
          if (props.debug) {
            console.log('🎯 [SPEECH] Final transcript received - user finished speaking (fallback)');
          }
          
          // Re-enable idle timeout resets when user finishes speaking
          manageIdleTimeoutResets('enable', 'Final transcript received');
          
          // User stopped speaking
          if (userSpeakingRef.current) {
            userSpeakingRef.current = false;
            onUserStoppedSpeaking?.();
          }
          dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          updateKeepaliveState(false);
          
          if (stateRef.current.agentState === 'listening') {
            dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
          }
        } else if (!transcriptData.is_final) {
          // Interim transcript - user is actively speaking
          if (props.debug) {
            console.log('🎯 [SPEECH] Interim transcript received - user is speaking');
          }
          
          // Disable idle timeout resets while user is speaking
          manageIdleTimeoutResets('disable', 'Interim transcript received');
          
          onUserStartedSpeaking?.();
          dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: true });
          updateKeepaliveState(true);
          
          if (stateRef.current.agentState === 'idle' || stateRef.current.agentState === 'sleeping') {
            dispatch({ type: 'AGENT_STATE_CHANGE', state: 'listening' });
          }
        }
      }
    }
    
    // Always log VAD events for debugging
    if (typeof data === 'object' && data !== null && 'type' in data && (data as any).type === 'vad') {
      if (props.debug) {
        console.log('🎯 [VAD] VADEvent received in handleTranscriptionMessage:', data);
      }
    }
    
    // Always log all transcription messages to debug VAD events
    console.log('📝 [TRANSCRIPTION] Message received:', data);
    
    // Debug: Log all transcription messages (only in debug mode)
    if (props.debug) {
      console.log('📝 [TRANSCRIPTION] Message received:', data);
    }
    
    // Skip processing if transcription service isn't configured
    if (!transcriptionManagerRef.current) {
      if (props.debug) {
        console.log('🔍 [DEBUG] Transcription service not configured, returning early');
      }
      log('Received unexpected transcription message but service is not configured:', data);
      return;
    }
    
    if (props.debug) {
      console.log('🔍 [DEBUG] Transcription service is configured, continuing...');
    }
    
    // Debug: Log message type for VAD debugging
    if (typeof data === 'object' && data !== null && 'type' in data) {
      if (props.debug) {
        console.log('🔍 [DEBUG] Processing message type:', (data as any).type);
      }
    }

    // Type guard check
    if (props.debug) {
      console.log('🔍 [DEBUG] Checking type guard for data:', data);
    }
    const typeGuardResult = isTranscriptionMessage(data);
    if (props.debug) {
      console.log('🔍 [DEBUG] isTranscriptionMessage result:', typeGuardResult);
    }
    if (!typeGuardResult) {
      if (props.debug) {
        console.log('🔍 [DEBUG] Type guard failed, returning early');
      }
      log('Invalid transcription message format:', data);
      return;
    }
    
    if (props.debug) {
      console.log('🔍 [DEBUG] Message passed type guard, processing...');
    }
    
    // Check if agent is in sleep mode
    const isSleepingOrEntering = 
      agentManagerRef.current && (
      stateRef.current.agentState === 'sleeping' || 
        stateRef.current.agentState === 'entering_sleep'
      );
      

    if (data.type === 'Results' || data.type === 'Transcript') {
      if (isSleepingOrEntering) {
        sleepLog('Ignoring transcript (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Don't re-enable idle timeout resets here
      // Let WebSocketManager handle it based on message content
      const transcript = data as unknown as TranscriptResponse;
      onTranscriptUpdate?.(transcript);
      return;
    }

    if (data.type === 'UtteranceEnd') {
      if (props.debug) {
        console.log('🎯 [SPEECH] UtteranceEnd message received - user finished speaking (word timing)');
      }
      if (isSleepingOrEntering) {
        sleepLog('Ignoring UtteranceEnd event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Re-enable idle timeout resets when user finishes speaking (per Deepgram docs)
      if (props.debug) {
        console.log('🎯 [SPEECH] UtteranceEnd detected - re-enabling idle timeout resets');
      }
      
      // Re-enable idle timeout resets for both services
      manageIdleTimeoutResets('enable', 'UtteranceEnd received');
      
      // Call the callback with channel and lastWordEnd data
      const channel = Array.isArray(data.channel) ? data.channel : [0, 1];
      const lastWordEnd = typeof data.last_word_end === 'number' ? data.last_word_end : 0;
      onUtteranceEnd?.({ channel, lastWordEnd });
      
      // User stopped speaking
      if (userSpeakingRef.current) {
        userSpeakingRef.current = false;
        onUserStoppedSpeaking?.();
      }
      return;
    }
    
    // Handle SpeechStarted event from transcription service
    if (data.type === 'SpeechStarted') {
      if (props.debug) {
        console.log('🎯 [VAD] SpeechStarted message received from transcription service:', data);
      }
      if (isSleepingOrEntering) {
        sleepLog('Ignoring SpeechStarted event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Call the specific SpeechStarted callback
      if (props.onSpeechStarted) {
        props.onSpeechStarted({ 
          channel: data.channel as number[], 
          timestamp: data.timestamp as number 
        });
      }
      
      // User started speaking
      if (!userSpeakingRef.current) {
        userSpeakingRef.current = true;
        onUserStartedSpeaking?.();
      }
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: true });
      updateKeepaliveState(true);
      
      if (stateRef.current.agentState === 'idle' || stateRef.current.agentState === 'sleeping') {
        dispatch({ type: 'AGENT_STATE_CHANGE', state: 'listening' });
      }
      return;
    }
    
    // Note: SpeechStopped is not a real Deepgram event - removed handler
    // Use UtteranceEnd for speech end detection instead
  };

  // Lazy reconnection logging helper
  const lazyLog = (...args: unknown[]) => {
    if (props.debug) {
      console.log(LAZY_RECONNECT_CONFIG.LOG_PREFIX, ...args);
    }
  };

  // Check if WebSocket connection needs reconnection
  const needsReconnection = (): boolean => {
    try {
      console.log(`🔍 [needsReconnection] About to call isConnected()`);
      const isWebSocketOpen = agentManagerRef.current?.isConnected() || false;
      console.log(`🔍 [needsReconnection] isConnected() returned: ${isWebSocketOpen}`);
      
      // Only reconnect if WebSocket is actually closed or manager doesn't exist
      const needsReconnect = !agentManagerRef.current || !isWebSocketOpen;
      console.log(`🔍 [needsReconnection] agentManagerRef.current: ${!!agentManagerRef.current}, isConnected: ${isWebSocketOpen}, hasSentSettings: ${state.hasSentSettings}, needsReconnect: ${needsReconnect}`);
      return needsReconnect;
    } catch (error) {
      console.log(`🔍 [needsReconnection] Error calling isConnected():`, error);
      // If there's an error, assume we need to reconnect
      return true;
    }
  };

  // Send agent settings after connection is established - only if agent is configured
  const sendAgentSettings = () => {
    console.log('🔧 [sendAgentSettings] Called');
    console.log(`🔧 [sendAgentSettings] agentManagerRef.current: ${!!agentManagerRef.current}`);
    console.log(`🔧 [sendAgentSettings] agentOptions: ${!!agentOptions}`);
    console.log(`🔧 [sendAgentSettings] hasSentSettings: ${state.hasSentSettings}`);
    console.log(`🔧 [sendAgentSettings] hasSentSettingsRef.current: ${hasSentSettingsRef.current}`);
    
    if (!agentManagerRef.current || !agentOptions) {
      console.log('🔧 [sendAgentSettings] Cannot send agent settings: agent manager not initialized or agentOptions not provided');
      return;
    }
    
    // Check if settings have already been sent (welcome-first behavior)
    // Use both ref and global flag to avoid stale closure issues and cross-component duplicates
    if (hasSentSettingsRef.current || (window as any).globalSettingsSent) {
      console.log('🔧 [sendAgentSettings] Settings already sent (via ref or global), skipping');
      console.log('🔧 [sendAgentSettings] hasSentSettingsRef.current:', hasSentSettingsRef.current);
      console.log('🔧 [sendAgentSettings] globalSettingsSent:', (window as any).globalSettingsSent);
      return;
    }
    
    // Record when settings were sent (but don't mark as applied until SettingsApplied is received)
    settingsSentTimeRef.current = Date.now();
    console.log('🔧 [sendAgentSettings] Settings message sent, waiting for SettingsApplied confirmation');
    
    // Build the Settings message based on agentOptions
    const settingsMessage = {
      type: 'Settings',
      audio: {
        input: {
          encoding: 'linear16',
          sample_rate: 16000
        },
        output: {
          encoding: 'linear16',
          sample_rate: 24000
        }
      },
      agent: {
        language: agentOptions.language || 'en',
        listen: {
          provider: {
            type: 'deepgram',
            model: agentOptions.listenModel || 'nova-2'
          }
        },
        think: {
          provider: {
            type: agentOptions.thinkProviderType || 'open_ai',
            model: agentOptions.thinkModel || 'gpt-4o-mini'
          },
          prompt: agentOptions.instructions || 'You are a helpful voice assistant.',
          ...(agentOptions.thinkEndpointUrl && agentOptions.thinkApiKey ? {
            endpoint: {
              url: agentOptions.thinkEndpointUrl,
              headers: {
                authorization: `bearer ${agentOptions.thinkApiKey}`,
              },
            }
          } : {})
        },
        // Only include speak provider if TTS is not muted
        ...(!state.ttsMuted ? {
          speak: {
            provider: {
              type: 'deepgram',
              model: agentOptions.voice || 'aura-asteria-en'
            }
          }
        } : {}),
        greeting: agentOptions.greeting,
        context: transformConversationHistory(state.conversationHistory) // Include conversation context in correct Deepgram API format
      }
    };
    
    console.log('📤 [Protocol] Sending agent settings with context (correct Deepgram API format):', { 
      conversationHistoryLength: state.conversationHistory.length,
      contextMessages: transformConversationHistory(state.conversationHistory).messages,
      ttsMuted: state.ttsMuted,
      hasSpeakProvider: 'speak' in settingsMessage.agent
    });
    agentManagerRef.current.sendJSON(settingsMessage);
    console.log('📤 [Protocol] Settings message sent successfully');
    
    // Mark settings as sent for welcome-first behavior
    dispatch({ type: 'SETTINGS_SENT', sent: true });
    console.log('📤 [Protocol] Settings sent state updated to true');
  };

  // Microphone control function
  const toggleMic = async (enable: boolean) => {
    console.log('🎤 [toggleMic] called with:', enable);
    console.log('🎤 [toggleMic] hasSentSettings:', state.hasSentSettings);
    console.log('🎤 [toggleMic] hasSentSettingsRef:', hasSentSettingsRef.current);
    console.log('🎤 [toggleMic] audioManagerRef.current:', !!audioManagerRef.current);
    
    if (enable) {
      // Check if agent is connected first
      if (!agentManagerRef.current || agentManagerRef.current.getState() !== 'connected') {
        console.log('❌ Cannot enable microphone - agent not connected, state:', agentManagerRef.current?.getState());
        return;
      }
      
      // Check if settings have been applied (not just sent)
      if (!hasSentSettingsRef.current && !(window as any).globalSettingsSent && !state.hasSentSettings) {
        console.log('❌ Cannot enable microphone before settings are applied');
        console.log('❌ Settings must be sent and SettingsApplied received before microphone can be enabled');
        
        // Try to send settings if they haven't been sent yet
        if (agentManagerRef.current && agentOptions) {
          console.log('🔧 Attempting to send settings from toggleMic');
          sendAgentSettings();
          
          // Wait for SettingsApplied message (up to 5 seconds)
          console.log('⏳ Waiting for SettingsApplied confirmation...');
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds with 100ms intervals
          
          while (attempts < maxAttempts && !hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (!hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
            console.log('❌ SettingsApplied not received within timeout');
            return;
          }
        } else {
          console.log('❌ Cannot send settings: agentManagerRef or agentOptions missing');
          return;
        }
      } else if (hasSentSettingsRef.current || (window as any).globalSettingsSent || state.hasSentSettings) {
        console.log('✅ Settings already applied, proceeding with microphone enable');
      } else {
        console.log('❌ Cannot enable microphone: settings not applied');
        return;
      }
      
      // Ensure component is started (creates audio manager)
      if (!audioManagerRef.current) {
        console.log('🔧 Audio manager not created, starting component...');
        try {
          await start();
          console.log('✅ Component started, audio manager created');
        } catch (error) {
          console.log('❌ Failed to start component:', error);
          return;
        }
      }
      
      if (audioManagerRef.current) {
        console.log('✅ Enabling microphone...');
        console.log('Calling startRecording on audioManagerRef.current');
        
        // Set global flag to prevent HMR disruption
        (window as any).audioCaptureInProgress = true;
        
        try {
          await audioManagerRef.current.startRecording();
          console.log('✅ startRecording completed successfully');
          
          // Connect transcription service for VAD events when microphone starts
          if (transcriptionManagerRef.current && transcriptionManagerRef.current.getState() !== 'connected') {
            if (props.debug) {
              console.log('🎤 [VAD] Connecting transcription service for VAD events');
            }
            try {
              await transcriptionManagerRef.current.connect();
              if (props.debug) {
                console.log('🎤 [VAD] Transcription service connected for VAD events');
              }
            } catch (error) {
              if (props.debug) {
                console.log('🎤 [VAD] Failed to connect transcription service:', error);
              }
            }
          }
          
          // Wait for settings to be processed by Deepgram before allowing audio data
          if (settingsSentTimeRef.current) {
            const timeSinceSettings = Date.now() - settingsSentTimeRef.current;
            if (timeSinceSettings < 500) {
              const waitTime = 500 - timeSinceSettings;
              console.log(`⏳ Waiting ${waitTime}ms for settings to be processed by Deepgram...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
          
          console.log('🎤 [toggleMic] Dispatching MIC_ENABLED_CHANGE with enabled: true');
          dispatch({ type: 'MIC_ENABLED_CHANGE', enabled: true });
          console.log('🎤 [toggleMic] Calling onMicToggle with true');
          onMicToggle?.(true);
          log('✅ Microphone enabled');
          // Reset idle timeout when microphone is enabled (user activity)
          if (agentManagerRef.current) {
            agentManagerRef.current.resetIdleTimeout();
          }
        } catch (error) {
          console.log('❌ startRecording failed:', error);
          (window as any).audioCaptureInProgress = false;
          throw error;
        }
      } else {
        log('❌ Cannot enable microphone: audioManagerRef.current is null');
      }
    } else {
      // Interrupt any ongoing TTS playback when stopping recording
      if (agentManagerRef.current) {
        log('Interrupting agent when stopping microphone');
        interruptAgent();
      }
        
      if (audioManagerRef.current) {
        log('Disabling microphone...');
        audioManagerRef.current.stopRecording();
        dispatch({ type: 'MIC_ENABLED_CHANGE', enabled: false });
        onMicToggle?.(false);
        log('Microphone disabled');
        
        // Reset global flag
        (window as any).audioCaptureInProgress = false;
        
        // Reset idle timeout when microphone is disabled (user activity)
        if (agentManagerRef.current) {
          agentManagerRef.current.resetIdleTimeout();
        }
      }
    }
  };

  // Handle microphoneEnabled prop changes
  useEffect(() => {
    if (microphoneEnabled !== undefined && microphoneEnabled !== state.micEnabledInternal) {
      toggleMic(microphoneEnabled);
    }
  }, [microphoneEnabled]);

  // Type guard for agent messages
  const isAgentMessage = (data: unknown): data is { type: string; [key: string]: unknown } => {
    return typeof data === 'object' && data !== null && 'type' in data;
  };

  // Handle agent messages - only relevant if agent is configured
  const handleAgentMessage = (data: unknown) => {
    // Debug: Log all agent messages with type
    const messageType = typeof data === 'object' && data !== null && 'type' in data ? (data as any).type : 'unknown';
    log(`🔍 [DEBUG] Received agent message (type: ${messageType}):`, data);
    
    // Don't re-enable idle timeout resets here
    // Let WebSocketManager handle meaningful message detection
    // After UtteranceEnd, only new connection should re-enable
    
    // Skip processing if agent service isn't configured
    if (!agentManagerRef.current) {
      log('Received unexpected agent message but service is not configured:', data);
      return;
    }

    // Type guard check
    if (!isAgentMessage(data)) {
      log('Invalid agent message format:', data);
      return;
    }
    
    const isSleepingOrEntering = 
      stateRef.current.agentState === 'sleeping' || 
      stateRef.current.agentState === 'entering_sleep';

    if (data.type === 'UserStartedSpeaking') {
      log('🎤 [VAD] UserStartedSpeaking message received');
      if (isSleepingOrEntering) {
        sleepLog('Ignoring UserStartedSpeaking event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Handle barge-in during agent speaking
      if (state.greetingInProgress) {
        log('User started speaking during agent speech - aborting playback');
        if (audioManagerRef.current) {
          audioManagerRef.current.abortPlayback();
        }
        onAgentSilent?.();
        dispatch({ type: 'GREETING_PROGRESS_CHANGE', inProgress: false });
        dispatch({ type: 'GREETING_STARTED', started: false });
      }
      
      // Normal speech handling when not sleeping
      log('Clearing audio queue (barge-in)');
      clearAudio();
      onUserStartedSpeaking?.();
      
      // Update VAD state
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: true });
      
      // Re-enable keepalives when user starts speaking
      updateKeepaliveState(true);
      
      if (isWaitingForUserVoiceAfterSleep.current) {
        log('User started speaking after wake - resetting waiting flag');
        isWaitingForUserVoiceAfterSleep.current = false;
      }
      
      sleepLog('Dispatching AGENT_STATE_CHANGE to listening (from UserStartedSpeaking)');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'listening' });
      return;
    }

    // Handle Welcome message for dual mode connection
    if (data.type === 'Welcome') {
      console.info('✅ [Protocol] Welcome message received - dual mode connection established');
      log('Welcome message received - dual mode connection established');
      if (!state.welcomeReceived) {
        dispatch({ type: 'WELCOME_RECEIVED', received: true });
        onConnectionReady?.();
        
        // Only trigger greeting for new connections, not reconnections
        if (isNewConnectionRef.current) {
          log('New connection - triggering greeting flow');
          dispatch({ type: 'GREETING_PROGRESS_CHANGE', inProgress: true });
        } else {
          log('Reconnection detected - skipping greeting');
        }
      }
      return;
    }
    
    // Handle SettingsApplied message - settings are now active
    if (data.type === 'SettingsApplied') {
      console.info('✅ [Protocol] SettingsApplied received - settings are now active');
      log('SettingsApplied received - settings are now active');
      // Only mark as sent when we get confirmation from Deepgram
      hasSentSettingsRef.current = true;
      (window as any).globalSettingsSent = true;
      dispatch({ type: 'SETTINGS_SENT', sent: true });
      console.log('🎯 [SettingsApplied] Settings confirmed by Deepgram, audio data can now be processed');
      return;
    }
    
    if (data.type === 'AgentThinking') {
      sleepLog('Dispatching AGENT_STATE_CHANGE to thinking');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      
      // Disable keepalives when agent starts thinking (user stopped speaking)
      updateKeepaliveState(false);
      
      // Disable idle timeout resets during agent thinking
      manageIdleTimeoutResets('disable', 'AgentThinking');
      
      return;
    }
    
        if (data.type === 'AgentStartedSpeaking') {
          console.log('🎯 [AGENT] AgentStartedSpeaking received - disabling idle timeout resets');
          sleepLog('Dispatching AGENT_STATE_CHANGE to speaking');
          dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });

      // Track agent speaking
      if (state.greetingInProgress && !state.greetingStarted) {
        dispatch({ type: 'GREETING_STARTED', started: true });
      }
      
      // Disable idle timeout resets during agent speaking
      manageIdleTimeoutResets('disable', 'AgentStartedSpeaking');
      
      // Always call onAgentSpeaking when agent starts speaking
      onAgentSpeaking?.();
      return;
    }
    
    if (data.type === 'AgentAudioDone') {
      sleepLog('Dispatching AGENT_STATE_CHANGE to idle (from AgentAudioDone)');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });

      // Track agent silent
      if (state.greetingInProgress) {
        dispatch({ type: 'GREETING_PROGRESS_CHANGE', inProgress: false });
        dispatch({ type: 'GREETING_STARTED', started: false });
      }
      
      // Reset user speaking state when agent finishes speaking
      // This is important for text-based interactions where no UtteranceEnd is received
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
      if (userSpeakingRef.current) {
        userSpeakingRef.current = false;
        onUserStoppedSpeaking?.();
      }
      
      // DON'T re-enable idle timeout resets on AgentAudioDone
      // This is the generation event, not the playback event
      // The actual playback completion is handled by the audio manager
      
      // Always call onAgentSilent when agent finishes speaking
      onAgentSilent?.();
      return;
    }
    
    // Handle conversation text
    if (data.type === 'ConversationText') {
      const content = typeof data.content === 'string' ? data.content : '';
      
      // CRITICAL FIX: Skip processing if AudioContext is suspended (prevents idle timeout bug)
      const audioContext = audioManagerRef.current?.getAudioContext();
      if (audioContext?.state === 'suspended') {
        log('⚠️ Skipping ConversationText processing - AudioContext is suspended, waiting for user interaction');
        return;
      }
      
      // If we receive ConversationText, this means the agent is actively responding
      // Disable idle timeout resets to prevent connection drops during agent response
      if (stateRef.current.agentState === 'idle') {
        console.log('🎯 [AGENT] ConversationText received - disabling idle timeout resets (agent responding)');
        manageIdleTimeoutResets('disable', 'ConversationText');
      }
      
      // Track conversation messages for lazy reconnection
      const conversationMessage: ConversationMessage = {
        role: data.role as ConversationRole,
        content: content,
        timestamp: Date.now()
      };
      dispatch({ type: 'ADD_CONVERSATION_MESSAGE', message: conversationMessage });
      lazyLog(`Tracked conversation message: ${data.role} - "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
      
      if (data.role === 'assistant') {
        const response: LLMResponse = {
          type: 'llm',
          text: content,
          metadata: data,
        };
        
        onAgentUtterance?.(response);
        return;
      } 
      else if (data.role === 'user') {
        const response = {
          type: 'user' as const,
          text: content,
          metadata: data,
        };
        
        onUserMessage?.(response);
        return;
      }
    }
    
    // Handle errors
    if (data.type === 'Error') {
      const errorCode = typeof data.code === 'string' ? data.code : 'agent_error';
      const errorMessage = typeof data.description === 'string' ? data.description : 'Unknown agent error';
      
      // Handle SETTINGS_ALREADY_APPLIED as a warning, not an error
      if (errorCode === 'SETTINGS_ALREADY_APPLIED') {
        log('⚠️ [Agent] Settings already applied - this is normal during reconnection:', errorMessage);
        // Mark settings as sent to prevent further attempts
        hasSentSettingsRef.current = true;
        (window as any).globalSettingsSent = true;
        dispatch({ type: 'SETTINGS_SENT', sent: true });
        return;
      }
      
      handleError({
        service: 'agent',
        code: errorCode,
        message: errorMessage,
        details: data,
      });
      return;
    }
    
    // Handle warnings
    if (data.type === 'Warning') {
      const description = typeof data.description === 'string' ? data.description : 'Unknown warning';
      const code = typeof data.code === 'string' ? data.code : 'unknown';
      log('Agent warning:', description, 'Code:', code);
      return;
    }

    // Note: UserStoppedSpeaking is not a real Deepgram event - removed handler
    // Use UtteranceEnd for speech end detection instead

    // Handle UtteranceEnd events from Deepgram's end-of-speech detection
    if (data.type === 'UtteranceEnd') {
      if (props.debug) {
        console.log('🎯 [VAD] UtteranceEnd message received:', data);
      }
      if (isSleepingOrEntering) {
        sleepLog('Ignoring UtteranceEnd event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Call the callback with channel and lastWordEnd data
      const channel = Array.isArray(data.channel) ? data.channel : [0, 1];
      const lastWordEnd = typeof data.last_word_end === 'number' ? data.last_word_end : 0;
      onUtteranceEnd?.({ channel, lastWordEnd });
      
      // Track VAD event for redundancy detection
      const timestamp = Date.now();
      const vadEvent = { type: 'UtteranceEnd', speechDetected: false, timestamp, source: 'transcription' };
      trackVADEvent(vadEvent);
      
      // Update VAD state
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
      dispatch({ type: 'UTTERANCE_END', data: { channel, lastWordEnd } });
      
      // User stopped speaking
      if (userSpeakingRef.current) {
        userSpeakingRef.current = false;
        onUserStoppedSpeaking?.();
      }
      
      // Disable keepalives when utterance ends
      updateKeepaliveState(false);
      
      // Transition to thinking state if currently listening
      if (stateRef.current.agentState === 'listening') {
        sleepLog('Dispatching AGENT_STATE_CHANGE to thinking (from UtteranceEnd)');
        dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      }
      return;
    }

    // Handle VAD events from transcription service (vad type)
    // NOTE: SpeechStarted is handled in handleTranscriptionMessage (SpeechStopped is not a real Deepgram event)
    if (props.debug) {
      console.log('🔍 [DEBUG] Checking for VAD event type:', data.type);
    }
    if (data.type === 'vad') {
      if (props.debug) {
        console.log('🎯 [VAD] VADEvent message received:', data);
      }
      log('VADEvent message received:', data);
      
      // Call the callback with VAD event data
      const speechDetected = typeof data.speech_detected === 'boolean' ? data.speech_detected : false;
      const confidence = typeof data.confidence === 'number' ? data.confidence : undefined;
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
      onVADEvent?.({ speechDetected, confidence, timestamp });
      
      // Track VAD event for redundancy detection
      const vadEvent = { type: 'VADEvent', speechDetected, timestamp, source: 'transcription' };
      trackVADEvent(vadEvent);
      
      // IGNORE raw VAD events for idle timeout management - they detect any audio, not actual speech
      // Use speech_final=true and UtteranceEnd messages instead (per Deepgram best practices)
      if (props.debug) {
        console.log(`🎯 [VAD] VADEvent speechDetected: ${speechDetected} - IGNORING for idle timeout (use speech_final/UtteranceEnd instead)`);
      }
      
      // Don't change agent state or idle timeout based on VAD alone
      // Real speech detection should come from actual transcripts or user actions
      return;
    }
  };

  // Handle agent audio - only relevant if agent is configured
  const handleAgentAudio = (data: ArrayBuffer) => {
    // Don't re-enable idle timeout resets here
    // After UtteranceEnd, only new connection should re-enable
    
    // Skip processing if agent service isn't configured
    if (!agentManagerRef.current) {
      log('Received unexpected agent audio but service is not configured');
      return;
    }
    
    log(`handleAgentAudio called! Received buffer of ${data.byteLength} bytes`);
    
    // Skip audio playback if we're waiting for user voice after sleep
    if (isWaitingForUserVoiceAfterSleep.current) {
      log('Skipping audio playback because waiting for user voice after sleep');
      return;
    }
    
    // Check TTS mute state before processing audio
    if (audioManagerRef.current?.isTtsMuted) {
      log('🔇 TTS is muted - discarding audio buffer to prevent playback');
      return;
    }
    
    if (audioManagerRef.current) {
      log('Passing buffer to AudioManager.queueAudio()');
      console.log('🎵 [AUDIO] Audio context state:', audioManagerRef.current.getAudioContext?.()?.state);
      audioManagerRef.current.queueAudio(data)
        .then(() => {
          log('Successfully queued audio buffer for playback');
        })
        .catch((error: Error) => {
          log('Error queueing audio:', error);
        });
    } else {
      log('Cannot queue audio: audioManagerRef.current is null');
    }
  };

  // Send audio data to WebSockets - conditionally route based on configuration
  const sendAudioData = (data: ArrayBuffer) => {
    // Always log this critical method call
    console.log('🎵 [sendAudioData] CALLED with data size:', data.byteLength);
    console.log('🎵 [sendAudioData] hasSentSettingsRef.current:', hasSentSettingsRef.current);
    console.log('🎵 [sendAudioData] state.hasSentSettings:', state.hasSentSettings);
    console.log('🎵 [sendAudioData] agentManagerRef.current?.getState():', agentManagerRef.current?.getState());
    console.log('🎵 [sendAudioData] transcriptionManagerRef.current?.getState():', transcriptionManagerRef.current?.getState());
    
    // Debug logging only (reduce console spam)
    if (props.debug) {
      console.log('🎵 [sendAudioData] Called with data size:', data.byteLength);
      console.log('🎵 [sendAudioData] hasSentSettingsRef.current:', hasSentSettingsRef.current);
      console.log('🎵 [sendAudioData] state.hasSentSettings:', state.hasSentSettings);
      console.log('🎵 [sendAudioData] agentManagerRef.current?.getState():', agentManagerRef.current?.getState());
    }
    
    // Send to transcription service if configured and connected
      if (transcriptionManagerRef.current?.getState() === 'connected') {
        lazyLog('🎵 [TRANSCRIPTION] Sending audio data to transcription service for VAD events');
        transcriptionManagerRef.current.sendBinary(data);
      } else {
        lazyLog('🎵 [TRANSCRIPTION] Transcription service not connected, state:', transcriptionManagerRef.current?.getState());
      }
    
    // Send to agent service if configured, connected, and not in sleep mode
    if (agentManagerRef.current) {
      const connectionState = agentManagerRef.current.getState();
      
      // Early return for closed connections to prevent log spam
      if (connectionState === 'closed') {
        if (props.debug) console.log('🎵 [sendAudioData] Skipping agent service - not connected:', connectionState);
        return;
      }
      
      // Check if sleeping or entering sleep before sending to agent
      const isSleepingOrEntering = 
        stateRef.current.agentState === 'sleeping' || 
        stateRef.current.agentState === 'entering_sleep';
        
      if (connectionState === 'connected' && !isSleepingOrEntering) {
        // Check if settings have been sent and enough time has passed
        if (!hasSentSettingsRef.current) {
          if (props.debug) {
            console.log('🎵 [sendAudioData] ❌ CRITICAL: Cannot send audio data before settings are sent!');
            console.log('🎵 [sendAudioData] ❌ hasSentSettingsRef.current:', hasSentSettingsRef.current);
            console.log('🎵 [sendAudioData] ❌ state.hasSentSettings:', state.hasSentSettings);
          }
          return; // Don't send audio data
        }
        
        // Wait for settings to be processed by Deepgram (minimum 500ms)
        if (settingsSentTimeRef.current && Date.now() - settingsSentTimeRef.current < 500) {
          if (props.debug) console.log('🎵 [sendAudioData] ⏳ Waiting for settings to be processed by Deepgram...');
          return; // Don't send audio data yet
        }
        
        if (props.debug) console.log('🎵 [sendAudioData] ✅ Settings confirmed, sending to agent service');
        agentManagerRef.current.sendBinary(data);
        
        // Log successful audio transmission (debug level)
        lazyLog('🎵 [AUDIO] Audio data sent to Deepgram agent service');
      } else if (isSleepingOrEntering) {
        if (props.debug) {
          console.log('🎵 [sendAudioData] Skipping agent service - sleeping state:', stateRef.current.agentState);
          sleepLog('Skipping sendAudioData to agent (state:', stateRef.current.agentState, ')');
        }
      } else {
        if (props.debug) console.log('🎵 [sendAudioData] Skipping agent service - not connected:', connectionState);
      }
    }
  };

  // Start the connection
  const start = async (): Promise<void> => {
    try {
      log('Start method called');
      
      // Initialize audio if available (should already be initialized from the main useEffect)
      if (audioManagerRef.current) {
        try {
          log('Ensuring AudioManager is initialized...');
          await audioManagerRef.current.initialize();
          log('AudioManager initialized');
        } catch (error) {
          // The initialize method is idempotent and returns early if already initialized
          // If we get here, there was an actual error initializing
          log('Error initializing AudioManager:', error);
          throw error;
        }
      } else {
        log('AudioManager not configured, skipping initialization');
      }

      // Connect transcription WebSocket if configured
      if (transcriptionManagerRef.current) {
        log('Connecting Transcription WebSocket...');
        await transcriptionManagerRef.current.connect();
        log('Transcription WebSocket connected');
      } else {
        log('Transcription manager not configured, skipping connection');
      }
      
      // Connect agent WebSocket if configured
      if (agentManagerRef.current) {
        log('Connecting Agent WebSocket...');
        await agentManagerRef.current.connect();
        log('Agent WebSocket connected');
      } else {
        log('Agent manager not configured, skipping connection');
      }
      
      // Start recording if audio manager is available and microphone is enabled
      if (audioManagerRef.current) {
        if (state.micEnabledInternal) {
          log('Starting recording...');
          await audioManagerRef.current.startRecording();
          log('Recording started');
        } else {
          log('Microphone disabled, skipping recording start');
        }
      } else {
        log('AudioManager not available for recording - this is expected for text-only agent interactions');
      }
      
      // Set ready state to true after successful start
      dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
      log('Start method completed successfully');
    } catch (error) {
      log('Error within start method:', error);
      handleError({
        service: 'transcription',
        code: 'start_error',
        message: 'Failed to start voice interaction',
        details: error,
      });
      dispatch({ type: 'READY_STATE_CHANGE', isReady: false });
      throw error;
    }
  };

  // Connect for text-only interactions (no microphone)
  const connectTextOnly = async (): Promise<void> => {
    try {
      log('ConnectTextOnly method called');
      
      // Connect transcription WebSocket if configured
      if (transcriptionManagerRef.current) {
        log('Connecting Transcription WebSocket...');
        await transcriptionManagerRef.current.connect();
        log('Transcription WebSocket connected');
      } else {
        log('Transcription manager not configured, skipping connection');
      }
      
      // Connect agent WebSocket if configured
      if (agentManagerRef.current) {
        log('Connecting Agent WebSocket...');
        await agentManagerRef.current.connect();
        log('Agent WebSocket connected');
      } else {
        log('Agent manager not configured, skipping connection');
      }
      
      // DO NOT start recording - this is text-only mode
      log('Text-only connection established (no audio recording)');
      
      // Set ready state to true after successful text-only connection
      dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
    } catch (error) {
      log('Error within connectTextOnly method:', error);
      handleError({
        service: 'agent',
        code: 'connection_error',
        message: 'Failed to establish text-only connection',
        details: error,
      });
      dispatch({ type: 'READY_STATE_CHANGE', isReady: false });
      throw error;
    }
  };

  // Stop the connection
  const stop = async (): Promise<void> => {
    log('Stopping voice interaction');
    
    try {
      // Send CloseStream message to finalize any pending transcriptions (if configured)
      if (transcriptionManagerRef.current) {
        log('Sending CloseStream message to finalize transcription');
        transcriptionManagerRef.current.sendCloseStream();
      }
      
      // Stop recording if audio manager is available
      if (audioManagerRef.current) {
        audioManagerRef.current.stopRecording();
      }
      
      // Add a small delay to allow final transcripts to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close WebSockets if configured
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current.close();
      }
      
      if (agentManagerRef.current) {
        agentManagerRef.current.close();
      }
      
      // Signal ready after stopping - component can accept new connections
      dispatch({ type: 'READY_STATE_CHANGE', isReady: true }); 
      return Promise.resolve();
    } catch (error) {
      log('Error stopping:', error);
      handleError({
        service: 'transcription',
        code: 'stop_error',
        message: 'Error while stopping transcription',
        details: error,
      });
      dispatch({ type: 'READY_STATE_CHANGE', isReady: false });
      return Promise.reject(error);
    }
  };

  // Update agent instructions - only if agent is configured
  const updateAgentInstructions = (payload: UpdateInstructionsPayload): void => {
    if (!agentManagerRef.current) {
      log('Cannot update instructions: agent manager not initialized or not configured');
      return;
    }
    
    log('Updating agent instructions:', payload);
    
    // Use UpdatePrompt message for the new agent API
    agentManagerRef.current.sendJSON({
      type: 'UpdatePrompt',
      prompt: payload.instructions || payload.context || '',
    });
  };

  // Clear all audio playback
  const clearAudio = (): void => {
    log('📢 clearAudio helper called');
    
    if (!audioManagerRef.current) {
      log('❌ Cannot clear audio: audioManagerRef.current is null');
      return;
    }
    
    try {
      log('🔴 Calling audioManager.clearAudioQueue()');
      audioManagerRef.current.clearAudioQueue();
      
      // Additional audio cleanup
      if (audioManagerRef.current['audioContext']) {
        log('🔄 Manipulating audio context time reference');
        const ctx = audioManagerRef.current['audioContext'] as AudioContext;
        try {
          const silentBuffer = ctx.createBuffer(1, 1024, ctx.sampleRate);
          const silentSource = ctx.createBufferSource();
          silentSource.buffer = silentBuffer;
          silentSource.connect(ctx.destination);
          silentSource.start();
        } catch (e) {
          log('⚠️ Error creating silent buffer:', e);
        }
      }
    } catch (err) {
      log('❌ Error in clearAudio:', err);
    }
    
    log('📢 clearAudio helper completed');
  };

  // Interrupt the agent - only if agent is configured
  const interruptAgent = (): void => {
    log('🔴 interruptAgent method called');
    
    if (!agentManagerRef.current) {
      log('Cannot interrupt agent: agent manager not initialized or not configured');
      return;
    }
    
    clearAudio();
    log('🔴 Setting agent state to idle');
    sleepLog('Dispatching AGENT_STATE_CHANGE to idle (from interruptAgent)');
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
    log('🔴 interruptAgent method completed');
  };

  // Put agent to sleep - only if agent is configured
  const sleep = (): void => {
    if (!agentManagerRef.current) {
      log('Cannot put agent to sleep: agent manager not initialized or not configured');
      return;
    }
    
    sleepLog('sleep() method called - initiating transition');
    isWaitingForUserVoiceAfterSleep.current = true;
    clearAudio();
    sleepLog('Dispatching AGENT_STATE_CHANGE to entering_sleep (from sleep())');
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'entering_sleep' });
  };
  
  // Wake agent from sleep - only if agent is configured
  const wake = (): void => {
    if (!agentManagerRef.current) {
      log('Cannot wake agent: agent manager not initialized or not configured');
      return;
    }
    
    if (stateRef.current.agentState !== 'sleeping') {
        sleepLog(`wake() called but state is ${stateRef.current.agentState}, not 'sleeping'. Aborting wake.`);
        return;
    }
    
    sleepLog('wake() method called from sleeping state');
    isWaitingForUserVoiceAfterSleep.current = false;
    sleepLog('Dispatching AGENT_STATE_CHANGE to listening (from wake())');
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'listening' });
  };
  
  // Toggle between sleep and wake states - only if agent is configured
  const toggleSleep = (): void => {
    if (!agentManagerRef.current) {
      log('Cannot toggle agent sleep state: agent manager not initialized or not configured');
      return;
    }
    
    sleepLog('toggleSleep() method called. Current state via ref:', stateRef.current.agentState);
    if (stateRef.current.agentState === 'sleeping') {
      wake();
    } else if (stateRef.current.agentState !== 'entering_sleep') { 
      sleep();
    } else {
      sleepLog('toggleSleep() called while already entering_sleep. No action.');
    }
    sleepLog('Sleep toggle action dispatched or ignored');
  };

  // Inject a message directly to the agent
  const injectAgentMessage = (message: string): void => {
    if (!agentManagerRef.current) {
      log('Cannot inject message: agent manager not initialized or not configured');
      return;
    }
    
    log('Injecting agent message:', message);
    
    agentManagerRef.current.sendJSON({
      type: 'InjectAgentMessage',
      content: message
    });
  };

  // Inject a user message to the agent
  const injectUserMessage = (message: string): void => {
    if (!agentManagerRef.current) {
      log('Cannot inject user message: agent manager not initialized or not configured');
      return;
    }
    
    log('Injecting user message:', message);
    
    agentManagerRef.current.sendJSON({
      type: 'InjectUserMessage',
      content: message
    });
  };

  // Resume conversation with text input (lazy reconnection)
  const resumeWithText = async (text: string): Promise<void> => {
    lazyLog('Resuming conversation with text:', text);
    lazyLog(`Current conversation history length: ${state.conversationHistory.length}`);
    lazyLog(`Current session ID: ${state.sessionId || 'None'}`);
    
    // Set lazy reconnection flag
    isLazyReconnectingRef.current = true;
    
    // Mark this as a reconnection immediately (synchronous)
    isNewConnectionRef.current = false;
    dispatch({ type: 'CONNECTION_TYPE_CHANGE', isNew: false });
    
    // CRITICAL: Resume AudioContext before sending text
    const audioContext = audioManagerRef.current?.getAudioContext();
    if (audioContext?.state === 'suspended') {
      try {
        await audioContext.resume();
        lazyLog('✅ AudioContext resumed for text interaction');
      } catch (error) {
        lazyLog('⚠️ Failed to resume AudioContext:', error);
      }
    }
    
    try {
      // Generate session ID if not exists
      const sessionId = state.sessionId || generateSessionId();
      lazyLog(`Using session ID: ${sessionId}`);
      
      // Add user message to conversation history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now()
      };
      
      dispatch({ type: 'ADD_CONVERSATION_MESSAGE', message: userMessage });
      dispatch({ type: 'SET_SESSION_ID', sessionId });
      lazyLog(`Added user message to history: "${text}"`);
      
      // Check if we need to reconnect or just send the message
      const shouldReconnect = needsReconnection();
      lazyLog(`Connection check: needsReconnection=${shouldReconnect}`);
      
      if (shouldReconnect) {
        // Connect with context
        lazyLog(`Connecting with context (${state.conversationHistory.length + 1} messages)`);
        await connectWithContext(sessionId, [...state.conversationHistory, userMessage], agentOptions!);
      } else {
        lazyLog(`Connection already established, skipping settings`);
      }
      
      // Send the text message with configured delay
      if (agentManagerRef.current) {
        lazyLog(`Sending InjectUserMessage: "${text}"`);
        setTimeout(() => {
          if (agentManagerRef.current) {
            agentManagerRef.current.sendJSON({
              type: 'InjectUserMessage',
              content: text
            });
            lazyLog(`InjectUserMessage sent after delay: "${text}"`);
          }
        }, LAZY_RECONNECT_CONFIG.MESSAGE_SEND_DELAY);
      }
      
      lazyLog('Successfully resumed conversation with text');
    } catch (error) {
      lazyLog('Error resuming conversation with text:', error);
      handleError({
        service: 'agent',
        code: 'resume_text_error',
        message: 'Failed to resume conversation with text',
        details: error,
      });
      throw error;
    } finally {
      // Clear lazy reconnection flag
      isLazyReconnectingRef.current = false;
    }
  };

  // Resume conversation with audio input (lazy reconnection)
  const resumeWithAudio = async (): Promise<void> => {
    console.log('🔍 [resumeWithAudio] Function called - starting execution');
    lazyLog('🔍 [resumeWithAudio] Function called - starting execution');
    lazyLog('Resuming conversation with audio');
    lazyLog(`Current conversation history length: ${state.conversationHistory.length}`);
    lazyLog(`Current session ID: ${state.sessionId || 'None'}`);
    lazyLog(`Agent manager state: ${agentManagerRef.current?.getState() || 'null'}`);
    
    // Set lazy reconnection flag
    isLazyReconnectingRef.current = true;
    
    // Mark this as a reconnection immediately (synchronous)
    isNewConnectionRef.current = false;
    dispatch({ type: 'CONNECTION_TYPE_CHANGE', isNew: false });
    
    try {
      // Generate session ID if not exists
      const sessionId = state.sessionId || generateSessionId();
      lazyLog(`Using session ID: ${sessionId}`);
      
      dispatch({ type: 'SET_SESSION_ID', sessionId });
      
      // Check if we need to reconnect
      lazyLog(`🔍 [resumeWithAudio] About to call needsReconnection()`);
      const shouldReconnect = needsReconnection();
      console.log(`🔍 [resumeWithAudio] needsReconnection() returned: ${shouldReconnect}`);
      console.log(`🔍 [resumeWithAudio] About to check if shouldReconnect is true`);
      lazyLog(`Audio connection check: needsReconnection=${shouldReconnect}`);
      
      if (shouldReconnect) {
        console.log(`🔍 [resumeWithAudio] shouldReconnect is true, entering reconnection logic`);
        // Wait for auto-connect to complete if it's in progress
        console.log(`🔍 [resumeWithAudio] Checking if auto-connect is in progress...`);
        let autoConnectWaitAttempts = 0;
        const maxAutoConnectWait = 5; // 0.5 seconds max wait (reduced from 2 seconds)
        
        while (agentManagerRef.current?.getState() !== 'connected' && autoConnectWaitAttempts < maxAutoConnectWait) {
          console.log(`🔍 [resumeWithAudio] Waiting for auto-connect to complete... attempt ${autoConnectWaitAttempts + 1}/${maxAutoConnectWait}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          autoConnectWaitAttempts++;
        }
        
        if (agentManagerRef.current?.getState() === 'connected') {
          console.log(`🔍 [resumeWithAudio] Auto-connect completed, skipping manual connection`);
        } else {
          // Connect with context if auto-connect didn't complete
          console.log(`🔍 [resumeWithAudio] Auto-connect didn't complete, connecting with context (${state.conversationHistory.length} messages)`);
          await connectWithContext(sessionId, state.conversationHistory, agentOptions!);
        }
      } else {
        lazyLog(`Connection already established, skipping settings`);
      }
      
      // Wait for connection and Welcome message
      console.log(`🔍 [resumeWithAudio] Waiting for connection and Welcome message`);
      
      let readyAttempts = 0;
      const maxReadyAttempts = 50; // 5 seconds max wait
      let welcomeReady = false;
      
      while (!welcomeReady && readyAttempts < maxReadyAttempts) {
        const currentState = agentManagerRef.current?.getState();
        const welcomeReceived = state.welcomeReceived;
        
        console.log(`🔍 [resumeWithAudio] Checking connection readiness... attempt ${readyAttempts + 1}/${maxReadyAttempts}`);
        console.log(`  - Connection state: ${currentState}`);
        console.log(`  - Welcome received: ${welcomeReceived}`);
        
        // Connection must be established and Welcome received
        if (currentState === 'connected' && welcomeReceived) {
          console.log('🔍 [resumeWithAudio] ✅ Connection ready, Welcome received');
          welcomeReady = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
          readyAttempts++;
        }
      }
      
      if (!welcomeReady) {
        console.log('🔍 [resumeWithAudio] ❌ Connection/Welcome not ready');
        throw new Error('Connection failed: timeout waiting for Welcome message');
      }
      
      // Now send settings (during lazy reconnection, automatic settings send is skipped)
      console.log('🔍 [resumeWithAudio] Sending settings for lazy reconnection');
      if (!hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
        sendAgentSettings();
        // Wait for settings to be processed
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.log('🔍 [resumeWithAudio] Settings already sent');
      }
      
      // Wait a bit more to ensure connection is stable after settings
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Final check before enabling microphone - add connection stability check
      console.log('🔍 [resumeWithAudio] ✅ All checks passed, enabling microphone');
      
      if (!agentManagerRef.current || agentManagerRef.current.getState() !== 'connected') {
        console.log('🔍 [resumeWithAudio] ❌ Cannot enable microphone: agent not connected, state:', agentManagerRef.current?.getState());
        throw new Error(`Agent not connected (state: ${agentManagerRef.current?.getState()})`);
      }
      
      // Additional connection stability check - wait for connection to remain stable
      console.log('🔍 [resumeWithAudio] Performing connection stability check...');
      let stabilityCheckAttempts = 0;
      const maxStabilityChecks = 10; // 1 second max wait
      let connectionStable = false;
      
      while (stabilityCheckAttempts < maxStabilityChecks && !connectionStable) {
        const currentState = agentManagerRef.current?.getState();
        console.log(`🔍 [resumeWithAudio] Stability check ${stabilityCheckAttempts + 1}/${maxStabilityChecks}: state=${currentState}`);
        
        if (currentState === 'connected') {
          // Wait a bit more to ensure connection stays stable
          await new Promise(resolve => setTimeout(resolve, 100));
          const stateAfterWait = agentManagerRef.current?.getState();
          console.log(`🔍 [resumeWithAudio] State after stability wait: ${stateAfterWait}`);
          
          if (stateAfterWait === 'connected') {
            connectionStable = true;
            console.log('🔍 [resumeWithAudio] ✅ Connection is stable, proceeding with microphone enable');
          } else {
            console.log('🔍 [resumeWithAudio] ❌ Connection became unstable, retrying...');
            stabilityCheckAttempts++;
          }
        } else {
          console.log('🔍 [resumeWithAudio] ❌ Connection not stable, retrying...');
          stabilityCheckAttempts++;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (!connectionStable) {
        console.log('🔍 [resumeWithAudio] ❌ Connection failed stability check after maximum attempts');
        
        // Try one more reconnection attempt if stability check fails
        console.log('🔍 [resumeWithAudio] Attempting one more reconnection...');
        try {
          if (agentManagerRef.current) {
            await agentManagerRef.current.connect();
            console.log('🔍 [resumeWithAudio] Reconnection attempt completed');
            
            // Wait a bit for the connection to stabilize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if the reconnection was successful
            const finalState = agentManagerRef.current.getState();
            if (finalState !== 'connected') {
              throw new Error('Connection failed stability check - connection closed immediately after establishment');
            }
            
            console.log('🔍 [resumeWithAudio] ✅ Reconnection successful, proceeding with microphone enable');
          } else {
            throw new Error('Connection failed stability check - connection closed immediately after establishment');
          }
        } catch (reconnectError) {
          console.log('🔍 [resumeWithAudio] ❌ Reconnection attempt failed:', reconnectError);
          throw new Error('Connection failed stability check - connection closed immediately after establishment');
        }
      }
      
      await toggleMic(true);
      
      lazyLog('Successfully resumed conversation with audio');
    } catch (error) {
      lazyLog('❌ [resumeWithAudio] Error resuming conversation with audio:', error);
      lazyLog('❌ [resumeWithAudio] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to resume conversation with audio';
      if (error instanceof Error) {
        if (error.message.includes('Connection failed stability check')) {
          errorMessage = 'Connection closed immediately after establishment. Please try again.';
        } else if (error.message.includes('Agent not connected')) {
          errorMessage = 'Agent connection lost. Please check your connection and try again.';
        } else if (error.message.includes('resume_audio_error')) {
          errorMessage = 'Microphone activation failed. Please try again.';
        }
      }
      
      handleError({
        service: 'agent',
        code: 'resume_audio_error',
        message: errorMessage,
        details: error,
      });
      throw error;
    } finally {
      // Clear lazy reconnection flag
      isLazyReconnectingRef.current = false;
    }
  };

  // Connect with conversation context (for lazy reconnection)
  const connectWithContext = async (sessionId: string, history: ConversationMessage[], options: AgentOptions): Promise<void> => {
    lazyLog('Connecting with conversation context:', { sessionId, historyLength: history.length });
    lazyLog(`Agent options: ${JSON.stringify(options, null, 2)}`);
    
    try {
      // Connect agent WebSocket if not already connected
      const currentState = agentManagerRef.current?.getState();
      lazyLog(`🔍 [connectWithContext] Current agent state: ${currentState}`);
      lazyLog(`🔍 [connectWithContext] About to check if connection is needed`);
      
      if (agentManagerRef.current && currentState !== 'connected') {
        lazyLog(`🔍 [connectWithContext] Entering connection logic for state: ${currentState}`);
        // Check if we're already connecting (to avoid conflicts with auto-connect)
        if (currentState === 'connecting') {
          lazyLog(`🔍 [connectWithContext] Agent WebSocket is already connecting, waiting for connection...`);
          
          // Wait for connection to complete
          let waitAttempts = 0;
          const maxWaitAttempts = 50; // 5 seconds max wait
          while (agentManagerRef.current.getState() !== 'connected' && waitAttempts < maxWaitAttempts) {
            lazyLog(`🔍 [connectWithContext] Waiting for connection... attempt ${waitAttempts + 1}/${maxWaitAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            waitAttempts++;
          }
          
          const finalState = agentManagerRef.current.getState();
          lazyLog(`🔍 [connectWithContext] Final agent state after waiting: ${finalState}`);
          
          if (finalState === 'connected') {
            lazyLog(`🔍 [connectWithContext] Agent WebSocket connected successfully via waiting`);
          } else {
            lazyLog(`🔍 [connectWithContext] Agent WebSocket failed to connect after waiting, attempting manual connection`);
            await agentManagerRef.current.connect();
            lazyLog(`🔍 [connectWithContext] Agent WebSocket connect() completed`);
          }
        } else {
          lazyLog(`🔍 [connectWithContext] Agent WebSocket not connected (${currentState}), connecting...`);
          await agentManagerRef.current.connect();
          lazyLog(`🔍 [connectWithContext] Agent WebSocket connect() completed`);
        }
        
        // Check state after connection
        const newState = agentManagerRef.current.getState();
        lazyLog(`🔍 [connectWithContext] Agent state after connect(): ${newState}`);
        lazyLog('Agent WebSocket connected with context');
      } else {
        lazyLog(`🔍 [connectWithContext] Agent WebSocket already connected (${currentState})`);
      }
      
      // Send settings with conversation context for lazy reconnection
      // Always send settings during lazy reconnection to ensure proper context
      if (agentManagerRef.current) {
        const settingsMessage = {
          type: 'Settings',
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            },
            output: {
              encoding: 'linear16',
              sample_rate: 24000
            }
          },
          agent: {
            language: options.language || 'en',
            listen: {
              provider: {
                type: 'deepgram',
                model: options.listenModel || 'nova-2'
              }
            },
            think: {
              provider: {
                type: options.thinkProviderType || 'open_ai',
                model: options.thinkModel || 'gpt-4o-mini'
              },
              prompt: options.instructions || 'You are a helpful voice assistant.',
              ...(options.thinkEndpointUrl && options.thinkApiKey ? {
                endpoint: {
                  url: options.thinkEndpointUrl,
                  headers: {
                    authorization: `bearer ${options.thinkApiKey}`,
                  },
                }
              } : {})
            },
            speak: {
              provider: {
                type: 'deepgram',
                model: options.voice || 'aura-asteria-en'
              }
            },
            // Don't include greeting for lazy reconnection - we're resuming a conversation, not starting new
            // greeting: options.greeting,
            context: transformConversationHistory(history) // Include conversation context in correct Deepgram API format
          }
        };
        
        lazyLog(`Sending settings with context (correct Deepgram API format):`, settingsMessage);
        agentManagerRef.current.sendJSON(settingsMessage);
        
        // Mark settings as sent (both state and refs for consistency)
        dispatch({ type: 'SETTINGS_SENT', sent: true });
        hasSentSettingsRef.current = true;
        (window as any).globalSettingsSent = true;
        settingsSentTimeRef.current = Date.now();
        lazyLog('Settings sent with conversation context (correct Deepgram API format)');
      }
      
      lazyLog('Successfully connected with conversation context');
    } catch (error) {
      lazyLog('❌ [connectWithContext] Error connecting with context:', error);
      lazyLog('❌ [connectWithContext] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      throw error;
    }
  };

  // TTS mute control methods
  /**
   * Toggle the TTS mute state
   * 
   * This method toggles between muted and unmuted states for TTS audio playback.
   * When muted, the agent will not produce any audio output, but will continue
   * to process and respond to user input silently.
   * 
   * @example
   * ```tsx
   * const ref = useRef<DeepgramVoiceInteractionHandle>(null);
   * 
   * const handleMuteToggle = () => {
   *   ref.current?.toggleTtsMute();
   * };
   * ```
   */
  const toggleTtsMute = (): void => {
    log('🔇 toggleTtsMute method called');
    
    if (!audioManagerRef.current) {
      log('Cannot toggle TTS mute: audio manager not initialized');
      return;
    }
    
    const currentMutedState = audioManagerRef.current.isTtsMuted;
    const newMutedState = !currentMutedState;
    const isCurrentlyPlaying = audioManagerRef.current.isPlaybackActive();
    
    log(`🔇 TTS mute toggle: ${currentMutedState} → ${newMutedState}, currently playing: ${isCurrentlyPlaying}`);
    
    // Update mute state first (this will stop current audio if muting)
    audioManagerRef.current.setTtsMuted(newMutedState);
    
    // Update component state immediately for UI feedback
    dispatch({ type: 'TTS_MUTE_CHANGE', muted: newMutedState });
    
    log(`🔇 TTS mute state changed to: ${newMutedState}`);
    
    // Re-send agent settings with updated TTS mute state to prevent future audio
    if (agentManagerRef.current && agentManagerRef.current.isConnected()) {
      log('🔇 Re-sending agent settings with updated TTS mute state');
      sendAgentSettings();
    } else {
      log('🔇 Cannot re-send agent settings: agent not connected');
    }
    
    // If muting, always interrupt to ensure audio stops immediately
    if (newMutedState) {
      log('🔇 Muting - interrupting current audio');
      interruptAgent();
    }
    
    // Notify parent component of state change
    if (onTtsMuteToggle) {
      onTtsMuteToggle(newMutedState);
    }
  };

  /**
   * Set the TTS mute state explicitly
   * 
   * This method allows you to explicitly set the TTS mute state to a specific value.
   * Useful when you need to programmatically control the mute state based on
   * external conditions or user preferences.
   * 
   * @param muted - Whether TTS should be muted (true) or unmuted (false)
   * 
   * @example
   * ```tsx
   * const ref = useRef<DeepgramVoiceInteractionHandle>(null);
   * 
   * const handleMuteChange = (shouldMute: boolean) => {
   *   ref.current?.setTtsMuted(shouldMute);
   * };
   * ```
   */
  const setTtsMuted = (muted: boolean): void => {
    log(`🔇 setTtsMuted method called with: ${muted}`);
    
    if (!audioManagerRef.current) {
      log('Cannot set TTS mute: audio manager not initialized');
      return;
    }
    
    audioManagerRef.current.setTtsMuted(muted);
    
    // Update component state
    dispatch({ type: 'TTS_MUTE_CHANGE', muted });
    
    log(`🔇 TTS mute state set to: ${muted}`);
    
    // Re-send agent settings with updated TTS mute state
    if (agentManagerRef.current && agentManagerRef.current.isConnected()) {
      log('🔇 Re-sending agent settings with updated TTS mute state');
      sendAgentSettings();
    }
    
    // Notify parent component of state change
    if (onTtsMuteToggle) {
      onTtsMuteToggle(muted);
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    // Core connection methods
    start,
    connectTextOnly,
    stop,
    
    // Agent interaction methods
    updateAgentInstructions,
    interruptAgent,
    sleep,
    wake,
    toggleSleep,
    injectAgentMessage,
    injectUserMessage,
    
    // Microphone control
    toggleMicrophone: toggleMic,
    
    // Reconnection methods
    resumeWithText,
    resumeWithAudio,
    connectWithContext,
    
    // Audio data handling
    sendAudioData, // Expose sendAudioData for testing and external use
    
    // TTS mute functionality
    toggleTtsMute,
    setTtsMuted,
    isTtsMuted: audioManagerRef.current?.isTtsMuted || false,
    isPlaybackActive: () => state.isPlaying,
    
    // Audio context access
    getAudioContext: () => audioManagerRef.current?.getAudioContext() || undefined,
    
    // Debug methods for testing
    getConnectionStates: () => ({
      transcription: transcriptionManagerRef.current?.getState() || 'not-found',
      agent: agentManagerRef.current?.getState() || 'not-found',
      transcriptionConnected: transcriptionManagerRef.current?.isConnected() || false,
      agentConnected: agentManagerRef.current?.isConnected() || false,
    }),
    getState: () => state,
  }));

  // Render nothing (headless component)
  return null;
}

export default forwardRef(DeepgramVoiceInteraction); 
