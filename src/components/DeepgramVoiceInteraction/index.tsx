import React, { forwardRef, useEffect, useImperativeHandle, useReducer, useRef } from 'react';
import {
  AgentState,
  AgentOptions,
  DeepgramError,
  DeepgramVoiceInteractionHandle,
  DeepgramVoiceInteractionProps,
  LLMResponse,
  TranscriptResponse,
  TranscriptAlternative,
  UpdateInstructionsPayload,
  FunctionCallRequest,
  FunctionCallResponse,
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
import { useCallbackRef, useBooleanDeclarativeProp } from '../../hooks/declarative-props';
import { AgentStateService } from '../../services/AgentStateService';
import { compareAgentOptionsIgnoringContext, hasDependencyChanged } from '../../utils/option-comparison';
import { filterFunctionsForSettings } from '../../utils/function-utils';
import { functionCallLogger } from '../../utils/function-call-logger';
import {
  hasSettingsBeenSent,
  waitForSettings,
  warnAboutNonMemoizedOptions,
  WindowWithDeepgramGlobals
} from '../../utils/component-helpers';

// Default endpoints
const DEFAULT_ENDPOINTS = {
  transcriptionUrl: 'wss://api.deepgram.com/v1/listen',
  agentUrl: 'wss://agent.deepgram.com/v1/agent/converse',
};

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
    proxyEndpoint,
    proxyAuthToken,
    // Change defaults from {} to undefined for stability
    transcriptionOptions, // = {}, - remove default
    agentOptions, // = {}, - remove default
    endpointConfig,
    audioConstraints, // Phase 2: Issue #243
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
    onFunctionCallRequest,
    debug,
    // Declarative props (Issue #305)
    userMessage,
    onUserMessageSent,
    autoStartAgent,
    autoStartTranscription,
    connectionState,
    interruptAgent: interruptAgentProp,
    onAgentInterrupted,
    startAudioCapture: startAudioCaptureProp,
  } = props;

  // Internal state
  const [state, dispatch] = useReducer(stateReducer, initialState);
  
  // Ref to hold the latest state value, avoiding stale closures in callbacks
  const stateRef = useRef<VoiceInteractionState>(state);
  
  // Ref to hold the latest agentOptions value, avoiding stale closures in callbacks
  // Issue #307: Fix closure issue where sendAgentSettings captures stale agentOptions
  const agentOptionsRef = useRef<typeof agentOptions>(agentOptions);
  
  // Ref to track connection type immediately and synchronously
  const isNewConnectionRef = useRef<boolean>(true);

  // Track mount state to handle React StrictMode double-invocation
  // StrictMode will call cleanup then immediately re-run the effect
  // We use this to avoid closing connections during StrictMode cleanup
  const isMountedRef = useRef(true);
  const mountIdRef = useRef<string>('0');
  
  // Issue #769: Track component remounts for debugging
  // This ref persists across re-renders but resets on actual remount
  // Use this to detect if component is actually remounting vs just re-rendering
  const componentInstanceIdRef = useRef<string | null>(null);
  const previousInstanceIdRef = useRef<string | null>(null);
  
  // Detect actual remounts (not just re-renders)
  // This runs on every render, but only generates a new ID on first mount
  if (componentInstanceIdRef.current === null) {
    // First mount - generate instance ID
    componentInstanceIdRef.current = `instance-${Date.now()}-${Math.random()}`;
    const windowWithGlobals = typeof window !== 'undefined' ? window as WindowWithDeepgramGlobals : undefined;
    const shouldLogRemounts = props.debug || windowWithGlobals?.__DEEPGRAM_DEBUG_REMOUNTS__;
    
    // If we had a previous instance ID, this is a remount
    // (This can happen if the component was unmounted and remounted)
    if (previousInstanceIdRef.current !== null && shouldLogRemounts) {
      console.warn('⚠️ [Component] COMPONENT REMOUNT DETECTED!', {
        previousInstanceId: previousInstanceIdRef.current,
        newInstanceId: componentInstanceIdRef.current,
        reason: 'Component was unmounted and remounted by React (likely parent component remount or key prop change)',
        timestamp: new Date().toISOString()
      });
    }
    
    // Always log mount (even if not a remount) when debugging is enabled
    if (shouldLogRemounts) {
      console.log('🔧 [Component] DeepgramVoiceInteraction component MOUNTED (new instance)', {
        instanceId: componentInstanceIdRef.current,
        previousInstanceId: previousInstanceIdRef.current,
        isRemount: previousInstanceIdRef.current !== null,
        timestamp: new Date().toISOString()
      });
    }
    
    previousInstanceIdRef.current = componentInstanceIdRef.current;
  }
  
  // Ref to store cleanup timeout ID for proper cleanup
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref to store agentOptions re-send timeout ID for cleanup
  // Issue #311: Prevents memory leaks when agentOptions changes rapidly or component unmounts
  const agentOptionsResendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Constant for StrictMode remount detection delay
  const STRICT_MODE_REMOUNT_DETECTION_DELAY_MS = 100;
  
  // Refs to store previous values of object dependencies for deep comparison
  // This prevents unnecessary re-initialization when parent re-renders with new object references
  // but same content (Issue #276)
  // Initialize with undefined to detect first mount
  const prevTranscriptionOptionsRef = useRef<typeof transcriptionOptions | undefined>(undefined);
  const prevAgentOptionsRef = useRef<typeof agentOptions | undefined>(undefined);
  const prevEndpointConfigRef = useRef<typeof endpointConfig | undefined>(undefined);
  const prevApiKeyRef = useRef<string | undefined>(undefined);
  const prevDebugRef = useRef<boolean | undefined>(undefined);
  
  // Managers - these may be null if the service is not required
  const transcriptionManagerRef = useRef<WebSocketManager | null>(null);
  const agentManagerRef = useRef<WebSocketManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  
  // Guard to prevent race conditions between explicit stop() and connection close handler
  // Fix for issue #239: Prevents double-stopping audio when both paths try to stop
  const isStoppingAudioRef = useRef<boolean>(false);
  
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
  
  // Note: Settings are sent immediately after connection - no delay needed
  // Removed SETTINGS_SEND_DELAY_MS as it was unused
  
  // Global flag to prevent settings from being sent multiple times across component instances
  const windowWithGlobals = window as WindowWithDeepgramGlobals;
  if (!windowWithGlobals.globalSettingsSent) {
    windowWithGlobals.globalSettingsSent = false;
  }
  
  // Global flag to prevent multiple component initializations during HMR
  if (!windowWithGlobals.componentInitializationCount) {
    windowWithGlobals.componentInitializationCount = 0;
  }
  windowWithGlobals.componentInitializationCount++;
  
  // Remove HMR prevention logic - it's causing React hook errors
  
  // Global flag to track if audio is currently being captured
  if (!windowWithGlobals.audioCaptureInProgress) {
    windowWithGlobals.audioCaptureInProgress = false;
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
  
  // Track if we've notified onAgentStateChange('speaking') for the current playback cycle
  // This prevents duplicate callbacks when both AgentStartedSpeaking and playback events fire
  const hasNotifiedSpeakingForPlaybackRef = useRef<boolean>(false);
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
  const { handleMeaningfulActivity, handleUtteranceEnd, handleFunctionCallStarted, handleFunctionCallCompleted } = useIdleTimeoutManager(
    state,
    agentManagerRef,
    props.debug,
    props.onIdleTimeoutActiveChange
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
    // Issue #366: CLIENT_MESSAGE_TIMEOUT occurs when Deepgram's server timeout fires
    // This can happen if Deepgram's server-side timeout (~60s) fires before the component's idle timeout (10s)
    // or when Deepgram is waiting for a response (e.g., function call) and doesn't receive it.
    // Since this can occur during normal idle scenarios (when server timeout fires), log at debug level.
    const isClientMessageTimeout = error.code === 'CLIENT_MESSAGE_TIMEOUT';
    
    if (isClientMessageTimeout) {
      // Debug-level logging - can occur during idle disconnects when server timeout fires
      log('⚠️ [Agent] CLIENT_MESSAGE_TIMEOUT (may occur during idle disconnects):', error);
    } else {
      // Error-level logging for unexpected errors
      console.log('🚨 [ERROR] Deepgram error received:', error);
      console.log('🚨 [ERROR] Error service:', error.service);
      console.log('🚨 [ERROR] Error code:', error.code);
      console.log('🚨 [ERROR] Error message:', error.message);
      console.log('🚨 [ERROR] Error details:', error.details);
      log('Error:', error);
    }
    
    dispatch({ type: 'ERROR', message: error.message });
    onError?.(error);
  };

  // Helper function for declarative prop error handling
  const createDeclarativeErrorHandler = (
    service: 'agent' | 'transcription',
    code: string,
    operation: string
  ): ((error: unknown) => void) => {
    return (error: unknown) => {
      log(`[Declarative] Failed to ${operation}:`, error);
      handleError({
        service,
        code,
        message: `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    };
  };

  // Determine connection mode
  const isProxyMode = !!proxyEndpoint;
  const connectionMode = isProxyMode ? 'proxy' : 'direct';

  // Helper: Validate connection configuration (DRY)
  const validateConnectionConfig = (service: 'transcription' | 'agent'): boolean => {
    const config = configRef.current;
    if (!config.apiKey && !config.proxyEndpoint) {
      const error: DeepgramError = {
        service,
        code: 'configuration_error',
        message: 'Either apiKey or proxyEndpoint must be provided. apiKey for direct connection, proxyEndpoint for backend proxy mode.',
      };
      handleError(error);
      return false;
    }
    return true;
  };

  // Helper: Get final URL based on connection mode (DRY)
  const getConnectionUrl = (defaultUrl: string): string => {
    const config = configRef.current;
    return config.connectionMode === 'proxy' && config.proxyEndpoint
      ? config.proxyEndpoint
      : defaultUrl;
  };

  // Helper: Get WebSocket manager connection options (DRY)
  const getConnectionOptions = (): { apiKey: string; authToken?: string } => {
    const config = configRef.current;
    if (config.connectionMode === 'proxy') {
      return {
        apiKey: '',
        authToken: config.proxyAuthToken,
      };
    }
    // In direct mode, pass the actual apiKey value
    // REGRESSION FIX (v0.7.0): The original code used || '' which converted undefined to empty string.
    // This caused WebSocketManager to incorrectly detect proxy mode when apiKey was undefined.
    // We now use ?? '' to preserve undefined values (converted to empty string for type safety).
    // However, if apiKey is actually provided, it should be passed through correctly.
    const apiKeyValue = config.apiKey ?? '';
    // ALWAYS log this to debug the regression (remove after fix is verified)
    console.log('🔧 [getConnectionOptions] Direct mode (ALWAYS LOG):', {
      connectionMode: config.connectionMode,
      apiKeyProvided: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 'EMPTY',
      apiKeyValueLength: apiKeyValue.length,
      apiKeyValuePreview: apiKeyValue ? `${apiKeyValue.substring(0, 8)}...${apiKeyValue.substring(apiKeyValue.length - 4)}` : 'EMPTY',
    });
    return {
      apiKey: apiKeyValue,
    };
  };

  // Store configuration for lazy manager creation
  const configRef = useRef({
    apiKey,
    proxyEndpoint,
    proxyAuthToken,
    connectionMode,
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
      proxyEndpoint,
      proxyAuthToken,
      connectionMode,
      transcriptionOptions,
      agentOptions,
      endpointConfig: endpointConfig || {},
      endpoints: {
        transcriptionUrl: (endpointConfig || {}).transcriptionUrl || DEFAULT_ENDPOINTS.transcriptionUrl,
        agentUrl: (endpointConfig || {}).agentUrl || DEFAULT_ENDPOINTS.agentUrl,
      },
      debug: props.debug,
    };
  }, [apiKey, proxyEndpoint, proxyAuthToken, connectionMode, transcriptionOptions, agentOptions, endpointConfig, props.debug]);

  // Factory function to create transcription manager
  const createTranscriptionManager = (): WebSocketManager | null => {
    const config = configRef.current;
    if (!config.transcriptionOptions) {
      return null;
    }

    // Validate connection configuration
    if (!validateConnectionConfig('transcription')) {
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
      
      // Determine URL and connection options based on connection mode
      const finalTranscriptionUrl = getConnectionUrl(transcriptionUrl);
      const connectionOptions = getConnectionOptions();
      
      // Create Transcription WebSocket manager
      // Add service type to query params for proxy routing
      const transcriptionQueryParamsWithService = useKeytermPrompting 
        ? { service: 'transcription' }
        : { ...transcriptionQueryParams, service: 'transcription' };
      
      const manager = new WebSocketManager({
        url: finalTranscriptionUrl,
        apiKey: connectionOptions.apiKey,
        authToken: connectionOptions.authToken,
        service: 'transcription',
        queryParams: transcriptionQueryParamsWithService, 
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

    // Validate connection configuration
    if (!validateConnectionConfig('agent')) {
      return null;
    }

    try {
      log('🔧 [AGENT] Creating agent manager lazily');
      
      // Determine URL and connection options based on connection mode
      const finalAgentUrl = getConnectionUrl(config.endpoints.agentUrl);
      const connectionOptions = getConnectionOptions();
      
      // Create Agent WebSocket manager
      // Add service type to query params for proxy routing
      const agentQueryParams = { service: 'agent' };
      
      if (config.debug) {
        console.log('🔧 [AGENT] Creating WebSocketManager with URL:', finalAgentUrl);
        console.log('🔧 [AGENT] Connection mode:', config.connectionMode);
        console.log('🔧 [AGENT] Proxy endpoint:', config.proxyEndpoint);
        console.log('🔧 [AGENT] API key present:', !!connectionOptions.apiKey);
        console.log('🔧 [AGENT] Auth token present:', !!connectionOptions.authToken);
      }
      
      const manager = new WebSocketManager({
        url: finalAgentUrl,
        apiKey: connectionOptions.apiKey,
        authToken: connectionOptions.authToken,
        service: 'agent',
        queryParams: agentQueryParams,
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
            windowWithGlobals.globalSettingsSent = false; // Reset global flag when connection closes
            settingsSentTimeRef.current = null; // Reset settings time
            if (config.debug) {
              console.log('🔧 [Connection] hasSentSettingsRef and globalSettingsSent reset to false due to connection close');
            }
            if (props.debug) console.log('Reset hasSentSettings flag due to connection close');
            
            // Disable microphone when connection closes
            // CRITICAL: Stop audio synchronously to prevent race conditions with explicit stop() calls
            // Fix for issue #239: Audio tracks were hanging because setTimeout deferred cleanup
            if (audioManagerRef.current && audioManagerRef.current.isRecordingActive()) {
              // Check guard: if audio is already being stopped by explicit stop(), skip to prevent double-stop
              if (isStoppingAudioRef.current) {
                if (config.debug) {
                  console.log('🔧 [Connection] Audio already being stopped by explicit stop(), skipping connection close handler');
                }
                return; // Early return to prevent double-stopping
              }
              
              if (config.debug) {
                console.log('🔧 [Connection] Connection closed, disabling microphone');
              }
              try {
                // Set guard to prevent double-stopping if explicit stop() is called concurrently
                isStoppingAudioRef.current = true;
                // Stop recording synchronously - stopRecording() is synchronous, no need for setTimeout
                audioManagerRef.current.stopRecording();
                if (config.debug) {
                  console.log('🔧 [Connection] Recording stopped due to connection close');
                }
                // Reset guard immediately after stopping (synchronous operation is complete)
                isStoppingAudioRef.current = false;
              } catch (error) {
                // Reset guard even on error
                isStoppingAudioRef.current = false;
                if (config.debug) {
                  console.log('🔧 [Connection] Error stopping recording:', error);
                }
                // Log error but don't throw - connection is already closing
                log('Error stopping recording on connection close:', error);
              }
            }
          }
          
          // Send settings message when connection is established
          if (event.state === 'connected') {
            if (config.debug) {
              console.log('🔧 [Connection State] Agent connected, checking if Settings should be sent:', {
                hasSentSettingsRef: hasSentSettingsRef.current,
                globalSettingsSent: windowWithGlobals.globalSettingsSent,
                stateHasSentSettings: state.hasSentSettings,
                shouldSend: !hasSentSettingsRef.current && !windowWithGlobals.globalSettingsSent
              });
            }
            if (!hasSentSettingsRef.current && !windowWithGlobals.globalSettingsSent) {
              log('Connection established, sending settings via connection state handler');
              if (config.debug) {
                console.log('🔧 [Connection State] ✅ Will send Settings after WebSocket is fully open');
              }
              // Wait for WebSocket to be fully OPEN before sending Settings (Issue #329)
              // React StrictMode can cause timing issues where state is 'connected' but WebSocket isn't fully OPEN yet
              const checkAndSend = () => {
                const wsState = agentManagerRef.current?.getReadyState() ?? undefined;
                const wsStateName = wsState === 0 ? 'CONNECTING' : 
                                    wsState === 1 ? 'OPEN' : 
                                    wsState === 2 ? 'CLOSING' : 
                                    wsState === 3 ? 'CLOSED' : 'UNKNOWN';
                
                if (config.debug) {
                  console.log('🔧 [Connection State] Checking WebSocket state:', wsState, `(${wsStateName})`);
                }
                
                if (wsState === 1) { // OPEN
                  if (config.debug) {
                    console.log('🔧 [Connection State] WebSocket is OPEN, sending Settings');
                  }
                  sendAgentSettings();
                } else if (wsState === 0) { // CONNECTING
                  // Still connecting, wait a bit more
                  if (config.debug) {
                    console.log('🔧 [Connection State] WebSocket still CONNECTING, will retry');
                  }
                  setTimeout(checkAndSend, 50);
                } else {
                  // CLOSING or CLOSED - connection is gone, can't send Settings
                  if (config.debug) {
                    console.error('🔧 [Connection State] WebSocket is', wsStateName, '- cannot send Settings');
                  }
                }
              };
              
              // Start checking after a small delay to allow WebSocket to transition to OPEN
              setTimeout(checkAndSend, 50);
            } else if (state.hasSentSettings) {
              log('Connection established but settings already sent, skipping');
              if (config.debug) {
                console.log('🔧 [Connection State] ⚠️ Settings already sent, skipping');
              }
            } else {
              if (config.debug) {
                console.log('🔧 [Connection State] ⚠️ Settings not sent - blocked by flags:', {
                  hasSentSettingsRef: hasSentSettingsRef.current,
                  globalSettingsSent: windowWithGlobals.globalSettingsSent
                });
              }
            }
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
    // Check if this is the first mount (refs are undefined)
    // This is the most reliable indicator - refs are only undefined on true first mount
    const isFirstMount = prevTranscriptionOptionsRef.current === undefined;
    
    // Issue #357: Only re-initialize on first mount or when dependencies actually change
    // Do NOT use isReady state as a condition - isReady can be false during cleanup/reconnection
    // without requiring re-initialization. Re-initialization should only happen when:
    // 1. First mount (refs are undefined)
    // 2. Dependencies actually changed (detected via deep comparison)
    const currentState = stateRef.current;
    
    // Debug: Log initialization decision
    if (props.debug) {
      console.log('🔧 [Component] Initialization check', {
        isFirstMount,
        isReady: currentState.isReady,
        isMounted: isMountedRef.current,
        mountId: mountIdRef.current
      });
    }
    
    // Deep comparison check: Only re-initialize if dependencies actually changed
    // This prevents unnecessary re-initialization when parent re-renders with
    // new object references but same content (Issue #276)
    // On first mount, always initialize (needsInitialization = true)
    
    const transcriptionOptionsChanged = hasDependencyChanged(
      prevTranscriptionOptionsRef.current,
      transcriptionOptions,
      isFirstMount
    );
    const agentOptionsChanged = hasDependencyChanged(
      prevAgentOptionsRef.current as Record<string, unknown> | undefined,
      agentOptions as Record<string, unknown>,
      isFirstMount,
      compareAgentOptionsIgnoringContext
    );
    const endpointConfigChanged = hasDependencyChanged(
      prevEndpointConfigRef.current,
      endpointConfig,
      isFirstMount
    );
    const apiKeyChanged = isFirstMount || prevApiKeyRef.current !== apiKey;
    const debugChanged = isFirstMount || prevDebugRef.current !== props.debug;
    
    // Determine if we need to initialize
    // Only initialize on first mount OR when dependencies actually changed
    const needsInitialization = isFirstMount || 
        transcriptionOptionsChanged || 
        agentOptionsChanged || 
        endpointConfigChanged || 
        apiKeyChanged || 
        debugChanged;
    
    // If nothing actually changed (and not first mount), skip re-initialization
    if (!needsInitialization) {
      // Update refs to current values (in case they're new references with same content)
      prevTranscriptionOptionsRef.current = transcriptionOptions;
      prevAgentOptionsRef.current = agentOptions;
      prevEndpointConfigRef.current = endpointConfig;
      prevApiKeyRef.current = apiKey;
      prevDebugRef.current = props.debug;
      if (props.debug) {
        console.log('🔧 [Component] Skipping re-initialization - dependencies unchanged');
      }
      return; // Skip re-initialization
    }
    
    if (props.debug) {
      console.log('🔧 [Component] Proceeding with initialization', {
        isFirstMount,
        needsInitialization,
        isReady: currentState.isReady,
        transcriptionOptionsChanged,
        agentOptionsChanged,
        endpointConfigChanged,
        apiKeyChanged,
        debugChanged,
        reason: isFirstMount ? 'first mount' : 
                (transcriptionOptionsChanged ? 'transcriptionOptions changed' :
                (agentOptionsChanged ? 'agentOptions changed' :
                (endpointConfigChanged ? 'endpointConfig changed' :
                (apiKeyChanged ? 'apiKey changed' :
                (debugChanged ? 'debug changed' : 'unknown')))))
      });
    }
    
    // Update refs with new values before proceeding with initialization
    prevTranscriptionOptionsRef.current = transcriptionOptions;
    prevAgentOptionsRef.current = agentOptions;
    prevEndpointConfigRef.current = endpointConfig;
    prevApiKeyRef.current = apiKey;
    prevDebugRef.current = props.debug;
    
    // Mark as mounted and generate new mount ID for this effect run
    // This helps us detect StrictMode double-invocation
    const currentMountId = `${Date.now()}-${Math.random()}`;
    const previousMountId = mountIdRef.current;
    mountIdRef.current = currentMountId;
    isMountedRef.current = true;
    
    // Initialize connection type ref for first connection
    isNewConnectionRef.current = true;
    
    // Check if we're in a CI environment or package import context
    const isCIEnvironment = typeof process !== 'undefined' && (process.env.CI === 'true' || process.env.NODE_ENV === 'test');
    const isPackageImport = typeof window === 'undefined' || !window.document;
    
    // Determine which services are being configured
    const isTranscriptionConfigured = !!transcriptionOptions;
    const isAgentConfigured = !!agentOptions;
    
    // Validate connection configuration - must have either apiKey or proxyEndpoint
    if (!apiKey && !proxyEndpoint) {
      // In CI or package import context, just log a warning instead of erroring
      if (isCIEnvironment || isPackageImport) {
        if (props.debug) {
          console.log('⚠️ [DeepgramVoiceInteraction] No API key or proxy endpoint provided in CI/import context - component will not initialize');
        }
        return;
      }
      
      // Use helper for consistent error handling
      validateConnectionConfig('agent');
      return;
    }

    // Development warning for non-memoized options
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      warnAboutNonMemoizedOptions('agentOptions', agentOptions);
      warnAboutNonMemoizedOptions('transcriptionOptions', transcriptionOptions);
    }
    
    // Consolidated initialization log - single entry point
    const services = [];
    if (isTranscriptionConfigured) services.push('transcription');
    if (isAgentConfigured) services.push('agent');
    const servicesStr = services.length > 0 ? services.join(' + ') : 'none';
    
    if (debug) {
      console.log('🔧 [Component] DeepgramVoiceInteraction initialized', {
        services: servicesStr,
        mountId: currentMountId,
        instanceId: componentInstanceIdRef.current,
        isStrictModeReInvoke: previousMountId !== '0' && previousMountId !== currentMountId,
        isFirstMount,
        reason: isFirstMount ? 'first mount' : 
                (transcriptionOptionsChanged ? 'transcriptionOptions changed' :
                (agentOptionsChanged ? 'agentOptions changed' :
                (endpointConfigChanged ? 'endpointConfig changed' :
                (apiKeyChanged ? 'apiKey changed' :
                (debugChanged ? 'debug changed' : 'unknown')))))
      });
    }
    
    // Detailed debug logging (only when debug prop is true)
    if (props.debug) {
      console.log('🔧 [INIT] Service configuration details:', {
        transcriptionOptions,
        agentOptions,
        isTranscriptionConfigured,
        isAgentConfigured,
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        proxyEndpointPresent: !!proxyEndpoint,
        connectionMode: connectionMode,
        endpointConfig
      });
    }
    
    if (!isTranscriptionConfigured && !isAgentConfigured) {
      // In CI or package import context, just log a warning instead of erroring
      if (isCIEnvironment || isPackageImport) {
        if (props.debug) {
          console.log('⚠️ [DeepgramVoiceInteraction] No services configured in CI/import context - component will not initialize');
        }
        return;
      }
      
      if (props.debug) {
        log('No services configured! Either transcriptionOptions or agentOptions must be provided.');
      }
      handleError({
        service: 'transcription',
        code: 'invalid_configuration',
        message: 'Either transcriptionOptions or agentOptions must be provided',
      });
      return;
    }
    
    // Detailed service configuration logs (debug only)
    if (props.debug) {
      if (isTranscriptionConfigured && isAgentConfigured) {
        log('Transcription and agent services are configured (managers will be created on demand)');
      } else if (isTranscriptionConfigured) {
        log('Transcription service is configured (manager will be created on demand)');
      } else {
        log('Transcription service not configured, skipping setup');
      }

      if (isAgentConfigured) {
        log('Agent service is configured (manager will be created on demand)');
      } else {
        log('Agent service not configured, skipping setup');
      }

      const needsAudioManager = isTranscriptionConfigured || (isAgentConfigured && agentOptions?.voice);
      if (needsAudioManager) {
        log('Audio manager will be created lazily when audio access is requested');
      } else {
        log('AudioManager not needed for this configuration, skipping setup');
      }
    }
    
    // Component is ready immediately when configured - AudioManager is not a prerequisite
    // The component can accept text interactions and manual connections without audio
    dispatch({ type: 'READY_STATE_CHANGE', isReady: true });

    // Clean up
    return () => {
      // Capture the mount ID at cleanup time
      const cleanupMountId = mountIdRef.current;
      
      // Debug: Log cleanup to understand when it runs
      if (props.debug) {
        const stack = new Error().stack;
        console.log('🔧 [Component] useEffect cleanup running', {
          mountId: cleanupMountId,
          transcriptionManagerExists: !!transcriptionManagerRef.current,
          agentManagerExists: !!agentManagerRef.current,
          isMounted: isMountedRef.current
        });
        console.log('🔧 [Component] Cleanup stack trace:', stack?.split('\n').slice(2, 6).join('\n'));
      }
      
      // Check if this is a StrictMode cleanup (component will immediately re-mount)
      // We delay checking re-mount to see if StrictMode re-invokes the effect
      // IMPORTANT: Don't set isMountedRef.current = false here - let the setTimeout check first
      
      // Clear any existing cleanup timeout to prevent multiple timeouts
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
      
      cleanupTimeoutRef.current = setTimeout(() => {
        // Clear the ref since timeout completed
        cleanupTimeoutRef.current = null;
        
        // If component re-mounted quickly (within delay), this was likely StrictMode
        // In that case, don't close connections as they'll be needed for the re-mounted component
        if (isMountedRef.current) {
          if (props.debug) {
            console.log('🔧 [Component] Cleanup detected StrictMode re-invocation - preserving connections and state');
          }
          return; // Component re-mounted, don't close connections or reset state
        }
        
        // Component is truly unmounting - close connections
        if (props.debug) {
          console.log('🔧 [Component] Component truly unmounting - closing connections');
        }
        
        // Mark as unmounted only after confirming it's a true unmount
        isMountedRef.current = false;
        
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
        
        // Reset state only on true unmount
        dispatch({ type: 'READY_STATE_CHANGE', isReady: false });
        dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'transcription', state: 'closed' });
        dispatch({ type: 'CONNECTION_STATE_CHANGE', service: 'agent', state: 'closed' });
        dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
        dispatch({ type: 'RECORDING_STATE_CHANGE', isRecording: false });
        dispatch({ type: 'PLAYBACK_STATE_CHANGE', isPlaying: false });
      }, STRICT_MODE_REMOUNT_DETECTION_DELAY_MS);
      
      // Note: The timeout is cleared when this cleanup function runs again
      // (on next effect run or component unmount) via the check at line 920-923
    };
  }, [apiKey, transcriptionOptions, agentOptions, endpointConfig, props.debug]); 

  // Re-send Settings when agentOptions changes and connection is already established
  // This fixes the issue where agentOptions.functions are added after initial connection
  // Use a ref to track previous agentOptions to detect actual changes
  const prevAgentOptionsForResendRef = useRef<typeof agentOptions>(undefined);
  
  useEffect(() => {
    // Issue #311: Entry point logging to verify useEffect is running
    const shouldLogDiagnostics = props.debug || windowWithGlobals.__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
    if (shouldLogDiagnostics) {
      console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] Entry point - useEffect triggered', {
        agentOptionsRef: agentOptions !== undefined ? 'exists' : 'undefined',
        prevAgentOptionsRef: prevAgentOptionsForResendRef.current !== undefined ? 'exists' : 'undefined',
        isFirstRender: prevAgentOptionsForResendRef.current === undefined
      });
    }
    
    // Skip on first render (prevAgentOptionsForResendRef is undefined)
    if (prevAgentOptionsForResendRef.current === undefined) {
      prevAgentOptionsForResendRef.current = agentOptions;
      if (shouldLogDiagnostics) {
        console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] First render - skipping change detection');
      }
      return;
    }
    
    // Issue #311: Log the actual values being compared for debugging
    if (shouldLogDiagnostics) {
      const prevOptions = prevAgentOptionsForResendRef.current as AgentOptions | undefined;
      const currentOptions = agentOptions as AgentOptions | undefined;
      console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] Comparing values:', {
        prevHasFunctions: !!(prevOptions?.functions),
        prevFunctionsCount: Array.isArray(prevOptions?.functions) 
          ? prevOptions?.functions.length 
          : 0,
        currentHasFunctions: !!(currentOptions?.functions),
        currentFunctionsCount: Array.isArray(currentOptions?.functions) 
          ? currentOptions?.functions.length 
          : 0,
        prevKeys: prevOptions ? Object.keys(prevOptions).filter(k => k !== 'context') : [],
        currentKeys: currentOptions ? Object.keys(currentOptions).filter(k => k !== 'context') : [],
      });
    }
    
    // Check if agentOptions actually changed using deep comparison
    const agentOptionsChanged = hasDependencyChanged(
      prevAgentOptionsForResendRef.current as Record<string, unknown> | undefined,
      agentOptions as Record<string, unknown>,
      false, // not first mount
      compareAgentOptionsIgnoringContext
    );
    
    // Update ref for next comparison
    prevAgentOptionsForResendRef.current = agentOptions;
    
    // Issue #311: Diagnostic logging to help identify why re-send might not trigger
    // shouldLogDiagnostics already computed above at entry point
    if (shouldLogDiagnostics) {
      const connectionState = agentManagerRef.current?.getState();
      const isConnected = connectionState === 'connected';
      const hasSentSettingsBefore = hasSentSettingsRef.current || windowWithGlobals.globalSettingsSent;
      
      // Use console.log directly for diagnostic logs (not log() which requires props.debug)
      console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions Change] Diagnostic:', {
        agentOptionsChanged,
        agentOptionsExists: !!agentOptions,
        agentManagerExists: !!agentManagerRef.current,
        connectionState,
        isConnected,
        hasSentSettingsBefore,
        hasSentSettingsRef: hasSentSettingsRef.current,
        globalSettingsSent: windowWithGlobals.globalSettingsSent,
        willReSend: agentOptionsChanged && agentOptions && agentManagerRef.current && isConnected && hasSentSettingsBefore
      });
    }
    
    // Only re-send if:
    // 1. agentOptions actually changed
    // 2. agentOptions exists (agent is configured)
    // 3. Connection is already established
    // 4. Settings have been sent before (so we know we need to update)
    
    // Issue #311: Fix timing issue - agentManagerRef.current might be null if main useEffect
    // cleanup ran first. If agentOptions changed and we should have a manager, wait briefly
    // for it to be recreated by the main useEffect, then retry.
    if (agentOptionsChanged && agentOptions) {
      // If manager doesn't exist, this might be a timing issue where cleanup ran first.
      // Wait briefly for main useEffect to recreate the manager, then retry.
      if (!agentManagerRef.current) {
        const currentState = stateRef.current;
        // Only retry if component is ready (manager should exist)
        if (currentState.isReady) {
          if (shouldLogDiagnostics) {
            console.log('[DeepgramVoiceInteraction] ⚠️ [agentOptions Change] agentManager is null, waiting for re-initialization...');
          }
          
          // Clear any existing timeout before creating a new one
          if (agentOptionsResendTimeoutRef.current) {
            clearTimeout(agentOptionsResendTimeoutRef.current);
            agentOptionsResendTimeoutRef.current = null;
          }
          
          // Use setTimeout to defer the re-send, allowing main useEffect to recreate manager
          agentOptionsResendTimeoutRef.current = setTimeout(() => {
            // Clear the ref since timeout executed
            agentOptionsResendTimeoutRef.current = null;
            
            // Check again after delay
            // Issue #311: Use agentOptionsRef.current instead of closure variable agentOptions
            // to ensure we always use the latest value, even if agentOptions changed again
            // before the timeout fired. The separate useEffect (lines 1168-1170) keeps
            // agentOptionsRef.current up-to-date whenever agentOptions changes.
            if (agentManagerRef.current && agentOptionsRef.current) {
              const connectionState = agentManagerRef.current.getState();
              const isConnected = connectionState === 'connected';
              const hasSentSettingsBefore = hasSentSettingsRef.current || windowWithGlobals.globalSettingsSent;
              
              if (isConnected && hasSentSettingsBefore) {
                // Issue #399: Do NOT re-send Settings after they have been sent for this connection.
                // Re-sending causes the server to respond with SETTINGS_ALREADY_APPLIED and close the connection.
                // Settings are sent only once per connection.
                if (props.debug) {
                  log('agentOptions changed while connected - skipping re-send (Issue #399: send Settings only once per connection)');
                }
              } else if (shouldLogDiagnostics) {
                console.log('[DeepgramVoiceInteraction] ⚠️ [agentOptions Change] Re-send still blocked after delay:', {
                  isConnected,
                  hasSentSettingsBefore,
                  agentManagerExists: !!agentManagerRef.current
                });
              }
            } else if (shouldLogDiagnostics) {
              console.log('[DeepgramVoiceInteraction] ⚠️ [agentOptions Change] agentManager still null after delay');
            }
          }, 100); // Small delay to allow main useEffect to recreate manager
          
          // Return early with cleanup function - we'll retry after the delay
          // CRITICAL: Return cleanup function BEFORE early return to ensure it's always registered
          // This prevents memory leaks if effect re-runs or component unmounts before timeout fires
          return () => {
            if (agentOptionsResendTimeoutRef.current) {
              clearTimeout(agentOptionsResendTimeoutRef.current);
              agentOptionsResendTimeoutRef.current = null;
            }
          };
        }
      }
    }
    
    // Clear any pending timeout if agentOptions didn't change or manager exists
    // This handles the case where agentOptions changes again before the timeout fires
    if (agentOptionsResendTimeoutRef.current) {
      clearTimeout(agentOptionsResendTimeoutRef.current);
      agentOptionsResendTimeoutRef.current = null;
    }
    
    if (agentOptionsChanged && agentOptions && agentManagerRef.current) {
      // Issue #307: Keep ref up-to-date for any future use
      agentOptionsRef.current = agentOptions;
      
      const connectionState = agentManagerRef.current.getState();
      const isConnected = connectionState === 'connected';
      const hasSentSettingsBefore = hasSentSettingsRef.current || windowWithGlobals.globalSettingsSent;
      
      if (isConnected && hasSentSettingsBefore) {
        // Issue #399: Do NOT re-send Settings after they have been sent for this connection.
        // Re-sending causes the server to respond with SETTINGS_ALREADY_APPLIED and close the connection.
        // Settings are sent only once per connection.
        if (props.debug) {
          log('agentOptions changed while connected - skipping re-send (Issue #399: send Settings only once per connection)');
        }
      } else if (shouldLogDiagnostics) {
        // Issue #311: Log why re-send was blocked (use console.log directly for diagnostics)
        console.log('[DeepgramVoiceInteraction] ⚠️ [agentOptions Change] Re-send blocked:', {
          isConnected,
          hasSentSettingsBefore,
          reason: !isConnected ? 'connection not established' : 'settings not sent before'
        });
      }
    } else if (shouldLogDiagnostics) {
      // Issue #311: Log why change detection didn't trigger re-send (use console.log directly for diagnostics)
      console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions Change] Change detection:', {
        agentOptionsChanged,
        agentOptionsExists: !!agentOptions,
        agentManagerExists: !!agentManagerRef.current
      });
    }
    
    // Cleanup function: Clear any pending timeout when effect re-runs or component unmounts
    return () => {
      if (agentOptionsResendTimeoutRef.current) {
        clearTimeout(agentOptionsResendTimeoutRef.current);
        agentOptionsResendTimeoutRef.current = null;
      }
    };
  }, [props.agentOptions, props.debug]); // Use direct prop access for reliable dependency tracking (Issue #318: destructured variables may not work correctly in minified builds)

  // Update agentOptionsRef when agentOptions changes
  // Issue #307: Fix closure issue - ensure ref always has latest value
  useEffect(() => {
    agentOptionsRef.current = agentOptions;
  }, [agentOptions]);

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
      
      // If transitioning to 'speaking', set the flag to prevent duplicate callback
      // from the playback handler (fixes Issue #251)
      if (state.agentState === 'speaking') {
        hasNotifiedSpeakingForPlaybackRef.current = true;
      }
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
    if (typeof data === 'object' && data !== null && ('alternatives' in data || ('channel' in data && typeof (data as { channel?: { alternatives?: unknown } }).channel?.alternatives !== 'undefined'))) {
      // Type guard: check if this is a transcript-like object
      const rawData = data as { 
        channel?: number | { alternatives?: Array<{ transcript?: string }> };
        alternatives?: Array<{ transcript?: string }>;
        is_final?: boolean;
        speech_final?: boolean;
      };
      
      // Extract transcript from actual API structure (channel.alternatives[0].transcript)
      const channelObj = typeof rawData.channel === 'object' ? rawData.channel : null;
      const transcript = channelObj?.alternatives?.[0]?.transcript || 
                         rawData.alternatives?.[0]?.transcript;
      
      if (transcript && transcript.trim()) {
        const isFinal = rawData.is_final ?? false;
        const speechFinal = rawData.speech_final ?? false;
        
        if (props.debug) {
          console.log(`[TRANSCRIPT] "${transcript}" ${isFinal ? '(final)' : '(interim)'}${speechFinal ? ' [SPEECH_FINAL]' : ''}`);
        }
        
        // CRITICAL FIX: Use Deepgram's recommended end-of-speech signals
        if (speechFinal === true) {
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
            // Use centralized helper for consistency (Issue #294, #302)
            transitionToThinkingState('User stopped speaking (speech_final=true)');
          }
        } else if (isFinal && !speechFinal) {
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
            // Use centralized helper for consistency (Issue #294, #302)
            transitionToThinkingState('User stopped speaking (final transcript fallback)');
          }
        } else if (!isFinal) {
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
    if (typeof data === 'object' && data !== null && 'type' in data && (data as { type?: string }).type === 'vad') {
      if (props.debug) {
        console.log('🎯 [VAD] VADEvent received in handleTranscriptionMessage:', data);
      }
    }
    
    // Debug: Log transcription messages (only in debug mode and filter out empty results)
    if (props.debug) {
      // Only log if there's meaningful content or it's a VAD event
      const hasContent = typeof data === 'object' && data !== null && (
        ('alternatives' in data && Array.isArray((data as { alternatives?: unknown[] }).alternatives) && (data as { alternatives: unknown[] }).alternatives.length > 0) ||
        ('type' in data && ['UtteranceEnd', 'vad'].includes((data as { type?: string }).type || ''))
      );
      
      if (hasContent) {
        console.log('📝 [TRANSCRIPTION] Message received:', data);
      }
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
        console.log('🔍 [DEBUG] Processing message type:', (data as { type?: string }).type);
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
      const rawTranscript = data as {
        type: string;
        channel?: number | { alternatives?: Array<{ transcript?: string }>; channel_index?: number[] };
        alternatives?: Array<{ transcript?: string }>;
        is_final?: boolean;
        speech_final?: boolean;
        channel_index?: number[];
        start?: number;
        duration?: number;
        metadata?: unknown;
      };
      
      // Extract transcript text from the actual API structure (channel.alternatives[0].transcript)
      // and add it as a top-level field for easier consumer access
      const channelObj = typeof rawTranscript.channel === 'object' ? rawTranscript.channel : null;
      const transcriptText = channelObj?.alternatives?.[0]?.transcript || 
                             rawTranscript.alternatives?.[0]?.transcript || 
                             '';
      
      // Normalize the response with a top-level transcript field
      // Preserve the nested structure for advanced use cases (cast to proper type)
      const alternatives = (channelObj?.alternatives || rawTranscript.alternatives || []) as TranscriptAlternative[];
      
      const normalizedTranscript: TranscriptResponse = {
        ...rawTranscript,
        type: 'transcript',
        transcript: transcriptText,
        // Ensure channel is properly typed (could be number or object)
        channel: typeof rawTranscript.channel === 'object' 
          ? (channelObj?.channel_index?.[0] ?? 0)
          : (rawTranscript.channel ?? 0),
        // Preserve the nested structure for advanced use cases
        alternatives,
        is_final: rawTranscript.is_final ?? false,
        speech_final: rawTranscript.speech_final ?? false,
        channel_index: rawTranscript.channel_index ?? [],
        start: rawTranscript.start ?? 0,
        duration: rawTranscript.duration ?? 0
      };
      
      onTranscriptUpdate?.(normalizedTranscript);
      return;
    }

    if (data.type === 'UtteranceEnd') {
      if (props.debug) {
        console.log('🎯 [SPEECH] UtteranceEnd message received - checking if should process');
      }
      
      // Always call onUtteranceEnd callback to provide channel and lastWordEnd data
      // even if speech_final was already received (Issue #329: test expects callback)
      const channel = Array.isArray(data.channel) ? data.channel : [0, 1];
      const lastWordEnd = typeof data.last_word_end === 'number' ? data.last_word_end : 0;
      onUtteranceEnd?.({ channel, lastWordEnd });
      
      // Always call onUserStoppedSpeaking when UtteranceEnd is received
      // even if speech_final=true was already received, because onUserStoppedSpeaking
      // might not have been called when speech_final=true was received (if isUserSpeaking was false)
      // Issue #329: Tests expect onUserStoppedSpeaking to be called when UtteranceEnd is received
      onUserStoppedSpeaking?.();
      
      // Check if speech_final was already received (per Deepgram guidelines)
      // If so, skip internal state management but still call callbacks above
      if (speechFinalReceivedRef.current) {
        if (props.debug) {
          console.log('🎯 [SPEECH] UtteranceEnd callbacks called, but skipping internal state (speech_final=true already received)');
        }
        return; // Skip internal state management, but callbacks were already called above
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
      
      // Note: onUserStoppedSpeaking was already called above (before the speech_final check)
      // This ensures it's always called when UtteranceEnd is received, even if speech_final=true
      // was already received (because onUserStoppedSpeaking might not have been called when
      // speech_final=true was received if isUserSpeaking was false)
      
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

  // Send agent settings after connection is established - only if agent is configured
  const sendAgentSettings = () => {
    // Issue #307: Use ref to access latest agentOptions value (fixes closure issue)
    const currentAgentOptions = agentOptionsRef.current;
    
    if (debug) {
      console.log('🔧 [sendAgentSettings] Called');
      console.log(`🔧 [sendAgentSettings] agentManagerRef.current: ${!!agentManagerRef.current}`);
      console.log(`🔧 [sendAgentSettings] agentOptions: ${!!currentAgentOptions}`);
      console.log(`🔧 [sendAgentSettings] agentOptions.functions: ${currentAgentOptions?.functions ? `[${currentAgentOptions.functions.length} functions]` : 'undefined'}`);
      console.log(`🔧 [sendAgentSettings] agentOptions.functions?.length: ${currentAgentOptions?.functions?.length || 0}`);
      console.log(`🔧 [sendAgentSettings] hasSentSettings: ${state.hasSentSettings}`);
      console.log(`🔧 [sendAgentSettings] hasSentSettingsRef.current: ${hasSentSettingsRef.current}`);
    }
    
    if (!agentManagerRef.current || !currentAgentOptions) {
      if (debug) {
        console.log('🔧 [sendAgentSettings] Cannot send agent settings: agent manager not initialized or agentOptions not provided');
      }
      return;
    }
    
    // Check if settings have already been sent (welcome-first behavior)
    // Use both ref and global flag to avoid stale closure issues and cross-component duplicates
    if (hasSentSettingsRef.current || windowWithGlobals.globalSettingsSent) {
      if (debug) {
        console.log('🔧 [sendAgentSettings] Settings already sent (via ref or global), skipping');
        console.log('🔧 [sendAgentSettings] hasSentSettingsRef.current:', hasSentSettingsRef.current);
        console.log('🔧 [sendAgentSettings] globalSettingsSent:', windowWithGlobals.globalSettingsSent);
      }
      return;
    }
    
    // Record when settings were sent (but don't mark as applied until SettingsApplied is received)
    settingsSentTimeRef.current = Date.now();
    
    if (debug) {
      console.log('🔧 [sendAgentSettings] Settings message sent, waiting for SettingsApplied confirmation');
    }
    
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
        language: currentAgentOptions.language || 'en',
        // Issue #299: Only include listen provider when listenModel is explicitly provided
        // This allows text-only interactions (via injectUserMessage) without triggering
        // CLIENT_MESSAGE_TIMEOUT errors
        ...(currentAgentOptions.listenModel ? {
          listen: {
            provider: {
              type: 'deepgram',
              model: currentAgentOptions.listenModel
            }
          }
        } : {}),
        think: {
          provider: {
            type: currentAgentOptions.thinkProviderType || 'open_ai',
            model: currentAgentOptions.thinkModel || 'gpt-4o-mini'
          },
          prompt: currentAgentOptions.instructions || 'You are a helpful voice assistant.',
          ...(currentAgentOptions.thinkEndpointUrl && currentAgentOptions.thinkApiKey ? {
            endpoint: {
              url: currentAgentOptions.thinkEndpointUrl,
              headers: {
                authorization: `bearer ${currentAgentOptions.thinkApiKey}`,
              },
            }
          } : {}),
          // Include functions if provided in agentOptions
          // Functions without endpoint are client-side (executed by the client)
          // Functions with endpoint are server-side (executed by the server)
          // Filter out client_side property - it's not part of Settings message per Deepgram API spec
          // Issue #307: Use currentAgentOptions from ref to avoid closure issue
          ...(currentAgentOptions.functions && currentAgentOptions.functions.length > 0 ? {
            functions: filterFunctionsForSettings(currentAgentOptions.functions)
          } : {})
        },
        // Include speak provider for TTS
        speak: {
          provider: {
            type: 'deepgram',
            model: currentAgentOptions.voice || 'aura-asteria-en'
          }
        },
        // Issue #234: Only include greeting if context is not provided or context.messages is empty
        // When context with existing messages is provided, this is a reconnection and greeting should be omitted
        // to avoid duplicate greeting on reconnection
        ...(currentAgentOptions.context?.messages && currentAgentOptions.context.messages.length > 0 
          ? {} 
          : { greeting: currentAgentOptions.greeting }),
        context: currentAgentOptions.context // Context is already in Deepgram API format
      }
    };
    
    if (debug) {
      console.log('📤 [Protocol] Sending agent settings with context (correct Deepgram API format):', { 
        conversationHistoryLength: currentAgentOptions.context?.messages?.length || 0,
        contextMessages: currentAgentOptions.context?.messages || [],
        hasSpeakProvider: 'speak' in settingsMessage.agent,
        speakModel: settingsMessage.agent.speak?.provider?.model,
        greetingIncluded: 'greeting' in settingsMessage.agent,
        greetingPreview: (settingsMessage.agent.greeting || '').slice(0, 60),
      functionsCount: currentAgentOptions.functions?.length || 0,
      functionsIncluded: !!(currentAgentOptions.functions && currentAgentOptions.functions.length > 0),
      functionsStructure: currentAgentOptions.functions?.map(f => ({
        name: f.name,
        hasDescription: !!f.description,
        hasParameters: !!f.parameters,
        hasEndpoint: !!f.endpoint
      }))
      });
    }
    
    // Log full Settings message structure for debugging (especially functions)
    // Always log when functions are present (not just in debug mode) to help diagnose SettingsApplied issues
    // Issue #307: Use currentAgentOptions from ref to avoid closure issue
    if (currentAgentOptions.functions && currentAgentOptions.functions.length > 0) {
      const settingsJson = JSON.stringify(settingsMessage, null, 2);
      const functionsJson = JSON.stringify(settingsMessage.agent.think.functions, null, 2);
      
      if (debug) {
        console.log('🔍 [SETTINGS DEBUG] Full Settings message with functions:', settingsJson);
        console.log('🔍 [SETTINGS DEBUG] Functions array structure:', functionsJson);
      }
      
      // Also expose to window for E2E testing (only in test environments)
      if (typeof window !== 'undefined' && windowWithGlobals.__DEEPGRAM_TEST_MODE__) {
        windowWithGlobals.__DEEPGRAM_LAST_SETTINGS__ = settingsMessage;
        windowWithGlobals.__DEEPGRAM_LAST_FUNCTIONS__ = settingsMessage.agent.think.functions;
      }
    } else {
      // Expose Settings to window even when functions are not present (for E2E testing)
      if (typeof window !== 'undefined' && windowWithGlobals.__DEEPGRAM_TEST_MODE__) {
        windowWithGlobals.__DEEPGRAM_LAST_SETTINGS__ = settingsMessage;
        windowWithGlobals.__DEEPGRAM_LAST_FUNCTIONS__ = undefined;
      }
      
      if (props.debug) {
        console.log('🔍 [DEBUG] Full Settings message structure:', JSON.stringify(settingsMessage, null, 2));
      }
    }
    
    // Check WebSocket state directly from manager before sending
    const wsState = agentManagerRef.current?.getReadyState() ?? null;
    
    // Only send if WebSocket is actually OPEN
    if (wsState !== 1) {
      if (debug) {
        const wsStateName = wsState === 0 ? 'CONNECTING' : 
                            wsState === 1 ? 'OPEN' : 
                            wsState === 2 ? 'CLOSING' : 
                            wsState === 3 ? 'CLOSED' : 'UNKNOWN';
        console.error('❌ [Protocol] Cannot send Settings - WebSocket not OPEN');
        console.error('❌ [Protocol] WebSocket state:', wsState, `(${wsStateName})`);
      }
      return; // Don't mark as sent if we can't actually send
    }

    // Issue #399 follow-up: Set flags BEFORE sendJSON to close race when connection state
    // handler runs multiple times (e.g. duplicate 'connected' events). Any re-entrant or
    // concurrent call to sendAgentSettings will then see flags true and skip.
    hasSentSettingsRef.current = true;
    windowWithGlobals.globalSettingsSent = true;

    const sendResult = agentManagerRef.current.sendJSON(settingsMessage);
    if (!sendResult) {
      // Send failed - reset flags so a retry or later path can send
      hasSentSettingsRef.current = false;
      windowWithGlobals.globalSettingsSent = false;
      if (debug) {
        const stateAtFail = agentManagerRef.current?.getReadyState() ?? null;
        const wsStateName = stateAtFail === 0 ? 'CONNECTING' :
                            stateAtFail === 1 ? 'OPEN' :
                            stateAtFail === 2 ? 'CLOSING' :
                            stateAtFail === 3 ? 'CLOSED' : 'UNKNOWN';
        console.error('❌ [Protocol] Settings message send FAILED (sendJSON returned false)');
        console.error('❌ [Protocol] WebSocket state at send time:', stateAtFail, `(${wsStateName})`);
      }
      return;
    }

    if (debug) {
      console.log('🔧 [sendAgentSettings] Flags set before send (Issue #399 race protection)');
    }

    // Mark settings as sent for welcome-first behavior
    dispatch({ type: 'SETTINGS_SENT', sent: true });
  };

  // Send FunctionCallResponse back to Deepgram
  const sendFunctionCallResponse = (id: string, name: string, content: string): void => {
    if (!agentManagerRef.current) {
      log('Cannot send FunctionCallResponse: agent manager not available');
      throw new Error('Agent manager not available');
    }

    const responseMessage = {
      type: 'FunctionCallResponse',
      id: id,
      name: name,
      content: content
    };

    console.log('🔧 [FUNCTION] Sending FunctionCallResponse to Deepgram:', responseMessage);
    log('Sending FunctionCallResponse to Deepgram');
    agentManagerRef.current.sendJSON(responseMessage);
  };

  // Type guard for agent messages
  const isAgentMessage = (data: unknown): data is { type: string; [key: string]: unknown } => {
    return typeof data === 'object' && data !== null && 'type' in data;
  };

  /**
   * Helper function to transition agent state to 'thinking'
   * Ensures consistent behavior across all thinking state transitions
   * Issue #294: Centralized thinking state transition logic
   * Issue #302: Maintain keepalive during thinking state for function calls
   * 
   * @param reason - Description of why the transition is happening (for logging)
   * @param maintainKeepalive - If true, keepalive is maintained during thinking state (for function calls).
   *                           If false, keepalive is disabled (for user stopped speaking).
   *                           Default: false (backward compatible)
   */
  const transitionToThinkingState = (reason: string, maintainKeepalive: boolean = false): void => {
    const currentState = stateRef.current.agentState;
    if (currentState !== 'thinking') {
      console.log(`🧠 [AGENT] ${reason} - transitioning to thinking state`);
      log(`${reason} - transitioning to thinking state`);
      sleepLog(`Dispatching AGENT_STATE_CHANGE to thinking (${reason})`);
      dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
      
      // Issue #302: Maintain keepalive during thinking state for function calls to prevent CLIENT_MESSAGE_TIMEOUT
      // Disable keepalives when agent starts thinking (user stopped speaking) - default behavior
      // Enable keepalives when agent is thinking during function call processing
      if (maintainKeepalive) {
        updateKeepaliveState(true);
        log('Keepalive maintained during thinking state (function call processing)');
      } else {
        updateKeepaliveState(false);
        log('Keepalive disabled during thinking state (user stopped speaking)');
      }
      
      // Update AgentStateService for consistency
      agentStateServiceRef.current?.handleAgentThinking();
    }
  };

  // Handle agent messages - only relevant if agent is configured
  const handleAgentMessage = (data: unknown) => {
    // Debug: Log all agent messages with type
    const messageType = typeof data === 'object' && data !== null && 'type' in data ? (data as { type?: string }).type || 'unknown' : 'unknown';
    log(`🔍 [DEBUG] Received agent message (type: ${messageType}):`, data);
    
    // Enhanced logging for FunctionCallRequest messages
    if (messageType === 'FunctionCallRequest') {
      if (configRef.current.debug) {
        console.log('🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage:', JSON.stringify(data, null, 2));
      }
    }
    
    // Special logging for Error messages when functions are configured (to debug SettingsApplied issue)
    // Issue #307: Use ref to access latest agentOptions value
    if (messageType === 'Error' && agentOptionsRef.current?.functions && agentOptionsRef.current.functions.length > 0) {
      console.error('❌ [FUNCTION DEBUG] Error received after sending Settings with functions:', JSON.stringify(data, null, 2));
    }
    
    // Don't re-enable idle timeout resets here
    // Let WebSocketManager handle meaningful message detection
    // After UtteranceEnd, only new connection should re-enable
    
    // Skip processing if agent service isn't configured
    if (!agentManagerRef.current) {
      const errorMsg = 'Received unexpected agent message but service is not configured';
      log(errorMsg, data);
      if (configRef.current.debug) {
        console.warn('🔧 [AGENT] ⚠️', errorMsg, 'Message type:', messageType, 'Data:', data);
      }
      return;
    }

    // Type guard check
    if (!isAgentMessage(data)) {
      const errorMsg = 'Invalid agent message format';
      log(errorMsg, data);
      if (configRef.current.debug) {
        console.warn('🔧 [AGENT] ⚠️', errorMsg, 'Message type:', messageType, 'Data:', data);
      }
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
      windowWithGlobals.globalSettingsSent = true;
      dispatch({ type: 'SETTINGS_SENT', sent: true });
      console.log('🎯 [SettingsApplied] Settings confirmed by Deepgram, audio data can now be processed');
      
      // Call public API callback to notify that settings have been applied
      onSettingsApplied?.();
      
      return;
    }
    
    if (data.type === 'AgentThinking') {
      console.log('🧠 [AGENT EVENT] AgentThinking received');
      transitionToThinkingState('AgentThinking message received');
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
      if (debug) {
        console.log('💬 [AGENT EVENT] ConversationText received role=', data.role);
      }
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
        
        // Note: ConversationText messages are redundant for idle timeout management.
        // User text activity should be handled via:
        // 1. injectUserMessage() - triggers InjectUserMessage which resets timeout
        // 2. onUserMessage callback - application can call handleMeaningfulActivity if needed
        // We don't reset timeout here because ConversationText is a transcript, not an activity indicator.
        
        onUserMessage?.(response);
        return;
      }
    }
    
    // Handle FunctionCallRequest from Deepgram
    if (data.type === 'FunctionCallRequest') {
      functionCallLogger.functionCallRequestReceived(data);
      log('FunctionCallRequest received from Deepgram');
      
      // Enhanced logging when debug is enabled (not just in test mode)
      if (configRef.current.debug) {
        console.log('🔧 [FUNCTION] FunctionCallRequest received from Deepgram:', JSON.stringify(data, null, 2));
      }
      
      // Type-safe extraction of function call information
      interface FunctionCallRequestMessage {
        type: 'FunctionCallRequest';
        functions?: Array<{
          id: string;
          name: string;
          arguments: string;
          client_side: boolean;
        }>;
      }
      
      const requestData = data as FunctionCallRequestMessage;
      const functions = Array.isArray(requestData.functions) ? requestData.functions : [];
      
      functionCallLogger.functionsArrayInfo(functions);
      
      if (configRef.current.debug) {
        console.log('🔧 [FUNCTION] Functions array length:', functions.length);
        console.log('🔧 [FUNCTION] onFunctionCallRequest callback available:', !!onFunctionCallRequest);
      }
      
      if (functions.length > 0) {
        // Check if any client-side functions are present
        const hasClientSideFunctions = functions.some((funcCall) => funcCall.client_side);
        
        // Transition to 'thinking' state when client-side function call is received
        // This provides immediate feedback that the agent is processing a function call
        // Issue #294: onAgentStateChange('thinking') Not Emitted for Client-Side Function Calls
        // Issue #302: Maintain keepalive during thinking state to prevent CLIENT_MESSAGE_TIMEOUT
        functionCallLogger.clientSideFunctionDetected(hasClientSideFunctions);
        if (hasClientSideFunctions) {
          transitionToThinkingState('FunctionCallRequest received', true); // Maintain keepalive during function call processing
        }
        
        // For each function call request, invoke the callback
        functions.forEach((funcCall) => {
          functionCallLogger.debug('Processing function call:', {
            id: funcCall.id,
            name: funcCall.name,
            client_side: funcCall.client_side,
            hasArguments: !!funcCall.arguments
          });
          
          if (configRef.current.debug) {
            console.log('🔧 [FUNCTION] Processing function call:', {
              id: funcCall.id,
              name: funcCall.name,
              client_side: funcCall.client_side,
              hasArguments: !!funcCall.arguments
            });
          }
          
          if (funcCall.client_side) {
            // Only invoke callback for client-side functions
            const functionCall: FunctionCallRequest = {
              id: funcCall.id,
              name: funcCall.name,
              arguments: funcCall.arguments,
              client_side: funcCall.client_side
            };
            
            functionCallLogger.callbackInvoked(functionCall, !!onFunctionCallRequest);
            
            // Enhanced logging for callback invocation
            if (configRef.current.debug) {
              console.log('🔧 [FUNCTION] About to invoke onFunctionCallRequest callback:', {
                id: functionCall.id,
                name: functionCall.name,
                hasCallback: !!onFunctionCallRequest
              });
            }
            
            // Check if callback is available before invoking
            if (!onFunctionCallRequest) {
              const errorMsg = 'onFunctionCallRequest callback is not defined. Function call will not be handled.';
              log(errorMsg);
              if (configRef.current.debug) {
                console.warn('🔧 [FUNCTION] ⚠️', errorMsg);
              }
              return; // Skip this function call if no callback
            }
            
            // Issue #373: Emit function call started event to disable idle timeout during execution
            handleFunctionCallStarted(functionCall.id);
            
            // Issue #355: Track whether response was sent to guarantee a response is always sent
            let responseSent = false;
            // Issue #373: Track whether function call completion event was emitted
            let completionEventEmitted = false;
            
            // Helper function to mark function call as completed (Issue #373)
            const markFunctionCallCompleted = (): void => {
              if (!completionEventEmitted) {
                // Only emit completion event once
                completionEventEmitted = true;
                handleFunctionCallCompleted(functionCall.id);
              }
            };
            
            // Create sendResponse callback that wraps sendFunctionCallResponse
            // Wrap it to track when it's called (Issue #355)
            const trackedSendResponse = (response: FunctionCallResponse): void => {
              responseSent = true;
              // Convert result or error to JSON string for content
              let content: string;
              if (response.error) {
                content = JSON.stringify({ error: response.error });
              } else {
                content = JSON.stringify(response.result);
              }
              
              // Call the internal sendFunctionCallResponse method
              sendFunctionCallResponse(functionCall.id, functionCall.name, content);
              // Issue #373: Mark function call as completed when response is sent
              markFunctionCallCompleted();
            };
            
            // Invoke callback with both functionCall and sendResponse
            // Issue #305: Support declarative return value pattern
            // Issue #355: Guarantee response is always sent
            try {
              if (configRef.current.debug) {
                console.log('🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...');
              }
              const result = onFunctionCallRequest(functionCall, trackedSendResponse);
              functionCallLogger.callbackResult(result !== undefined && result !== null);
              
              if (configRef.current.debug) {
                console.log('🔧 [FUNCTION] onFunctionCallRequest callback completed:', {
                  returnedValue: result !== undefined && result !== null,
                  resultType: result !== undefined && result !== null ? typeof result : 'void'
                });
              }
              
              // If callback returns a value (or Promise), use that instead of sendResponse
              if (result !== undefined && result !== null) {
                // Handle both sync and async returns
                Promise.resolve(result).then((response) => {
                  // Issue #355: Only send response if handler didn't already send one via sendResponse
                  if (!responseSent) {
                    if (response && typeof response === 'object' && 'id' in response) {
                      // Convert result or error to JSON string for content
                      let content: string;
                      if ('error' in response && response.error) {
                        content = JSON.stringify({ error: response.error });
                      } else if ('result' in response) {
                        content = JSON.stringify(response.result);
                      } else {
                        // If response is the result itself, stringify it
                        content = JSON.stringify(response);
                      }
                      
                      // Call the internal sendFunctionCallResponse method
                      sendFunctionCallResponse(functionCall.id, functionCall.name, content);
                      responseSent = true;
                      // Issue #373: Mark function call as completed when response is sent
                      markFunctionCallCompleted();
                      
                      // Mark response sent for E2E tests (Issue #305)
                      if (typeof window !== 'undefined') {
                        (window as Window & { __testFunctionCallResponseSent?: boolean }).__testFunctionCallResponseSent = true;
                      }
                    } else {
                      // Promise resolved to undefined/null or invalid value
                      // Handler didn't send response via sendResponse, send default error
                      const defaultError = 'Handler completed without sending a response';
                      log(`Function call ${functionCall.id} Promise resolved without sending response, sending default error`);
                      sendFunctionCallResponse(functionCall.id, functionCall.name, JSON.stringify({ error: defaultError }));
                      responseSent = true;
                      // Issue #373: Mark function call as completed when response is sent
                      markFunctionCallCompleted();
                      
                      // Mark response sent for E2E tests
                      if (typeof window !== 'undefined') {
                        (window as Window & { __testFunctionCallResponseSent?: boolean }).__testFunctionCallResponseSent = true;
                      }
                    }
                  }
                }).catch((error) => {
                  log('Error handling function call response:', error);
                  // Issue #355: Send error response if handler didn't already send one
                  if (!responseSent) {
                    sendFunctionCallResponse(functionCall.id, functionCall.name, JSON.stringify({ error: error.message || 'Unknown error' }));
                    responseSent = true;
                  }
                  // Issue #373: Always mark function call as completed when promise rejects
                  markFunctionCallCompleted();
                  
                  // Mark response sent even on error (for tests)
                  if (typeof window !== 'undefined') {
                    (window as Window & { __testFunctionCallResponseSent?: boolean }).__testFunctionCallResponseSent = true;
                  }
                });
              } else {
                // Issue #355: Handler returned void - check if it called sendResponse
                // If not, send default error response
                if (!responseSent) {
                  const defaultError = 'Handler completed without sending a response';
                  log(`Function call ${functionCall.id} completed without sending response, sending default error`);
                  sendFunctionCallResponse(functionCall.id, functionCall.name, JSON.stringify({ error: defaultError }));
                  responseSent = true;
                  // Issue #373: Mark function call as completed when default error response is sent
                  markFunctionCallCompleted();
                  
                  // Mark response sent for E2E tests
                  if (typeof window !== 'undefined') {
                    (window as Window & { __testFunctionCallResponseSent?: boolean }).__testFunctionCallResponseSent = true;
                  }
                }
              }
            } catch (error) {
              const errorMsg = `Error invoking onFunctionCallRequest callback: ${error instanceof Error ? error.message : 'Unknown error'}`;
              log(errorMsg, error);
              if (configRef.current.debug) {
                console.error('🔧 [FUNCTION] ❌', errorMsg, error);
              }
              // Issue #355: Send error response instead of re-throwing
              if (!responseSent) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                sendFunctionCallResponse(functionCall.id, functionCall.name, JSON.stringify({ error: errorMessage }));
                responseSent = true;
              }
              // Issue #373: Always mark function call as completed when we exit (even if response was already sent)
              markFunctionCallCompleted();
              
              // Mark response sent for E2E tests
              if (typeof window !== 'undefined') {
                (window as Window & { __testFunctionCallResponseSent?: boolean }).__testFunctionCallResponseSent = true;
              }
            }
          } else {
            console.log('🔧 [FUNCTION DEBUG] Server-side function call received (not handled by component):', funcCall.name);
            log('Server-side function call received (not handled by component):', funcCall.name);
          }
        });
      }
      
      return;
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
        windowWithGlobals.globalSettingsSent = true;
        dispatch({ type: 'SETTINGS_SENT', sent: true });
        return;
      }
      
      // Issue #365/#366: Provide clearer error message for CLIENT_MESSAGE_TIMEOUT
      // The Deepgram API error message incorrectly suggests only binary audio messages are allowed.
      // In reality, Deepgram may be expecting audio (if listenModel is provided), text (if listenModel is omitted),
      // function call responses, or any message during idle timeout scenarios.
      let finalErrorMessage = errorMessage;
      let errorDetails: unknown = data;
      
      if (errorCode === 'CLIENT_MESSAGE_TIMEOUT') {
        finalErrorMessage = 'No message was received within the timeout period. This typically occurs when a function call handler does not send a response to Deepgram.';
        // Don't preserve the misleading description in details - only preserve code/type for debugging
        errorDetails = {
          type: data.type,
          code: data.code,
          // Intentionally omit the misleading description
        };
      }
      
      handleError({
        service: 'agent',
        code: errorCode,
        message: finalErrorMessage,
        details: errorDetails,
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
      console.log('🔍 [DEBUG] Checking for VAD event type:', data.type);
    }
    if (data.type === 'vad') {
      if (props.debug) {
        console.log('🎯 [VAD] VADEvent message received:', data);
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
    if (props.debug) console.log('🎵 [AUDIO] Audio context state:', audioManagerRef.current?.getAudioContext?.()?.state);
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
      console.log('🎵 [sendAudioData] Called with data size:', data.byteLength);
      console.log('🎵 [sendAudioData] hasSentSettingsRef.current:', hasSentSettingsRef.current);
      console.log('🎵 [sendAudioData] state.hasSentSettings:', state.hasSentSettings);
      console.log('🎵 [sendAudioData] agentManagerRef.current?.getState():', agentManagerRef.current?.getState());
      console.log('🎵 [sendAudioData] transcriptionManagerRef.current?.getState():', transcriptionManagerRef.current?.getState());
    }
    
    // Send to transcription service if configured and connected
    const transcriptionState = transcriptionManagerRef.current?.getState();
      if (transcriptionState === 'connected') {
        if (props.debug) console.log('🎵 [TRANSCRIPTION] Sending audio data to transcription service for VAD events');
        transcriptionManagerRef.current.sendBinary(data);
      } else {
        if (props.debug) console.log('🎵 [TRANSCRIPTION] Transcription service not connected, state:', transcriptionState);
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
        if (props.debug) console.log('🎵 [AUDIO] Audio data sent to Deepgram agent service');
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
      // CRITICAL: Stop audio BEFORE closing connections to prevent resource leaks
      // Fix for issue #239: Ensures audio tracks are stopped before WebSocket cleanup
      if (audioManagerRef.current) {
        // Check guard: if audio is already being stopped by connection close handler, skip to prevent double-stop
        if (isStoppingAudioRef.current) {
          log('Audio already being stopped by connection close handler, skipping explicit stop()');
          // Wait briefly to allow connection close handler to complete
          await new Promise(resolve => setTimeout(resolve, 10));
          return; // Return early, audio cleanup is already in progress
        }
        
        try {
          // Set guard to prevent double-stopping if connection close handler fires concurrently
          isStoppingAudioRef.current = true;
          audioManagerRef.current.stopRecording();
          // Reset guard immediately after stopping (synchronous operation is complete)
          isStoppingAudioRef.current = false;
        } catch (error) {
          // Reset guard even on error
          isStoppingAudioRef.current = false;
          log('Error stopping recording in stop() method:', error);
          // Continue with cleanup even if stopping fails
        }
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
      
      // Wait for Settings to be sent and ideally SettingsApplied to be received
      // This ensures Settings is sent before InjectUserMessage (required by Deepgram)
      // In proxy mode, this is especially important due to additional network hops
      const settingsReady = await waitForSettings(
        hasSentSettingsRef,
        windowWithGlobals,
        agentManagerRef.current,
        log
      );
      
      // Final check - manager should still exist
      if (!agentManagerRef.current || agentManagerRef.current !== managerBeforeConnect) {
        log('⚠️ Manager was cleared or replaced after connection');
        throw new Error('Agent manager was cleared or replaced after connection');
      }
      
      const finalState = agentManagerRef.current.getState();
      const { both: settingsSent } = hasSettingsBeenSent(hasSentSettingsRef, windowWithGlobals, agentManagerRef.current);
      log('Connection established, final state:', finalState, 'Settings sent:', settingsSent);
      
      // CRITICAL: Ensure Settings is sent before InjectUserMessage (required by Deepgram)
      // If Settings hasn't been sent yet, wait a bit more
      if (!settingsReady && !settingsSent) {
        log('⚠️ Settings not sent yet, waiting additional time...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { both: settingsSentAfterWait } = hasSettingsBeenSent(hasSentSettingsRef, windowWithGlobals, agentManagerRef.current);
        if (!settingsSentAfterWait) {
          log('❌ Settings still not sent after waiting - this may cause Deepgram to reject InjectUserMessage');
          // Don't throw error - let it proceed and see if Deepgram accepts it
          // Some edge cases might not send Settings (e.g., reconnection scenarios)
        }
      }
    } else {
      log('Agent manager already connected');
      // Even if already connected, verify Settings was sent
      const { both: settingsSent } = hasSettingsBeenSent(hasSentSettingsRef, windowWithGlobals, agentManagerRef.current);
      if (!settingsSent) {
        log('⚠️ Agent already connected but Settings not sent - this may cause issues');
      }
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
    
    // FINAL CHECK: Ensure Settings is sent before InjectUserMessage (required by Deepgram)
    // This is critical - Deepgram will reject InjectUserMessage if sent before Settings
    const { both: finalSettingsReady } = hasSettingsBeenSent(hasSentSettingsRef, windowWithGlobals, agentManagerRef.current);
    
    if (!finalSettingsReady) {
      log('❌ CRITICAL: Settings not sent before InjectUserMessage - this will cause Deepgram to reject the message');
      log('   Waiting additional time for Settings to be sent...');
      // Wait one more time for Settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Final check
      const { both: finalSettingsReadyAfterWait } = hasSettingsBeenSent(hasSentSettingsRef, windowWithGlobals, agentManagerRef.current);
      
      if (!finalSettingsReadyAfterWait) {
        log('❌ CRITICAL: Settings still not sent - InjectUserMessage will likely be rejected by Deepgram');
        log('   Proceeding anyway - this may cause an error from Deepgram');
      } else {
        log('✅ Settings sent after additional wait - safe to send InjectUserMessage');
      }
    } else {
      log('✅ Settings confirmed sent - safe to send InjectUserMessage');
    }
    
    // Issue #373: Immediately transition to thinking state when user message is sent
    // This prevents idle timeout from firing during the gap between message send and agent response
    // Deepgram may not always send AgentThinking message, so we proactively enter thinking state
    transitionToThinkingState('User message sent (injectUserMessage)', false); // Don't maintain keepalive (agent will handle it)
    
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
      audioConstraints: audioConstraints, // Phase 2: Issue #243 - Pass audio constraints from props
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
          
          // Always ensure onAgentStateChange('speaking') is called when playback starts
          // This fixes Issue #251: callback may not fire if AgentStartedSpeaking arrived first
          // and React hasn't fired the useEffect yet due to batching/timing
          // Use ref to prevent duplicate callbacks in the same playback cycle
          if (onAgentStateChange && !hasNotifiedSpeakingForPlaybackRef.current) {
            console.log(`🎯 [AGENT] Ensuring onAgentStateChange('speaking') is called for playback start`);
            onAgentStateChange('speaking');
            hasNotifiedSpeakingForPlaybackRef.current = true;
          }
        }
        
        // Transition agent to idle when audio playback stops
        // Only transition if we're currently in speaking state (prevents invalid transitions)
        if (!event.isPlaying) {
          const currentState = stateRef.current.agentState;
          if (currentState === 'speaking') {
            console.log('🎯 [AGENT] Audio playback finished - transitioning agent from speaking to idle');
            sleepLog('Audio playback finished - transitioning agent to idle');
            
            // FIX: Call AgentStateService to ensure state transition is properly synchronized
            // This ensures onStateChange callback fires, which dispatches the state change
            // and triggers the useEffect that calls onAgentStateChange('idle')
            agentStateServiceRef.current?.handleAudioPlaybackChange(false);
            
            // Also dispatch directly as fallback (redundant but safe)
            dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
          } else {
            console.log(`🎯 [AGENT] Audio playback stopped but agent state is ${currentState} (not speaking) - skipping transition to idle`);
          }
          
          // Reset the notification flag when playback stops
          // This allows the callback to fire again for the next playback cycle
          hasNotifiedSpeakingForPlaybackRef.current = false;
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
      
      // Check if already recording before starting
      if (audioManagerRef.current.isRecordingActive()) {
        log('Audio capture already active, skipping startRecording');
        return;
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

  // Declarative Props Implementation (Issue #305)
  // Refs to track previous prop values to prevent duplicate actions
  const prevUserMessageRef = useRef<string | null | undefined>(undefined);
  const prevConnectionStateRef = useRef<'connected' | 'disconnected' | 'auto' | undefined>(undefined);
  const prevAutoStartAgentRef = useRef<boolean | undefined>(undefined);
  const prevAutoStartTranscriptionRef = useRef<boolean | undefined>(undefined);

  // userMessage prop - declarative text message input
  useEffect(() => {
    // Skip on first render
    if (prevUserMessageRef.current === undefined) {
      prevUserMessageRef.current = userMessage;
      return;
    }

    // Only act when userMessage changes to a non-null string
    if (userMessage !== null && userMessage !== undefined && userMessage !== prevUserMessageRef.current) {
      log('[Declarative] userMessage prop changed, sending message:', userMessage);
      injectUserMessage(userMessage)
        .then(() => {
          log('[Declarative] userMessage sent successfully');
          // Call callback to allow parent to clear the prop
          onUserMessageSent?.();
        })
        .catch(createDeclarativeErrorHandler('agent', 'user_message_failed', 'send user message'));
    }

    prevUserMessageRef.current = userMessage;
  }, [userMessage, onUserMessageSent, injectUserMessage, handleError]);

  // connectionState / autoStart props - declarative connection control
  useEffect(() => {
    const config = configRef.current;
    const isAgentConfigured = !!config.agentOptions;
    const isTranscriptionConfigured = !!config.transcriptionOptions;

    // Determine desired connection state
    let desiredState: 'connected' | 'disconnected' | null = null;

    if (connectionState !== undefined && connectionState !== 'auto') {
      // connectionState prop takes precedence
      desiredState = connectionState === 'connected' ? 'connected' : 'disconnected';
    } else if (connectionState === 'auto' || connectionState === undefined) {
      // Use autoStart props
      const shouldConnectAgent = autoStartAgent === true && isAgentConfigured;
      const shouldConnectTranscription = autoStartTranscription === true && isTranscriptionConfigured;
      
      if (shouldConnectAgent || shouldConnectTranscription) {
        desiredState = 'connected';
      } else {
        // Only disconnect if we explicitly set autoStart to false
        if (autoStartAgent === false && autoStartTranscription === false) {
          desiredState = 'disconnected';
        }
      }
    }

    // Check if state actually changed
    const currentAgentState = agentManagerRef.current?.getState();
    const currentTranscriptionState = transcriptionManagerRef.current?.getState();
    const isCurrentlyConnected = 
      (isAgentConfigured && currentAgentState === 'connected') ||
      (isTranscriptionConfigured && currentTranscriptionState === 'connected');

    // Only act if desired state differs from current state
    if (desiredState === 'connected' && !isCurrentlyConnected) {
      log('[Declarative] connectionState/autoStart prop indicates connection needed');
      start({
        agent: autoStartAgent !== false && isAgentConfigured,
        transcription: autoStartTranscription !== false && isTranscriptionConfigured,
      }).catch(createDeclarativeErrorHandler('agent', 'connection_start_failed', 'start connection'));
    } else if (desiredState === 'disconnected' && isCurrentlyConnected) {
      log('[Declarative] connectionState prop indicates disconnection needed');
      stop().catch(createDeclarativeErrorHandler('agent', 'connection_stop_failed', 'stop connection'));
    }

    prevConnectionStateRef.current = connectionState;
    prevAutoStartAgentRef.current = autoStartAgent;
    prevAutoStartTranscriptionRef.current = autoStartTranscription;
  }, [connectionState, autoStartAgent, autoStartTranscription, agentOptions, transcriptionOptions, start, stop, handleError]);

  // Store callback in ref to avoid dependency issues
  const onAgentInterruptedRef = useCallbackRef(onAgentInterrupted);

  // interruptAgent prop - declarative TTS interruption
  useBooleanDeclarativeProp(
    interruptAgentProp,
    () => {
      log('[Declarative] interruptAgent prop set to true, interrupting TTS');
      // Call the interruptAgent function (defined above, before this useEffect)
      // Note: interruptAgent() may return early if agentManager doesn't exist,
      // but we still call the callback to indicate the prop change was processed
      interruptAgent();
    },
    undefined, // No onFalse handler
    () => {
      // Call callback to allow parent to clear the flag
      // This callback should be called regardless of whether interruptAgent() succeeded
      // because it indicates the declarative prop change was processed
      onAgentInterruptedRef.current?.();
    }
  );

  // startAudioCapture prop - declarative microphone control
  useBooleanDeclarativeProp(
    startAudioCaptureProp,
    () => {
      const isCurrentlyRecording = audioManagerRef.current?.isRecordingActive() || false;
      if (isCurrentlyRecording) {
        log('[Declarative] Audio capture already active, skipping startRecording');
        return;
      }
      log('[Declarative] startAudioCapture prop set to true, starting audio capture');
      return startAudioCapture().catch(
        createDeclarativeErrorHandler('transcription', 'audio_capture_start_failed', 'start audio capture')
      );
    },
    () => {
      const isCurrentlyRecording = audioManagerRef.current?.isRecordingActive() || false;
      if (!isCurrentlyRecording) {
        log('[Declarative] Audio capture not active, skipping stopRecording');
        return;
      }
      log('[Declarative] startAudioCapture prop set to false, stopping audio capture');
      if (audioManagerRef.current) {
        try {
          audioManagerRef.current.stopRecording();
          log('[Declarative] Audio capture stopped successfully');
        } catch (error) {
          createDeclarativeErrorHandler('transcription', 'audio_capture_stop_failed', 'stop audio capture')(error);
        }
      }
    },
    undefined, // No onComplete
    true, // skipFirstRender
    true // allowUndefinedToTrue - allows action when prop changes from undefined to true
  );

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
    
    // Function calling
    sendFunctionCallResponse,
    
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
