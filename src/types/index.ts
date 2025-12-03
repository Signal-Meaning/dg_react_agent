/**
 * DeepgramVoiceInteraction Type Definitions
 */

// Import types only needed INTERNALLY by types defined within THIS file
// We don't need to explicitly import types just for re-exporting if using export *
// import type { AgentOptions, AgentState, AgentFunction, AgentSettingsMessage, UpdateInstructionsPayload } from './agent'; // REMOVED - Handled by export *
import type { ConnectionState, ServiceType, EndpointConfig, DeepgramError } from './connection';
import type { TranscriptionOptions, TranscriptResponse } from './transcription';
// Import AgentState specifically because DeepgramVoiceInteractionProps uses it directly
import type { AgentState, AgentOptions, UpdateInstructionsPayload } from './agent';

// Re-export all types from specific files
export * from './agent';
export * from './connection';
export * from './transcription';
export * from './voiceBot';

/**
 * Audio constraints for getUserMedia
 * Used to configure echo cancellation and other audio processing features
 * 
 * Issue: #243 - Enhanced Echo Cancellation Support
 */
export interface AudioConstraints {
  /**
   * Enable echo cancellation
   * @default true
   */
  echoCancellation?: boolean;
  
  /**
   * Enable noise suppression
   * @default true
   */
  noiseSuppression?: boolean;
  
  /**
   * Enable automatic gain control
   * @default true
   */
  autoGainControl?: boolean;
  
  /**
   * Sample rate in Hz (e.g., 16000, 24000, 48000)
   * If not specified, browser default is used
   */
  sampleRate?: number;
  
  /**
   * Number of audio channels (1 = mono, 2 = stereo)
   * @default 1
   */
  channelCount?: number;
}

/**
 * LLM response format
 */
export interface LLMResponse {
  type: 'llm';
  text: string;
  metadata?: unknown;
}

/**
 * User message response format
 */
export interface UserMessageResponse {
  type: 'user';
  text: string;
  metadata?: unknown;
}

/**
 * Function call request from Deepgram agent
 */
export interface FunctionCallRequest {
  id: string;
  name: string;
  arguments: string; // JSON string of function arguments
  client_side?: boolean;
}

/**
 * Function call response to send back to Deepgram
 */
export interface FunctionCallResponse {
  id: string;
  result?: unknown; // Function execution result
  error?: string; // Error message if function failed
}

/**
 * Props for the DeepgramVoiceInteraction component
 * This interface uses AgentState, AgentOptions, etc.
 */
export interface DeepgramVoiceInteractionProps {
  /**
   * Deepgram API key
   */
  apiKey: string;
  
  /**
   * Options for the transcription service
   */
  transcriptionOptions?: TranscriptionOptions;
  
  /**
   * Options for the agent service
   */
  agentOptions?: AgentOptions; // Uses imported AgentOptions
  
  /**
   * Configuration for API endpoints
   */
  endpointConfig?: EndpointConfig;
  
  /**
   * Called when the component is ready (initialized, mic permissions, etc.)
   */
  onReady?: (isReady: boolean) => void;
  
  /**
   * Called when the connection state of either service changes
   */
  onConnectionStateChange?: (service: ServiceType, state: ConnectionState) => void;
  
  /**
   * Called when a new transcript is received
   */
  onTranscriptUpdate?: (transcriptData: TranscriptResponse) => void;
  
  /**
   * Called when the agent's state changes
   */
  onAgentStateChange?: (state: AgentState) => void; // Uses imported AgentState
  
  /**
   * Called when the agent produces text output
   */
  onAgentUtterance?: (utterance: LLMResponse) => void;
  
  /**
   * Called when a user message is received from the server (role:user in ConversationText)
   */
  onUserMessage?: (message: UserMessageResponse) => void;
  
  /**
   * Called when audio playback state changes
   */
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  
  /**
   * Called when the user starts speaking (based on VAD/endpointing)
   */
  onUserStartedSpeaking?: () => void;
  
  /**
   * Called when SettingsApplied event is received from Deepgram
   * Indicates that agent settings have been successfully applied and the connection is ready
   * for audio data processing. This replaces the need to poll internal state via getState().
   */
  onSettingsApplied?: () => void;
  
  /**
   * Called when a client-side function call is requested by the agent.
   * Client-side functions are those without an `endpoint` property in the function definition.
   * 
   * @param functionCall - The function call request from Deepgram
   * @param sendResponse - Callback to send the function call response back to Deepgram
   */
  onFunctionCallRequest?: (
    functionCall: FunctionCallRequest,
    sendResponse: (response: FunctionCallResponse) => void
  ) => void;
  
  /**
   * Called when an error occurs
   */
  onError?: (error: DeepgramError) => void;
  
  /**
   * Enable verbose logging
   */
  debug?: boolean;

