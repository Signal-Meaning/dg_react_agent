import React, { forwardRef, useEffect, useImperativeHandle, useReducer, useRef } from 'react';
import {
  AgentState,
  DeepgramError,
  DeepgramVoiceInteractionHandle,
  DeepgramVoiceInteractionProps,
  LLMResponse,
  TranscriptResponse,
  UpdateInstructionsPayload,

  ConnectionState
} from '../../types';
import { WebSocketManager, WebSocketEvent } from '../../utils/websocket/WebSocketManager';
import { AudioManager, AudioEvent } from '../../utils/audio/AudioManager';
import {
  VoiceInteractionState,
  initialState,
  stateReducer,
} from '../../utils/state/VoiceInteractionState';
// Note: transformConversationHistory is imported but not currently used
// import { 
//   transformConversationHistory
// } from '../../utils/conversation-context';
import { useIdleTimeoutManager } from '../../hooks/useIdleTimeoutManager';
import { AgentStateService } from '../../services/AgentStateService';

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
    onPlaybackStateChange,
    onError,
    onAgentSpeaking,
    onSettingsApplied,
  } = props;

  // Internal state
  const [state, dispatch] = useReducer(stateReducer, initialState);
  
  // Ref to hold the latest state value, avoiding stale closures in callbacks
  const stateRef = useRef<VoiceInteractionState>(state);
  
  // Ref to track connection type immediately and synchronously
  const isNewConnectionRef = useRef<boolean>(true);

  // Track mount state to handle React StrictMode double-invocation
  // StrictMode will call cleanup then immediately re-run the effect
  // We use this to avoid closing connections during StrictMode cleanup
  const isMountedRef = useRef(true);
  const mountIdRef = useRef<string>('0');
  
  // Managers - these may be null if the service is not required
  const transcriptionManagerRef = useRef<WebSocketManager | null>(null);
  const agentManagerRef = useRef<WebSocketManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  
  // Track whether speech_final=true was received to implement Deepgram's recommended pattern:
  // "trigger when speech_final=true is received (ignore subsequent UtteranceEnd)"
  // Reference: https://developers.deepgram.com/docs/understanding-end-of-speech-detection#using-utteranceend
  const speechFinalReceivedRef = useRef(false);
  
  const hasSentSettingsRef = useRef(false);
  
  // Track when settings were sent to add proper delay
  const settingsSentTimeRef = useRef<number | null>(null);
  
  // Audio blocking state management
  // When false, agent audio buffers are discarded to prevent playback
  // When true, agent audio buffers are queued and played normally
  const ALLOW_AUDIO = true;
  const BLOCK_AUDIO = false;
  const allowAgentRef = useRef<boolean>(ALLOW_AUDIO);
  
  // Connection timeout for settings to be sent after manager connection
  const SETTINGS_SEND_DELAY_MS = 500;
  
  // Global flag to prevent settings from being sent multiple times across component instances
  if (!(window as any).globalSettingsSent) {
    (window as any).globalSettingsSent = false;
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
      
      // Detect conflicts (opposite speech states within short time)
      // Note: We don't track redundant signals - multiple sources (UserStartedSpeaking, UtteranceEnd, etc.)
      // can legitimately report the same speech state. This is normal and doesn't indicate a problem.
      const conflictingEvents = vadEventHistory.current.filter(e => 
        e.timestamp > Date.now() - VAD_TRACKING_CONSTANTS.CONFLICT_WINDOW_MS &&
        e.speechDetected !== event.speechDetected
      );
      
      // Conflicts: opposite speech states reported within 2 seconds
      // This is usually normal (rapid speech, network timing). Only action needed if:
      // - Conflicts are frequent AND causing incorrect behavior (idle timeouts, state issues)
      // - You have both Voice Agent API and Transcription API VAD enabled simultaneously
      // Check: Is idle timeout firing incorrectly? Are agent states transitioning unexpectedly?
      // If yes: Review VAD source configuration (consider disabling one if both enabled).
      // If no: Safe to ignore - conflicts are expected when multiple VAD sources are active.
      if (conflictingEvents.length > 0 && props.debug) {
        console.warn('⚠️ [VAD] Conflicting signals detected (usually harmless):', {
          current: `${event.source}:${event.type} (${event.speechDetected})`,
          conflicts: conflictingEvents.map(e => `${e.source}:${e.type} (${e.speechDetected})`),
          note: 'Only investigate if seeing frequent conflicts AND incorrect behavior (idle timeouts, state issues)'
        });
      }
    } catch (error) {
      console.error('Error tracking VAD event:', error);
    }
  };
  
  // Initialize idle timeout manager
  const { handleMeaningfulActivity, handleUtteranceEnd } = useIdleTimeoutManager(
    state,
    agentManagerRef,
    props.debug
  );

  // Initialize agent state service
  const agentStateServiceRef = useRef<AgentStateService | null>(null);
  if (!agentStateServiceRef.current) {
    agentStateServiceRef.current = new AgentStateService(props.debug);
    agentStateServiceRef.current.setCallbacks({
      onAgentSpeaking,
      onStateChange: (newState) => {
        dispatch({ type: 'AGENT_STATE_CHANGE', state: newState });
      }
    });
  }
  
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

  // Store configuration for lazy manager creation
  const configRef = useRef({
    apiKey,
    transcriptionOptions,
    agentOptions,
    endpointConfig: endpointConfig || {},
    endpoints: {
      transcriptionUrl: (endpointConfig || {}).transcriptionUrl || DEFAULT_ENDPOINTS.transcriptionUrl,
      agentUrl: (endpointConfig || {}).agentUrl || DEFAULT_ENDPOINTS.agentUrl,
    },
    debug: props.debug,
  });

  // Update config ref when dependencies change
  useEffect(() => {
    configRef.current = {
      apiKey,
      transcriptionOptions,
      agentOptions,
      endpointConfig: endpointConfig || {},
      endpoints: {
        transcriptionUrl: (endpointConfig || {}).transcriptionUrl || DEFAULT_ENDPOINTS.transcriptionUrl,
        agentUrl: (endpointConfig || {}).agentUrl || DEFAULT_ENDPOINTS.agentUrl,
      },
      debug: props.debug,
    };
  }, [apiKey, transcriptionOptions, agentOptions, endpointConfig, props.debug]);

  // Factory function to create transcription manager
  const createTranscriptionManager = (): WebSocketManager | null => {
    const config = configRef.current;
    if (!config.transcriptionOptions) {
      return null;
    }

    try {
      log('🔧 [TRANSCRIPTION] Creating transcription manager lazily');
      let transcriptionUrl = config.endpoints.transcriptionUrl;
      let transcriptionQueryParams: Record<string, string | boolean | number> = {};

      // Base transcription parameters
      const baseTranscriptionParams = {
        ...config.transcriptionOptions,
        sample_rate: config.transcriptionOptions.sample_rate || 16000,
        encoding: config.transcriptionOptions.encoding || 'linear16',
        channels: config.transcriptionOptions.channels || 1,
      };

      // Add VAD configuration if provided
      if (config.transcriptionOptions.utterance_end_ms) {
        baseTranscriptionParams.utterance_end_ms = config.transcriptionOptions.utterance_end_ms;
        console.log(`VAD: utterance_end_ms set to ${config.transcriptionOptions.utterance_end_ms}ms`);
      }
      
      if (config.transcriptionOptions.interim_results !== undefined) {
        baseTranscriptionParams.interim_results = config.transcriptionOptions.interim_results;
        if (config.debug) {
          console.log(`VAD: interim_results set to ${config.transcriptionOptions.interim_results}`);
        }
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
      
      // Create Transcription WebSocket manager
      const manager = new WebSocketManager({
        url: transcriptionUrl,
        apiKey: config.apiKey,
        service: 'transcription',
        queryParams: useKeytermPrompting ? undefined : transcriptionQueryParams, 
        debug: config.debug,
        keepaliveInterval: 0, // Disable keepalives for transcription service
        onMeaningfulActivity: handleMeaningfulActivity,
      });
    
      // Set up event listeners for transcription WebSocket
      manager.addEventListener((event: WebSocketEvent) => {
        if (event.type === 'state') {
          // Only log and dispatch if state actually changed
          if (config.debug) {
            console.log('🔧 [DEBUG] Transcription state event:', event.state, 'Previous:', lastConnectionStates.current.transcription);
          }
          if (lastConnectionStates.current.transcription !== event.state) {
            log('Transcription state:', event.state);
            dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'transcription', state: event.state });
            onConnectionStateChange?.('transcription', event.state);
            lastConnectionStates.current.transcription = event.state;
          } else {
            if (config.debug) {
              console.log('🔧 [DEBUG] Transcription state unchanged, skipping:', event.state);
            }
          }
        } else if (event.type === 'message') {
          handleTranscriptionMessage(event.data);
        } else if (event.type === 'error') {
          handleError(event.error);
        }
      });

      return manager;
    } catch (error) {
      console.error('Exception in transcription manager creation:', error);
      handleError({
        service: 'transcription',
        code: 'setup_error',
        message: `Transcription manager creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return null;
    }
  };

  // Factory function to create agent manager
  const createAgentManager = (): WebSocketManager | null => {
    const config = configRef.current;
    if (!config.agentOptions) {
      return null;
    }

    try {
      log('🔧 [AGENT] Creating agent manager lazily');
      
      // Create Agent WebSocket manager
      const manager = new WebSocketManager({
        url: config.endpoints.agentUrl,
        apiKey: config.apiKey,
        service: 'agent',
        debug: config.debug,
        onMeaningfulActivity: handleMeaningfulActivity,
      });

      // Set up event listeners for agent WebSocket
      manager.addEventListener((event: WebSocketEvent) => {
        if (event.type === 'state') {
          // Only log and dispatch if state actually changed
          if (config.debug) {
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
            if (config.debug) {
              console.log('🔧 [DEBUG] Agent state unchanged, skipping:', event.state);
            }
          }
          
          // Reset settings flag when connection closes
          if (event.state === 'closed') {
            if (config.debug) {
              console.log('🔧 [Connection] Agent connection closed - checking for errors or reasons');
              console.log('🔧 [Connection] Connection close event details:', event);
            }
            
            dispatch({ type: 'SETTINGS_SENT', sent: false });
            hasSentSettingsRef.current = false; // Reset ref when connection closes
            (window as any).globalSettingsSent = false; // Reset global flag when connection closes
            settingsSentTimeRef.current = null; // Reset settings time
            if (config.debug) {
              console.log('🔧 [Connection] hasSentSettingsRef and globalSettingsSent reset to false due to connection close');
            }
            lazyLog('Reset hasSentSettings flag due to connection close');
            
            // Disable microphone when connection closes (async operation)
            if (audioManagerRef.current && audioManagerRef.current.isRecordingActive()) {
              if (config.debug) {
                console.log('🔧 [Connection] Connection closed, disabling microphone');
              }
              // Use setTimeout to avoid blocking the event handler
              setTimeout(async () => {
                try {
                  await audioManagerRef.current?.stopRecording();
                  if (config.debug) {
                    console.log('🔧 [Connection] Recording stopped due to connection close');
                  }
                } catch (error) {
                  if (config.debug) {
                    console.log('🔧 [Connection] Error stopping recording:', error);
                  }
                }
              }, 0);
            }
          }
          
          // Send settings message when connection is established
          if (event.state === 'connected' && !hasSentSettingsRef.current && !(window as any).globalSettingsSent) {
            log('Connection established, sending settings via connection state handler');
            sendAgentSettings();
          } else if (event.state === 'connected' && state.hasSentSettings) {
            log('Connection established but settings already sent, skipping');
          }
        } else if (event.type === 'message') {
          handleAgentMessage(event.data);
        } else if (event.type === 'binary') {
          handleAgentAudio(event.data);
        } else if (event.type === 'error') {
          handleError(event.error);
        }
      });

      return manager;
    } catch (error) {
      console.error('Exception in agent manager creation:', error);
      handleError({
        service: 'agent',
        code: 'setup_error',
        message: `Agent manager creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return null;
    }
  };

  // Initialize the component based on provided options
  useEffect(() => {
    // Mark as mounted and generate new mount ID for this effect run
    // This helps us detect StrictMode double-invocation
    const currentMountId = `${Date.now()}-${Math.random()}`;
    const previousMountId = mountIdRef.current;
    mountIdRef.current = currentMountId;
    isMountedRef.current = true;
    
    // Debug: Log component initialization (but limit frequency to avoid spam)
    const initTime = Date.now();
    if (!(window as any).lastComponentInitTime || initTime - (window as any).lastComponentInitTime > 1000) {
      console.log('🔧 [Component] DeepgramVoiceInteraction component initialized', {
        mountId: currentMountId,
        previousMountId,
        isStrictModeReInvoke: previousMountId !== '0' && previousMountId !== currentMountId
      });
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
    
    // Log which services are available for configuration (informational only)
    // Managers will be created lazily when start() is called
    if (isTranscriptionConfigured && isAgentConfigured) {
      log('Transcription and agent services are configured (managers will be created on demand)');
    } else if (isTranscriptionConfigured) {
      log('Transcription service is configured (manager will be created on demand)');
    } else {
      console.log('🔧 [TRANSCRIPTION] Transcription service NOT configured, skipping setup');
      log('Transcription service not configured, skipping setup');
    }

    // --- AGENT SETUP (CONDITIONAL) ---
    // Note: With lazy initialization, managers are created on-demand via start() or startAudioCapture()
    // We don't create managers here during initialization anymore
    if (isAgentConfigured) {
      log('Agent service is configured (manager will be created on demand)');
    } else {
      log('Agent service not configured, skipping setup');
    }

    // --- AUDIO SETUP (LAZY INITIALIZATION) ---
    // For Agent-Only mode, we use lazy audio initialization to prevent premature browser security prompts
    // AudioManager will only be created when user explicitly requests microphone access
    const needsAudioManager = isTranscriptionConfigured || (isAgentConfigured && agentOptions?.voice);
    
    if (needsAudioManager) {
      // Don't create AudioManager during initialization - use lazy initialization
      // AudioManager will be created when startAudioCapture() is called
      log('Audio manager will be created lazily when audio access is requested');
    } else {
      log('AudioManager not needed for this configuration, skipping setup');
    }
    
    // Component is ready immediately when configured - AudioManager is not a prerequisite
    // The component can accept text interactions and manual connections without audio
    dispatch({ type: 'READY_STATE_CHANGE', isReady: true });

    // Clean up
    return () => {
      // Capture the mount ID at cleanup time
      const cleanupMountId = mountIdRef.current;
      
      // Mark as unmounted
      isMountedRef.current = false;
      
      // Debug: Log cleanup to understand when it runs
      if (props.debug) {
        const stack = new Error().stack;
        console.log('🔧 [Component] useEffect cleanup running', {
          mountId: cleanupMountId,
          transcriptionManagerExists: !!transcriptionManagerRef.current,
          agentManagerExists: !!agentManagerRef.current
        });
        console.log('🔧 [Component] Cleanup stack trace:', stack?.split('\n').slice(2, 6).join('\n'));
      }
      
      // Check if this is a StrictMode cleanup (component will immediately re-mount)
      // We delay checking re-mount to see if StrictMode re-invokes the effect
      setTimeout(() => {
        // If component re-mounted quickly (within 100ms), this was likely StrictMode
        // In that case, don't close connections as they'll be needed for the re-mounted component
        if (isMountedRef.current) {
          if (props.debug) {
            console.log('🔧 [Component] Cleanup detected StrictMode re-invocation - preserving connections');
          }
          return; // Component re-mounted, don't close connections
        }
        
        // Component is truly unmounting - close connections
        if (props.debug) {
          console.log('🔧 [Component] Component truly unmounting - closing connections');
        }
        
        // Close managers if they were created (they handle their own event listener cleanup)
        if (transcriptionManagerRef.current) {
          if (props.debug) {
            console.log('🔧 [Component] Closing transcription manager in cleanup');
          }
          transcriptionManagerRef.current.close();
          transcriptionManagerRef.current = null;
        }
        
        if (agentManagerRef.current) {
          if (props.debug) {
            console.log('🔧 [Component] Closing agent manager in cleanup');
          }
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
      }, 100); // Small delay to detect StrictMode re-mount
    };
  }, [apiKey, transcriptionOptions, agentOptions, endpointConfig, props.debug]); 

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
    const isObject = typeof data === 'object';
    const isNotNull = data !== null;
    const hasType = isObject && isNotNull && 'type' in data;
    const result = isObject && isNotNull && hasType;
    
    if (props.debug) {
      lazyLog('🔍 [DEBUG] isTranscriptionMessage check:', {
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
      lazyLog('🔍 [DEBUG] handleTranscriptionMessage called with:', data);
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
        if (props.debug) {
          lazyLog(`[TRANSCRIPT] "${transcript}" ${transcriptData.is_final ? '(final)' : '(interim)'}${transcriptData.speech_final ? ' [SPEECH_FINAL]' : ''}`);
        }
        
        // CRITICAL FIX: Use Deepgram's recommended end-of-speech signals
        if (transcriptData.speech_final === true) {
          // speech_final=true - Deepgram's endpointing detected speech has ended
          if (props.debug) {
            console.log('🎯 [SPEECH] speech_final=true received - user finished speaking (endpointing)');
          }
          
          // Set flag to ignore subsequent UtteranceEnd (per Deepgram guidelines)
          speechFinalReceivedRef.current = true;
          
          // User stopped speaking - call callback if user was speaking
          if (stateRef.current.isUserSpeaking) {
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
          
          // User stopped speaking - call callback if user was speaking
          if (stateRef.current.isUserSpeaking) {
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
        lazyLog('🎯 [VAD] VADEvent received in handleTranscriptionMessage:', data);
      }
    }
    
    // Debug: Log transcription messages (only in debug mode and filter out empty results)
    if (props.debug) {
      // Only log if there's meaningful content or it's a VAD event
      const hasContent = typeof data === 'object' && data !== null && (
        ('alternatives' in data && (data as any).alternatives?.length > 0) ||
        ('type' in data && ['UtteranceEnd', 'vad'].includes((data as any).type))
      );
      
      if (hasContent) {
        lazyLog('📝 [TRANSCRIPTION] Message received:', data);
      }
    }
    
    // Skip processing if transcription service isn't configured
    if (!transcriptionManagerRef.current) {
      if (props.debug) {
        lazyLog('🔍 [DEBUG] Transcription service not configured, returning early');
      }
      log('Received unexpected transcription message but service is not configured:', data);
      return;
    }
    
    if (props.debug) {
      lazyLog('🔍 [DEBUG] Transcription service is configured, continuing...');
    }
    
    // Debug: Log message type for VAD debugging
    if (typeof data === 'object' && data !== null && 'type' in data) {
      if (props.debug) {
        lazyLog('🔍 [DEBUG] Processing message type:', (data as any).type);
      }
    }

    // Type guard check
    if (props.debug) {
      lazyLog('🔍 [DEBUG] Checking type guard for data:', data);
    }
    const typeGuardResult = isTranscriptionMessage(data);
    if (props.debug) {
      lazyLog('🔍 [DEBUG] isTranscriptionMessage result:', typeGuardResult);
    }
    if (!typeGuardResult) {
      if (props.debug) {
        lazyLog('🔍 [DEBUG] Type guard failed, returning early');
      }
      log('Invalid transcription message format:', data);
      return;
    }
    
    if (props.debug) {
      lazyLog('🔍 [DEBUG] Message passed type guard, processing...');
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
        console.log('🎯 [SPEECH] UtteranceEnd message received - checking if should process');
      }
      
      // Check if speech_final was already received (per Deepgram guidelines)
      if (speechFinalReceivedRef.current) {
        if (props.debug) {
          console.log('🎯 [SPEECH] UtteranceEnd ignored - speech_final=true already received');
        }
        return; // Ignore UtteranceEnd after speech_final
      }
      
      if (props.debug) {
        console.log('🎯 [SPEECH] UtteranceEnd processing - no speech_final received, user finished speaking (word timing)');
      }
      
      if (isSleepingOrEntering) {
        sleepLog('Ignoring UtteranceEnd event (state:', stateRef.current.agentState, ')');
        return;
      }
      
      // Re-enable idle timeout resets when user finishes speaking (per Deepgram docs)
      if (props.debug) {
        console.log('🎯 [SPEECH] UtteranceEnd detected - re-enabling idle timeout resets');
      }
      
      // Call the callback with channel and lastWordEnd data
      const channel = Array.isArray(data.channel) ? data.channel : [0, 1];
      const lastWordEnd = typeof data.last_word_end === 'number' ? data.last_word_end : 0;
      onUtteranceEnd?.({ channel, lastWordEnd });
      
      // User stopped speaking - UtteranceEnd indicates speech has ended
      // Always call the callback when UtteranceEnd is received
      onUserStoppedSpeaking?.();
      
      // Don't update isUserSpeaking state here - let UtteranceEnd handle idle timeout differently
      // than USER_STOPPED_SPEAKING events
      
      // Notify idle timeout service about UtteranceEnd
      handleUtteranceEnd();
      return;
    }
    
    // Note: SpeechStarted removed - was from old Transcription API
    // Voice Agent API uses UserStartedSpeaking instead
    // Use onUserStartedSpeaking for speech start detection
    
    // Note: SpeechStopped is not a real Deepgram event - removed handler
    // Use UtteranceEnd for speech end detection instead
  };

  // Lazy reconnection logging helper
  const lazyLog = (...args: unknown[]) => {
    if (props.debug) {
      console.log('🔄 [LAZY_RECONNECT]', ...args);
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
        // Include speak provider for TTS
        speak: {
          provider: {
            type: 'deepgram',
            model: agentOptions.voice || 'aura-asteria-en'
          }
        },
        greeting: agentOptions.greeting,
        context: agentOptions.context // Context is already in Deepgram API format
      }
    };
    
    console.log('📤 [Protocol] Sending agent settings with context (correct Deepgram API format):', { 
      conversationHistoryLength: agentOptions.context?.messages?.length || 0,
      contextMessages: agentOptions.context?.messages || [],
      hasSpeakProvider: 'speak' in settingsMessage.agent,
      speakModel: settingsMessage.agent.speak?.provider?.model,
      greetingPreview: (settingsMessage.agent.greeting || '').slice(0, 60)
    });
    agentManagerRef.current.sendJSON(settingsMessage);
    console.log('📤 [Protocol] Settings message sent successfully');
    
    // Mark settings as sent for welcome-first behavior
    dispatch({ type: 'SETTINGS_SENT', sent: true });
    console.log('📤 [Protocol] Settings sent state updated to true');
  };



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
        // Note: onAgentSilent callback was removed - playback state is managed via onPlaybackStateChange
        dispatch({ type: 'GREETING_PROGRESS_CHANGE', inProgress: false });
        dispatch({ type: 'GREETING_STARTED', started: false });
      }
      
      // Normal speech handling when not sleeping
      log('Clearing audio queue (barge-in)');
      clearAudio();
      onUserStartedSpeaking?.();
      
      // Update VAD state - only if we don't already have speech evidence
      // Agent service UserStartedSpeaking might be less reliable than interim results
      if (!stateRef.current.isUserSpeaking) {
        dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: true });
        if (props.debug) {
          console.log('🎯 [AGENT] UserStartedSpeaking from agent service - setting isUserSpeaking=true');
        }
      } else {
        if (props.debug) {
          console.log('🎯 [AGENT] UserStartedSpeaking from agent service - already have speech evidence, skipping');
        }
      }
      
      // Re-enable keepalives when user starts speaking
      updateKeepaliveState(true);
      
      if (isWaitingForUserVoiceAfterSleep.current) {
        log('User started speaking after wake - resetting waiting flag');
        isWaitingForUserVoiceAfterSleep.current = false;
      }
      
      // Use agent state service for state transition
      agentStateServiceRef.current?.handleUserStartedSpeaking();
      return;
    }

    // Handle Welcome message for dual mode connection
    if (data.type === 'Welcome') {
      console.info('✅ [Protocol] Welcome message received - dual mode connection established');
      log('Welcome message received - dual mode connection established');
      if (!state.welcomeReceived) {
        dispatch({ type: 'WELCOME_RECEIVED', received: true });
        
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
      
      // Call public API callback to notify that settings have been applied
      onSettingsApplied?.();
      
      return;
    }
    
    if (data.type === 'AgentThinking') {
      console.log('🧠 [AGENT EVENT] AgentThinking received');
      console.log('🎯 [AGENT] AgentThinking received - transitioning to thinking state');
      sleepLog('Dispatching AGENT_STATE_CHANGE to thinking');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      
      // Disable keepalives when agent starts thinking (user stopped speaking)
      updateKeepaliveState(false);
      
      return;
    }
    
    if (data.type === 'AgentStartedSpeaking') {
      console.log('🗣️ [AGENT EVENT] AgentStartedSpeaking received');
      console.log('🎯 [AGENT] AgentStartedSpeaking received - transitioning to speaking state');
      sleepLog('Dispatching AGENT_STATE_CHANGE to speaking');
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });

      // Track agent speaking
      if (state.greetingInProgress && !state.greetingStarted) {
        dispatch({ type: 'GREETING_STARTED', started: true });
      }
      
      return;
    }
    
    if (data.type === 'AgentAudioDone') {
      console.log('🔊 [AGENT EVENT] AgentAudioDone received');
      console.log('🎯 [AGENT] AgentAudioDone received - audio generation complete, playback may continue');
      sleepLog('AgentAudioDone received - audio generation complete, but playback may continue');
      
      // Track agent silent for greeting state
      if (state.greetingInProgress) {
        dispatch({ type: 'GREETING_PROGRESS_CHANGE', inProgress: false });
        dispatch({ type: 'GREETING_STARTED', started: false });
      }
      
      // Reset user speaking state when agent finishes speaking
      // This is important for text-based interactions where no UtteranceEnd is received
      dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
      if (stateRef.current.isUserSpeaking) {
        onUserStoppedSpeaking?.();
      }
      
      // DON'T re-enable idle timeout resets on AgentAudioDone
      // This is the generation event, not the playback event
      // The actual playback completion is handled by the audio manager
      return;
    }
    
    // Handle conversation text
    if (data.type === 'ConversationText') {
      console.log('💬 [AGENT EVENT] ConversationText received role=', data.role);
      const content = typeof data.content === 'string' ? data.content : '';
      
      // If we receive ConversationText, this means the agent is actively responding
      
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
      
      // User stopped speaking - call callback if user was speaking
      if (stateRef.current.isUserSpeaking) {
        onUserStoppedSpeaking?.();
      }
      
      // Disable keepalives when utterance ends
      updateKeepaliveState(false);
      
      // Use agent state service for state transition
      agentStateServiceRef.current?.handleUserStoppedSpeaking();
      
      // Notify idle timeout service about UtteranceEnd
      handleUtteranceEnd();
      return;
    }

    // Handle VAD events from agent service (vad type)
    // NOTE: SpeechStarted removed - was from old Transcription API, Voice Agent API uses UserStartedSpeaking
    if (props.debug) {
      lazyLog('🔍 [DEBUG] Checking for VAD event type:', data.type);
    }
    if (data.type === 'vad') {
      if (props.debug) {
        lazyLog('🎯 [VAD] VADEvent message received:', data);
      }
      log('VADEvent message received:', data);
      
      // Track VAD event for redundancy detection (internal use only)
      const speechDetected = typeof data.speech_detected === 'boolean' ? data.speech_detected : false;
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
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
  const handleAgentAudio = async (data: ArrayBuffer) => {
    if (props.debug) {
      console.log('🎵 [AUDIO EVENT] handleAgentAudio received buffer bytes=', data?.byteLength);
    }
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
    
    // Check if agent audio is blocked
    if (props.debug) {
      const isBlocked = !allowAgentRef.current;
      console.log(`🔍 [AUDIO BLOCKING] handleAgentAudio - allowAgentRef.current=${allowAgentRef.current} (BLOCKED=${isBlocked})`);
    }
    if (!allowAgentRef.current) {
      if (props.debug) {
        console.log('🔇 [AUDIO EVENT] Agent audio currently blocked (allowAgentRef=false) - discarding buffer');
      }
      log('🔇 Agent audio blocked - discarding audio buffer to prevent playback');
      return;
    }
    
    // Create AudioManager lazily if it doesn't exist (for TTS-only playback)
    if (!audioManagerRef.current) {
      log('Creating AudioManager lazily for TTS playback');
      try {
        await createAudioManager();
        log('AudioManager initialized for TTS playback');
      } catch (error) {
        log('Failed to initialize AudioManager for TTS:', error);
        handleError({
          service: 'transcription',
          code: 'audio_init_failed',
          message: `Failed to initialize AudioManager for TTS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        return;
      }
    }
    
    log('Passing buffer to AudioManager.queueAudio()');
    if (props.debug) lazyLog('🎵 [AUDIO] Audio context state:', audioManagerRef.current?.getAudioContext?.()?.state);
    audioManagerRef.current!.queueAudio(data)
      .then(() => {
        log('Successfully queued audio buffer for playback');
      })
      .catch((error: Error) => {
        log('Error queueing audio:', error);
      });
  };

  // Send audio data to WebSockets - conditionally route based on configuration
  const sendAudioData = (data: ArrayBuffer) => {
    // Debug logging only (reduce console spam)
    if (props.debug) {
      lazyLog('🎵 [sendAudioData] Called with data size:', data.byteLength);
      lazyLog('🎵 [sendAudioData] hasSentSettingsRef.current:', hasSentSettingsRef.current);
      lazyLog('🎵 [sendAudioData] state.hasSentSettings:', state.hasSentSettings);
      lazyLog('🎵 [sendAudioData] agentManagerRef.current?.getState():', agentManagerRef.current?.getState());
      lazyLog('🎵 [sendAudioData] transcriptionManagerRef.current?.getState():', transcriptionManagerRef.current?.getState());
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
            lazyLog('🎵 [sendAudioData] ❌ CRITICAL: Cannot send audio data before settings are sent!');
            lazyLog('🎵 [sendAudioData] ❌ hasSentSettingsRef.current:', hasSentSettingsRef.current);
            lazyLog('🎵 [sendAudioData] ❌ state.hasSentSettings:', state.hasSentSettings);
          }
          return; // Don't send audio data
        }
        
        // Wait for settings to be processed by Deepgram (minimum 500ms)
        if (settingsSentTimeRef.current && Date.now() - settingsSentTimeRef.current < 500) {
          if (props.debug) lazyLog('🎵 [sendAudioData] ⏳ Waiting for settings to be processed by Deepgram...');
          return; // Don't send audio data yet
        }
        
        if (props.debug) lazyLog('🎵 [sendAudioData] ✅ Settings confirmed, sending to agent service');
        agentManagerRef.current.sendBinary(data);
        
        // Log successful audio transmission (debug level)
        lazyLog('🎵 [AUDIO] Audio data sent to Deepgram agent service');
      } else if (isSleepingOrEntering) {
        if (props.debug) {
          lazyLog('🎵 [sendAudioData] Skipping agent service - sleeping state:', stateRef.current.agentState);
          sleepLog('Skipping sendAudioData to agent (state:', stateRef.current.agentState, ')');
        }
      } else {
        if (props.debug) lazyLog('🎵 [sendAudioData] Skipping agent service - not connected:', connectionState);
      }
    }
  };

  // Start the connection
  const start = async (options?: { agent?: boolean; transcription?: boolean }): Promise<void> => {
    try {
      log('Start method called', options ? `with options: ${JSON.stringify(options)}` : 'without options');
      
      // Check if we're starting a fresh connection or just ensuring an existing one
      // Only reset audio blocking state if we're actually creating a NEW connection
      // CRITICAL: If ANY manager exists (even if not connected), we're not doing a fresh start
      // This preserves blocking state when start() is called to ensure an existing connection
      const config = configRef.current;
      const agentManagerExists = !!agentManagerRef.current;
      const transcriptionManagerExists = !!transcriptionManagerRef.current;
      const agentAlreadyConnected = agentManagerRef.current?.getState() === 'connected';
      const transcriptionAlreadyConnected = transcriptionManagerRef.current?.getState() === 'connected';
      
      // Fresh start ONLY if NO managers exist AND we're requesting at least one service
      // If any manager exists, this is NOT a fresh start (preserve blocking state)
      const isRequestingServices = 
        (options?.agent === true) || 
        (options?.transcription === true) || 
        (!options && (!!config.agentOptions || !!config.transcriptionOptions));
      const isFreshStart = !agentManagerExists && !transcriptionManagerExists && isRequestingServices;
      
      // Reset audio blocking state ONLY on fresh connection
      // This preserves blocking state when start() is called on an existing connection
      // (Fix for Issue #223: blocking state was being reset unnecessarily)
      if (isFreshStart) {
        const previousBlockingState = allowAgentRef.current;
        allowAgentRef.current = ALLOW_AUDIO;
        if (props.debug) {
          console.log(`🔍 [AUDIO BLOCKING] start() - Fresh connection detected, resetting allowAgentRef from ${previousBlockingState} to ${ALLOW_AUDIO}`);
        }
        log('🔄 Fresh connection starting - resetting audio blocking state');
      } else {
        if (props.debug) {
          console.log(`🔍 [AUDIO BLOCKING] start() - Connection already exists (agent=${agentAlreadyConnected}, transcription=${transcriptionAlreadyConnected}), preserving allowAgentRef.current=${allowAgentRef.current}`);
        }
        log('🔄 Connection already exists - preserving audio blocking state');
      }
      
      // Determine which services to start
      // (config already extracted above)
      const isTranscriptionConfigured = !!config.transcriptionOptions;
      const isAgentConfigured = !!config.agentOptions;
      
      // If options object provided (even if only one key), only start explicitly requested services
      // If no options object provided, default to props configuration
      const hasExplicitOptions = options !== undefined;
      
      const shouldStartTranscription = hasExplicitOptions
        ? (options.transcription === true)
        : isTranscriptionConfigured;
      const shouldStartAgent = hasExplicitOptions
        ? (options.agent === true)
        : isAgentConfigured;
      
      log(`Service start flags: transcription=${shouldStartTranscription}, agent=${shouldStartAgent}`);
      
      // Validate that requested services are configured
      if (shouldStartTranscription && !isTranscriptionConfigured) {
        throw new Error('Transcription service requested but transcriptionOptions not configured');
      }
      if (shouldStartAgent && !isAgentConfigured) {
        throw new Error('Agent service requested but agentOptions not configured');
      }
      
      // Create managers lazily if needed
      if (shouldStartTranscription && !transcriptionManagerRef.current) {
        log('Creating transcription manager lazily...');
        transcriptionManagerRef.current = createTranscriptionManager();
        if (!transcriptionManagerRef.current) {
          throw new Error('Failed to create transcription manager');
        }
      }
      
      if (shouldStartAgent && !agentManagerRef.current) {
        log('Creating agent manager lazily...');
        agentManagerRef.current = createAgentManager();
        if (!agentManagerRef.current) {
          throw new Error('Failed to create agent manager');
        }
      }
      
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

      // Connect transcription WebSocket if it should be started
      if (shouldStartTranscription && transcriptionManagerRef.current) {
        log('Connecting Transcription WebSocket...');
        await transcriptionManagerRef.current.connect();
        log('Transcription WebSocket connected');
      } else if (shouldStartTranscription) {
        log('Transcription manager not available despite being requested');
      } else {
        log('Transcription service not requested, skipping connection');
      }
      
      // Connect agent WebSocket if it should be started
      if (shouldStartAgent && agentManagerRef.current) {
        log('Connecting Agent WebSocket...');
        await agentManagerRef.current.connect();
        log('Agent WebSocket connected');
      } else if (shouldStartAgent) {
        log('Agent manager not available despite being requested');
      } else {
        log('Agent service not requested, skipping connection');
      }
      
      // Note: Recording is controlled externally via startAudioCapture()
      // The start() method only establishes WebSocket connections
      if (audioManagerRef.current) {
        log('AudioManager available - recording can be started via startAudioCapture()');
      } else {
        log('AudioManager not available - this is expected for text-only agent interactions');
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
        transcriptionManagerRef.current = null; // Clear ref so manager can be recreated
      }
      
      if (agentManagerRef.current) {
        agentManagerRef.current.close();
        agentManagerRef.current = null; // Clear ref so manager can be recreated
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
    const previousBlockingState = allowAgentRef.current;
    allowAgentRef.current = BLOCK_AUDIO;
    if (props.debug) {
      console.log(`🔍 [AUDIO BLOCKING] interruptAgent() - Set allowAgentRef from ${previousBlockingState} to ${BLOCK_AUDIO}`);
    }
    log('🔇 Agent audio blocked - future audio will be discarded');
    
    log('🔴 Setting agent state to idle');
    sleepLog('Dispatching AGENT_STATE_CHANGE to idle (from interruptAgent)');
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
    log('🔴 interruptAgent method completed');
  };

  const allowAgent = (): void => {
    log('🔊 allowAgent method called');
    const previousBlockingState = allowAgentRef.current;
    allowAgentRef.current = ALLOW_AUDIO;
    if (props.debug) {
      console.log(`🔍 [AUDIO BLOCKING] allowAgent() - Set allowAgentRef from ${previousBlockingState} to ${ALLOW_AUDIO}`);
    }
    log('🔊 Agent audio allowed - audio will play normally');
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
    
    // Use agent state service for sleep transition
    agentStateServiceRef.current?.handleSleepStateChange(true);
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
    
    // Use agent state service for wake transition
    agentStateServiceRef.current?.handleSleepStateChange(false);
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
  const injectUserMessage = async (message: string): Promise<void> => {
    const config = configRef.current;
    if (!config.agentOptions) {
      log('Cannot inject user message: agentOptions not configured');
      throw new Error('Agent service not configured');
    }
    
    // Create agent manager if it doesn't exist
    if (!agentManagerRef.current) {
      log('Creating agent manager lazily for injectUserMessage...');
      agentManagerRef.current = createAgentManager();
      if (!agentManagerRef.current) {
        throw new Error('Failed to create agent manager - createAgentManager returned null');
      }
      log('Agent manager created successfully');
    } else {
      log('Agent manager already exists, reusing');
    }
    
    // Store reference to manager to check if it gets cleared
    const managerBeforeConnect = agentManagerRef.current;
    log('Manager reference stored, state:', managerBeforeConnect.getState());
    
    // Ensure connection is established
    const connectionState = managerBeforeConnect.getState();
    if (connectionState !== 'connected') {
      log('Agent manager not connected, establishing connection...', 'Current state:', connectionState);
      await managerBeforeConnect.connect();
      
      // Check if manager still exists and is the same instance
      if (!agentManagerRef.current || agentManagerRef.current !== managerBeforeConnect) {
        log('⚠️ Manager was cleared or replaced during connection');
        throw new Error('Agent manager was cleared or replaced during connection');
      }
      
      // Wait a moment for settings to be sent
      await new Promise(resolve => setTimeout(resolve, SETTINGS_SEND_DELAY_MS));
      
      // Final check - manager should still exist
      if (!agentManagerRef.current || agentManagerRef.current !== managerBeforeConnect) {
        log('⚠️ Manager was cleared or replaced after connection');
        throw new Error('Agent manager was cleared or replaced after connection');
      }
      
      const finalState = agentManagerRef.current.getState();
      log('Connection established, final state:', finalState);
    } else {
      log('Agent manager already connected');
    }
    
    // Check WebSocket state before sending
    const finalConnectionState = agentManagerRef.current.getState();
    log('Injecting user message:', message, '- WebSocket state:', finalConnectionState);
    console.log('📝 [TEXT_MESSAGE] Attempting to send:', message, '- Connection state:', finalConnectionState);
    
    if (!agentManagerRef.current) {
      throw new Error('Agent manager is null when trying to send message');
    }
    
    // Initialize AudioManager proactively if it doesn't exist
    // This ensures AudioContext is ready when agent responds with binary audio
    // User interaction (sending message) allows AudioContext to be unsuspended
    if (!audioManagerRef.current) {
      log('Initializing AudioManager proactively for TTS playback (user interaction via text message)');
      try {
        await createAudioManager();
        log('AudioManager initialized proactively');
        
        // Resume AudioContext if it's suspended (browser autoplay policy)
        if (audioManagerRef.current) {
          try {
            const audioContext = (audioManagerRef.current as AudioManager).getAudioContext();
          if (audioContext && audioContext.state === 'suspended') {
            log('Resuming suspended AudioContext (user interaction permits this)');
            await audioContext.resume();
            log('AudioContext resumed successfully');
            }
          } catch (error) {
            log('Failed to get or resume AudioContext:', error);
          }
        }
      } catch (error) {
        log('Failed to initialize AudioManager proactively:', error);
        // Don't block message sending - audio might work anyway
      }
    } else {
      // AudioManager exists, but ensure AudioContext is resumed
      if (audioManagerRef.current) {
        try {
          const audioContext = (audioManagerRef.current as AudioManager).getAudioContext();
      if (audioContext && audioContext.state === 'suspended') {
        log('Resuming suspended AudioContext (user interaction permits this)');
          await audioContext.resume();
          log('AudioContext resumed successfully');
          }
        } catch (error) {
          log('Failed to get or resume AudioContext:', error);
      }
    }
    }
    
    agentManagerRef.current.sendJSON({
      type: 'InjectUserMessage',
      content: message
    });
    
    console.log('📝 [TEXT_MESSAGE] Message sent successfully');
    log('User message sent successfully');
  };
  // Helper function to create and initialize AudioManager
  const createAudioManager = async (): Promise<void> => {
    if (audioManagerRef.current) {
      return; // Already exists
    }
    audioManagerRef.current = new AudioManager({
      debug: props.debug,
    });

    // Set up event listeners for audio manager
    audioManagerRef.current.addEventListener((event: AudioEvent) => {
      if (event.type === 'ready') {
        log('Audio manager ready');
      } else if (event.type === 'recording') {
        log('Recording state:', event.isRecording);
        dispatch({ type: 'RECORDING_STATE_CHANGE', isRecording: event.isRecording });
      } else if (event.type === 'playing') {
        log('Playing state:', event.isPlaying);
        console.log(`🎯 [AUDIO] Playback state changed: ${event.isPlaying ? 'PLAYING' : 'NOT PLAYING'}, current agent state: ${stateRef.current.agentState}`);
        dispatch({ type: 'PLAYBACK_STATE_CHANGE', isPlaying: event.isPlaying });
        
        // Transition agent to speaking when playback starts
        // This is the primary mechanism for detecting TTS playback and transitioning to speaking state
        // It handles cases where AgentStartedSpeaking message isn't received or is delayed
        // This works for transitions from: idle -> speaking, thinking -> speaking, listening -> speaking
        if (event.isPlaying) {
          const currentState = stateRef.current.agentState;
          if (currentState !== 'speaking') {
            console.log(`🎯 [AGENT] Audio playback started - transitioning from ${currentState} to speaking`);
            sleepLog(`Dispatching AGENT_STATE_CHANGE to speaking (from playback start, previous state: ${currentState})`);
            dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
          } else {
            console.log(`🎯 [AGENT] Audio playback started but already in speaking state - no transition needed`);
          }
        }
        
        // Transition agent to idle when audio playback stops
        // Only transition if we're currently in speaking state (prevents invalid transitions)
        if (!event.isPlaying) {
          const currentState = stateRef.current.agentState;
          if (currentState === 'speaking') {
            console.log('🎯 [AGENT] Audio playback finished - transitioning agent from speaking to idle');
            sleepLog('Audio playback finished - transitioning agent to idle');
            dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
          } else {
            console.log(`🎯 [AGENT] Audio playback stopped but agent state is ${currentState} (not speaking) - skipping transition to idle`);
          }
        }
      } else if (event.type === 'error') {
        handleError(event.error);
      } else if (event.type === 'data') {
        sendAudioData(event.data);
      }
    });

    // Initialize AudioManager
    await audioManagerRef.current.initialize();
    log('AudioManager initialized');
  };

  // Start audio capture with lazy initialization
  const startAudioCapture = async (): Promise<void> => {
    try {
      log('startAudioCapture called - initializing audio manager lazily');
      
      const config = configRef.current;
      const isTranscriptionConfigured = !!config.transcriptionOptions;
      const isAgentConfigured = !!config.agentOptions;
      
      // Create AudioManager if it doesn't exist
      await createAudioManager();
      
      // Verify AudioManager was created
      if (!audioManagerRef.current) {
        throw new Error('AudioManager creation failed or was cleared');
      }

      // Handle lazy manager creation for microphone use case
      // When microphone starts, we typically need both transcription (for VAD) and agent
      
      // Check if agent is already connected
      const agentAlreadyConnected = agentManagerRef.current?.getState() === 'connected';
      
      // Create and connect transcription manager if needed
      if (isTranscriptionConfigured) {
        if (!transcriptionManagerRef.current) {
          log('Creating transcription manager lazily for microphone...');
          transcriptionManagerRef.current = createTranscriptionManager();
          if (!transcriptionManagerRef.current) {
            throw new Error('Failed to create transcription manager');
          }
        }
        
        // Connect transcription if not already connected
        if (transcriptionManagerRef.current.getState() !== 'connected') {
          log('Connecting transcription service for microphone/VAD...');
          await transcriptionManagerRef.current.connect();
        }
      }
      
      // Create and connect agent manager if needed (only if not already connected)
      if (isAgentConfigured && !agentAlreadyConnected) {
        if (!agentManagerRef.current) {
          log('Creating agent manager lazily for microphone...');
          agentManagerRef.current = createAgentManager();
          if (!agentManagerRef.current) {
            throw new Error('Failed to create agent manager');
          }
        }
        
        // Connect agent if not already connected
        if (agentManagerRef.current.getState() !== 'connected') {
          log('Connecting agent service for microphone...');
          await agentManagerRef.current.connect();
          // Wait for settings to be sent
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else if (isAgentConfigured && agentAlreadyConnected) {
        log('Agent service already connected, skipping connection');
      }

      // Final check before starting recording
      if (!audioManagerRef.current) {
        throw new Error('AudioManager was cleared before starting recording');
      }
      
      // Verify connections are established before starting recording
      // Agent connection is required for microphone use
      if (isAgentConfigured) {
        const agentState = agentManagerRef.current?.getState();
        if (agentState !== 'connected') {
          log(`⚠️ Agent connection is ${agentState}, not 'connected'. Cannot start microphone.`);
          throw new Error(`Cannot start microphone: agent connection is ${agentState}, expected 'connected'`);
        }
      }
      
      // Transcription connection should also be connected if configured
      if (isTranscriptionConfigured) {
        const transcriptionState = transcriptionManagerRef.current?.getState();
        if (transcriptionState !== 'connected') {
          log(`⚠️ Transcription connection is ${transcriptionState}, not 'connected'. Cannot start microphone.`);
          throw new Error(`Cannot start microphone: transcription connection is ${transcriptionState}, expected 'connected'`);
        }
      }
      
      // Start recording
      await audioManagerRef.current.startRecording();
      
      // Reset idle timeout - starting recording is meaningful user activity
      // This prevents race condition where timeout fires before first transcript arrives
      handleMeaningfulActivity('startAudioCapture');
      
      log('Audio capture started successfully');
    } catch (error) {
      log('Failed to start audio capture:', error);
      handleError({
        service: 'transcription',
        code: 'audio_capture_failed',
        message: `Failed to start audio capture: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    // Core connection methods
    start,
    stop,
    
    // Agent interaction methods
    updateAgentInstructions,
    interruptAgent,
    allowAgent,
    sleep,
    wake,
    toggleSleep,
    injectAgentMessage,
    injectUserMessage,
    
    // Microphone control
    startAudioCapture,
    
    // Audio data handling
    sendAudioData, // Expose sendAudioData for testing and external use
    
    // Audio context access
    getAudioContext: () => {
      // If AudioManager doesn't exist, trigger lazy initialization (fire-and-forget)
      // This allows user interaction (like text input focus) to initialize AudioContext
      if (!audioManagerRef.current && agentOptions) {
        log('getAudioContext() called - triggering lazy AudioManager initialization');
        createAudioManager().catch((error) => {
          log('Failed to initialize AudioManager from getAudioContext():', error);
        });
      }
      return audioManagerRef.current?.getAudioContext() || undefined;
    },
  }));

  // Render nothing (headless component)
  return null;
}

export default forwardRef(DeepgramVoiceInteraction); 
