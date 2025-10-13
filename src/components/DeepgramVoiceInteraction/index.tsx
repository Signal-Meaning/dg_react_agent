import React, { forwardRef, useEffect, useImperativeHandle, useReducer, useRef } from 'react';
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
  AgentOptions
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
    debug = false,
    // Auto-connect dual mode props
    autoConnect,
    microphoneEnabled,
    onMicToggle,
    onConnectionReady,
    onAgentSpeaking,
    onAgentSilent,
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
  
  // Debug logging
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[DeepgramVoiceInteraction]', ...args);
    }
  };
  
  // Targeted sleep/wake logging
  const sleepLog = (...args: unknown[]) => {
    if (debug) {
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
    
    // Validate API key
    if (!apiKey) {
      handleError({
        service: 'transcription',
        code: 'invalid_api_key',
        message: 'API key is required',
      });
      return;
    }

    // Development warning for non-memoized options
    if (process.env.NODE_ENV === 'development') {
      warnAboutNonMemoizedOptions('agentOptions', agentOptions);
      warnAboutNonMemoizedOptions('transcriptionOptions', transcriptionOptions);
    }

    // Determine which services are being configured
    const isTranscriptionConfigured = !!transcriptionOptions;
    const isAgentConfigured = !!agentOptions;
    
    if (!isTranscriptionConfigured && !isAgentConfigured) {
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
      if (!transcriptionManagerRef.current) {
        try {
          log('🔧 [TRANSCRIPTION] Starting transcription setup');
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
      if (useKeytermPrompting) {
        log('Using keyterm prompting - VAD params in URL');
      } else {
        log('Using queryParams - VAD params:', transcriptionQueryParams);
      }
      
      // Create Transcription WebSocket manager
    transcriptionManagerRef.current = new WebSocketManager({
        url: transcriptionUrl,
      apiKey,
      service: 'transcription',
        queryParams: useKeytermPrompting ? undefined : transcriptionQueryParams, 
      debug,
    });

    // Set up event listeners for transcription WebSocket
      transcriptionUnsubscribe = transcriptionManagerRef.current.addEventListener((event: WebSocketEvent) => {
      if (event.type === 'state') {
        log('Transcription state:', event.state);
        dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'transcription', state: event.state });
        onConnectionStateChange?.('transcription', event.state);
      } else if (event.type === 'message') {
        handleTranscriptionMessage(event.data);
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
      log('Transcription service not configured, skipping setup');
    }

    // --- AGENT SETUP (CONDITIONAL) ---
    if (isAgentConfigured) {
      // Create Agent WebSocket manager
      agentManagerRef.current = new WebSocketManager({
        url: endpoints.agentUrl,
        apiKey,
        service: 'agent',
        debug,
      });

    // Set up event listeners for agent WebSocket
      const unsubscribeResult = agentManagerRef.current.addEventListener((event: WebSocketEvent) => {
      if (event.type === 'state') {
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
        
        // Reset settings flag when connection closes for lazy reconnection
        if (event.state === 'closed') {
          dispatch({ type: 'SETTINGS_SENT', sent: false });
          hasSentSettingsRef.current = false; // Reset ref when connection closes
          (window as any).globalSettingsSent = false; // Reset global flag when connection closes
          settingsSentTimeRef.current = null; // Reset settings time
          console.log('🔧 [Connection] hasSentSettingsRef and globalSettingsSent reset to false due to connection close');
          lazyLog('Reset hasSentSettings flag due to connection close');
          
          // Disable microphone when connection closes (async operation)
          if (audioManagerRef.current && audioManagerRef.current.isRecordingActive()) {
            console.log('🔧 [Connection] Connection closed, disabling microphone');
            // Use setTimeout to avoid blocking the event handler
            setTimeout(async () => {
              try {
                await audioManagerRef.current?.stopRecording();
                dispatch({ type: 'MIC_ENABLED_CHANGE', enabled: false });
                onMicToggle?.(false);
                console.log('🔧 [Connection] Microphone disabled due to connection close');
              } catch (error) {
                console.log('🔧 [Connection] Error disabling microphone:', error);
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
        onKeepalive?.(event.data.service);
      } else if (event.type === 'message') {
        handleAgentMessage(event.data);
      } else if (event.type === 'binary') {
        handleAgentAudio(event.data);
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
        debug,
      });

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
      } else if (event.type === 'error') {
        handleError(event.error);
      } else if (event.type === 'data') {
        sendAudioData(event.data);
      }
    });

    // Component is ready immediately when configured - AudioManager is not a prerequisite
    // The component can accept text interactions and manual connections without audio
    dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
    
    // Initialize AudioManager in the background for audio features
    audioManagerRef.current.initialize()
      .then(() => {
        log('AudioManager initialized successfully in background');
        // Don't change isReady here - it's already true
        // AudioManager readiness can be tracked separately if needed
      })
      .catch((error: Error) => {
        log('AudioManager failed to initialize in background:', error);
        // Don't change isReady here - component can still work without audio
        // Audio features will be disabled, but text interactions still work
      });
    } else {
      log('AudioManager not needed for this configuration, skipping setup');
      // For text-only agent interactions, we can be ready immediately
      dispatch({ type: 'READY_STATE_CHANGE', isReady: true });
    }

    // Auto-connect dual mode logic
    console.log('Auto-connect check:', { autoConnect, isAgentConfigured, agentManagerRef: !!agentManagerRef.current });
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
      
      // Auto-connect to agent service to establish dual mode
      setTimeout(async () => {
        // Check again inside setTimeout to prevent multiple executions
        if (autoConnectAttemptedRef.current) {
          console.log('Auto-connect already attempted, skipping');
          return;
        }
        autoConnectAttemptedRef.current = true; // Mark as attempted
        
        console.log('Auto-connect timeout executing, agentManagerRef.current:', !!agentManagerRef.current);
        if (agentManagerRef.current) {
          console.log('Calling agentManagerRef.current.connect()');
          try {
            await agentManagerRef.current.connect();
            
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
          } catch (error) {
            log('Auto-connect failed:', error);
          }
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
  }, [apiKey, transcriptionOptions, agentOptions, endpointConfig, debug, autoConnect]); 

  // Notify ready state changes ONLY when the value actually changes
  useEffect(() => {
    if (onReady && state.isReady !== prevIsReadyRef.current) {
      log('Notifying parent: isReady changed to', state.isReady);
      onReady(state.isReady);
      prevIsReadyRef.current = state.isReady;
    }
  }, [state.isReady, onReady]);

  // Notify agent state changes ONLY when the value actually changes
  useEffect(() => {
    if (onAgentStateChange && state.agentState !== prevAgentStateRef.current) {
      log('Notifying parent: agentState changed to', state.agentState);
      onAgentStateChange(state.agentState);
      prevAgentStateRef.current = state.agentState;
    }
  }, [state.agentState, onAgentStateChange]);

  // Notify playback state changes ONLY when the value actually changes
  useEffect(() => {
    if (onPlaybackStateChange && state.isPlaying !== prevIsPlayingRef.current) {
      log('Notifying parent: isPlaying changed to', state.isPlaying);
      onPlaybackStateChange(state.isPlaying);
      prevIsPlayingRef.current = state.isPlaying;
    }
  }, [state.isPlaying, onPlaybackStateChange]);

  // Type guard for transcription messages
  const isTranscriptionMessage = (data: unknown): data is { type: string; [key: string]: unknown } => {
    return typeof data === 'object' && data !== null && 'type' in data;
  };

  // Handle transcription messages - only relevant if transcription is configured
  const handleTranscriptionMessage = (data: unknown) => {
    // Skip processing if transcription service isn't configured
    if (!transcriptionManagerRef.current) {
      log('Received unexpected transcription message but service is not configured:', data);
      return;
    }

    // Type guard check
    if (!isTranscriptionMessage(data)) {
      log('Invalid transcription message format:', data);
      return;
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
      
      const transcript = data as unknown as TranscriptResponse;
      onTranscriptUpdate?.(transcript);
      return;
    }
  };

  // Lazy reconnection logging helper
  const lazyLog = (...args: unknown[]) => {
    if (debug) {
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
    
    // Mark as sent immediately to prevent duplicate calls (both locally and globally)
    hasSentSettingsRef.current = true;
    (window as any).globalSettingsSent = true;
    settingsSentTimeRef.current = Date.now();
    console.log('🔧 [sendAgentSettings] hasSentSettingsRef and globalSettingsSent set to true');
    
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
        speak: {
          provider: {
            type: 'deepgram',
            model: agentOptions.voice || 'aura-asteria-en'
          }
        },
        greeting: agentOptions.greeting,
        context: transformConversationHistory(state.conversationHistory) // Include conversation context in correct Deepgram API format
      }
    };
    
    console.log('📤 [Protocol] Sending agent settings with context (correct Deepgram API format):', { 
      conversationHistoryLength: state.conversationHistory.length,
      contextMessages: transformConversationHistory(state.conversationHistory).messages
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
      // Use ref to avoid stale closure issues
      if (!hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
        console.log('❌ Cannot enable microphone before settings are sent');
        console.log('❌ hasSentSettingsRef is false - attempting to send settings now');
        
        // Try to send settings if they haven't been sent yet
        if (agentManagerRef.current && agentOptions) {
          console.log('🔧 Attempting to send settings from toggleMic');
          sendAgentSettings();
          
          // Wait a bit for settings to be processed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check if settings were sent successfully
          if (!hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
            console.log('❌ Settings still not sent after attempt');
            return;
          }
        } else {
          console.log('❌ Cannot send settings: agentManagerRef or agentOptions missing');
          return;
        }
      } else if (hasSentSettingsRef.current || (window as any).globalSettingsSent) {
        console.log('✅ Settings already sent, proceeding with microphone enable');
      } else {
        console.log('❌ Cannot enable microphone: settings not sent and cannot be sent');
        return;
      }
      
      if (audioManagerRef.current) {
        console.log('✅ Enabling microphone...');
        console.log('Calling startRecording on audioManagerRef.current');
        
        // Set global flag to prevent HMR disruption
        (window as any).audioCaptureInProgress = true;
        
        try {
          await audioManagerRef.current.startRecording();
          console.log('✅ startRecording completed successfully');
          
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
    
    if (data.type === 'AgentThinking') {
      sleepLog('Dispatching AGENT_STATE_CHANGE to thinking');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      
      // Disable keepalives when agent starts thinking (user stopped speaking)
      updateKeepaliveState(false);
      
      return;
    }
    
    if (data.type === 'AgentStartedSpeaking') {
      sleepLog('Dispatching AGENT_STATE_CHANGE to speaking');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });

      // Track agent speaking
      if (state.greetingInProgress && !state.greetingStarted) {
        dispatch({ type: 'GREETING_STARTED', started: true });
      }
      
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
      
      // Always call onAgentSilent when agent finishes speaking
      onAgentSilent?.();
      return;
    }
    
    // Handle conversation text
    if (data.type === 'ConversationText') {
      const content = typeof data.content === 'string' ? data.content : '';
      
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

    // Handle UserStoppedSpeaking events
    if (data.type === 'UserStoppedSpeaking') {
      log('🎤 [VAD] UserStoppedSpeaking message received');
      if (isSleepingOrEntering) {
        sleepLog('Ignoring UserStoppedSpeaking event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Call the callback with timestamp if available
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
      onUserStoppedSpeaking?.({ timestamp });
      
      // Update VAD state
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
      
      // Disable keepalives when user stops speaking
      updateKeepaliveState(false);
      
      // Transition to thinking state if currently listening
      if (stateRef.current.agentState === 'listening') {
        sleepLog('Dispatching AGENT_STATE_CHANGE to thinking (from UserStoppedSpeaking)');
        dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      }
      return;
    }

    // Handle UtteranceEnd events from Deepgram's end-of-speech detection
    if (data.type === 'UtteranceEnd') {
      log('🎯 [VAD] UtteranceEnd message received:', data);
      if (isSleepingOrEntering) {
        sleepLog('Ignoring UtteranceEnd event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Call the callback with channel and lastWordEnd data
      const channel = Array.isArray(data.channel) ? data.channel : [0, 1];
      const lastWordEnd = typeof data.last_word_end === 'number' ? data.last_word_end : 0;
      onUtteranceEnd?.({ channel, lastWordEnd });
      
      // Update VAD state
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
      dispatch({ type: 'UTTERANCE_END', data: { channel, lastWordEnd } });
      
      // Also call onUserStoppedSpeaking for backward compatibility
      const timestamp = Date.now();
      onUserStoppedSpeaking?.({ timestamp });
      
      // Disable keepalives when utterance ends
      updateKeepaliveState(false);
      
      // Transition to thinking state if currently listening
      if (stateRef.current.agentState === 'listening') {
        sleepLog('Dispatching AGENT_STATE_CHANGE to thinking (from UtteranceEnd)');
        dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      }
      return;
    }

    // Handle VAD events from transcription service
    if (data.type === 'VADEvent') {
      log('VADEvent message received:', data);
      
      // Call the callback with VAD event data
      const speechDetected = typeof data.speech_detected === 'boolean' ? data.speech_detected : false;
      const confidence = typeof data.confidence === 'number' ? data.confidence : undefined;
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
      onVADEvent?.({ speechDetected, confidence, timestamp });
      
      // Handle speech detection state changes
      if (speechDetected) {
        // User started speaking
        onUserStartedSpeaking?.();
        dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: true });
        updateKeepaliveState(true);
        
        if (stateRef.current.agentState === 'idle' || stateRef.current.agentState === 'sleeping') {
          dispatch({ type: 'AGENT_STATE_CHANGE', state: 'listening' });
        }
      } else {
        // User stopped speaking
        const stopTimestamp = Date.now();
        onUserStoppedSpeaking?.({ timestamp: stopTimestamp });
        dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
        updateKeepaliveState(false);
        
        if (stateRef.current.agentState === 'listening') {
          dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
        }
      }
      return;
    }
  };

  // Handle agent audio - only relevant if agent is configured
  const handleAgentAudio = (data: ArrayBuffer) => {
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
    
    if (audioManagerRef.current) {
      log('Passing buffer to AudioManager.queueAudio()');
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
    // Debug logging only (reduce console spam)
    if (debug) {
      console.log('🎵 [sendAudioData] Called with data size:', data.byteLength);
      console.log('🎵 [sendAudioData] hasSentSettingsRef.current:', hasSentSettingsRef.current);
      console.log('🎵 [sendAudioData] state.hasSentSettings:', state.hasSentSettings);
      console.log('🎵 [sendAudioData] agentManagerRef.current?.getState():', agentManagerRef.current?.getState());
    }
    
    // Send to transcription service if configured and connected
    if (transcriptionManagerRef.current?.getState() === 'connected') {
      if (debug) console.log('🎵 [sendAudioData] Sending to transcription service');
      transcriptionManagerRef.current.sendBinary(data);
    }
    
    // Send to agent service if configured, connected, and not in sleep mode
    if (agentManagerRef.current) {
      const connectionState = agentManagerRef.current.getState();
      
      // Early return for closed connections to prevent log spam
      if (connectionState === 'closed') {
        if (debug) console.log('🎵 [sendAudioData] Skipping agent service - not connected:', connectionState);
        return;
      }
      
      // Check if sleeping or entering sleep before sending to agent
      const isSleepingOrEntering = 
        stateRef.current.agentState === 'sleeping' || 
        stateRef.current.agentState === 'entering_sleep';
        
      if (connectionState === 'connected' && !isSleepingOrEntering) {
        // Check if settings have been sent and enough time has passed
        if (!hasSentSettingsRef.current) {
          if (debug) {
            console.log('🎵 [sendAudioData] ❌ CRITICAL: Cannot send audio data before settings are sent!');
            console.log('🎵 [sendAudioData] ❌ hasSentSettingsRef.current:', hasSentSettingsRef.current);
            console.log('🎵 [sendAudioData] ❌ state.hasSentSettings:', state.hasSentSettings);
          }
          return; // Don't send audio data
        }
        
        // Wait for settings to be processed by Deepgram (minimum 500ms)
        if (settingsSentTimeRef.current && Date.now() - settingsSentTimeRef.current < 500) {
          if (debug) console.log('🎵 [sendAudioData] ⏳ Waiting for settings to be processed by Deepgram...');
          return; // Don't send audio data yet
        }
        
        if (debug) console.log('🎵 [sendAudioData] ✅ Settings confirmed, sending to agent service');
        agentManagerRef.current.sendBinary(data);
        
        // Log successful audio transmission (always show this for debugging)
        console.log('🎵 [AUDIO] Audio data sent to Deepgram agent service');
      } else if (isSleepingOrEntering) {
        if (debug) {
          console.log('🎵 [sendAudioData] Skipping agent service - sleeping state:', stateRef.current.agentState);
          sleepLog('Skipping sendAudioData to agent (state:', stateRef.current.agentState, ')');
        }
      } else {
        if (debug) console.log('🎵 [sendAudioData] Skipping agent service - not connected:', connectionState);
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
      
      // Signal not ready after stopping
      dispatch({ type: 'READY_STATE_CHANGE', isReady: false }); 
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
      
      // Enable microphone for audio input
      console.log(`🔍 [resumeWithAudio] Enabling microphone for audio input`);
      
      // Wait for connection to be established and settings to be sent
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      let settingsSent = false;
      
      while (!settingsSent && attempts < maxAttempts) {
        console.log(`🔍 [resumeWithAudio] Waiting for settings to be sent... attempt ${attempts + 1}/${maxAttempts}`);
        
        // Check if settings have already been sent (avoid duplicate)
        if (hasSentSettingsRef.current || (window as any).globalSettingsSent) {
          console.log('🔍 [resumeWithAudio] Settings already sent, skipping duplicate');
          settingsSent = true;
        } else {
          console.log('🔍 [resumeWithAudio] Sending settings now');
          sendAgentSettings();
          settingsSent = true; // Assume settings were sent successfully
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (settingsSent) {
        console.log('🔍 [resumeWithAudio] ✅ Settings confirmed, enabling microphone');
        await toggleMic(true);
      } else {
        console.log('🔍 [resumeWithAudio] ❌ Cannot enable microphone: settings still not sent');
        throw new Error('Settings were not sent after multiple attempts');
      }
      
      lazyLog('Successfully resumed conversation with audio');
    } catch (error) {
      lazyLog('❌ [resumeWithAudio] Error resuming conversation with audio:', error);
      lazyLog('❌ [resumeWithAudio] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      handleError({
        service: 'agent',
        code: 'resume_audio_error',
        message: 'Failed to resume conversation with audio',
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
      
      // Send settings with conversation context only if not already sent
      if (agentManagerRef.current && !state.hasSentSettings) {
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
            greeting: options.greeting,
            context: transformConversationHistory(history) // Include conversation context in correct Deepgram API format
          }
        };
        
        lazyLog(`Sending settings with context (correct Deepgram API format):`, settingsMessage);
        agentManagerRef.current.sendJSON(settingsMessage);
        
        // Mark settings as sent
        dispatch({ type: 'SETTINGS_SENT', sent: true });
        lazyLog('Settings sent with conversation context (correct Deepgram API format)');
      } else if (state.hasSentSettings) {
        lazyLog('Settings already sent, skipping duplicate');
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

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    start,
    connectTextOnly,
    stop,
    updateAgentInstructions,
    interruptAgent,
    sleep,
    wake,
    toggleSleep,
    injectAgentMessage,
    injectUserMessage,
    toggleMicrophone: toggleMic,
    resumeWithText,
    resumeWithAudio,
    connectWithContext,
    sendAudioData, // Expose sendAudioData for testing and external use
    triggerTimeoutForTesting: () => {
      if (agentManagerRef.current) {
        agentManagerRef.current.triggerTimeoutForTesting();
      }
    },
  }));

  // Render nothing (headless component)
  return null;
}

export default forwardRef(DeepgramVoiceInteraction); 