  /**
   * Options for auto-sleep functionality
   */
  sleepOptions?: {
    /**
     * Enable auto-sleep after inactivity
     */
    autoSleep?: boolean;
    
    /**
     * Seconds of inactivity before auto-sleep (default: 30)
     */
    timeout?: number;
    
    /**
     * Phrases that can wake the agent from sleep
     */
    wakeWords?: string[];
  };

  /**
   * Called when agent starts speaking (TTS begins)
   */
  onAgentSpeaking?: () => void;

  /**
   * VAD (Voice Activity Detection) Event Callbacks
   */
  
  /**
   * Called when the user stops speaking (based on VAD/endpointing)
   */
  onUserStoppedSpeaking?: () => void;
  
  /**
   * Called when idle timeout active state changes (for testing/debugging)
   * Indicates whether the idle timeout timer is currently running
   */
  onIdleTimeoutActiveChange?: (isActive: boolean) => void;

  /**
   * Called when UtteranceEnd is detected from Deepgram's end-of-speech detection
   * Reference: https://developers.deepgram.com/docs/understanding-end-of-speech-detection
   */
  onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
  
  // Note: onSpeechStarted removed - SpeechStarted was from old Transcription API
  // Voice Agent API uses UserStartedSpeaking instead
  // Use onUserStartedSpeaking for speech start detection
  
  // Note: onSpeechStopped removed - SpeechStopped is not a real Deepgram event
  // Use onUtteranceEnd for speech end detection instead
  

  /**
   * VAD Configuration Options
   */
  
  /**
   * Enable UtteranceEnd detection for more reliable end-of-speech detection
   * Reference: https://developers.deepgram.com/docs/understanding-end-of-speech-detection
   * Note: Deepgram's minimum utterance_end_ms is 1000ms
   */
  utteranceEndMs?: number; // Default: 1000ms (minimum required by Deepgram)

  /**
   * Enable interim results (required for UtteranceEnd)
   */
  interimResults?: boolean; // Default: true when utteranceEndMs is set

  /**
   * Audio constraints for getUserMedia
   * Used to configure echo cancellation and other audio processing features
   * 
   * @default { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
   * 
   * Issue: #243 - Enhanced Echo Cancellation Support
   */
  audioConstraints?: AudioConstraints;
}

/**
 * Control methods for the DeepgramVoiceInteraction component
 * This interface uses UpdateInstructionsPayload
 */
export interface DeepgramVoiceInteractionHandle {
  /**
   * Start the voice interaction
   * 
   * @param options - Optional flags to control which services to start
   *   - agent: Start agent service (default: true if agentOptions prop provided)
   *   - transcription: Start transcription service (default: true if transcriptionOptions prop provided)
   * If no options provided, starts services based on which props are configured
   * 
   * ⚠️ Note: This method connects WebSocket(s) but does NOT start audio recording.
   * To start recording, call `startAudioCapture()` separately.
   */
  start: (options?: { agent?: boolean; transcription?: boolean }) => Promise<void>;
  
  /**
   * Stop the voice interaction
   */
  stop: () => Promise<void>;
  
  /**
   * Update the agent's instructions or context during an active session
   */
  updateAgentInstructions: (payload: UpdateInstructionsPayload) => void; // Uses imported UpdateInstructionsPayload
  
  /**
   * Interrupt the agent while it is speaking
   */
  interruptAgent: () => void;
  
  /**
   * Allow agent audio to play (clears block state set by interruptAgent)
   */
  allowAgent: () => void;
  
  /**
   * Put the agent to sleep
   */
  sleep: () => void;
  
  /**
   * Wake the agent from sleep
   */
  wake: () => void;
  
  /**
   * Toggle between sleep and wake states
   */
  toggleSleep: () => void;
  
  /**
   * Inject a message directly to the agent
   */
  injectAgentMessage: (message: string) => void;
  
  /**
   * Inject a user message to the agent
   * Creates agent manager lazily if needed and ensures connection is established
   */
  injectUserMessage: (message: string) => Promise<void>;

  /**
   * Start audio capture (lazy initialization)
   * 
   * This method triggers the browser's microphone permission prompt and initializes
   * the AudioManager for voice interactions. Should only be called when user explicitly
   * requests microphone access.
   */
  startAudioCapture: () => Promise<void>;
  
  /**
   * Get the AudioContext for debugging and testing
   * 
   * @returns the AudioContext instance or undefined if not available
   */
  getAudioContext: () => AudioContext | undefined;

  /**
   * Send a FunctionCallResponse back to Deepgram after executing a client-side function
   * 
   * @param id - The function call ID from the FunctionCallRequest
   * @param name - The function name
   * @param content - The function result as a JSON string
   */
  sendFunctionCallResponse: (id: string, name: string, content: string) => void;
}