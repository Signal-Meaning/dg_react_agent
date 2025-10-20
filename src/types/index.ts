/**
 * DeepgramVoiceInteraction Type Definitions
 */

// Import types only needed INTERNALLY by types defined within THIS file
// We don't need to explicitly import types just for re-exporting if using export *
// import type { AgentOptions, AgentState, AgentFunction, AgentSettingsMessage, UpdateInstructionsPayload } from './agent'; // REMOVED - Handled by export *
import type { ConnectionState, ServiceType, EndpointConfig, DeepgramError } from './connection';
import type { TranscriptionOptions, TranscriptResponse } from './transcription';
// Import AgentState specifically because DeepgramVoiceInteractionProps uses it directly
import type { AgentState, AgentOptions, UpdateInstructionsPayload, ConversationMessage } from './agent';

// Re-export all types from specific files
export * from './agent';
export * from './connection';
export * from './transcription';
export * from './voiceBot';

// Remove the conflicting explicit re-export blocks for types already covered by export *
/* // REMOVED Block
export type {
  AgentOptions,
  AgentState,
  AgentFunction,
  AgentSettingsMessage,
  UpdateInstructionsPayload
} from './agent';
*/

/* // REMOVED Block 
export type {
  ConnectionState,
  ServiceType,
  EndpointConfig,
  DeepgramError
} from './connection';
*/

/* // REMOVED Block
export type {
  TranscriptionOptions,
  TranscriptResponse
} from './transcription';
*/

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
   * Called when a keepalive message is sent (for logging purposes)
   */
  onKeepalive?: (service: ServiceType) => void;
  
  
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
   * Auto-connect dual mode behavior options
   */
  autoConnect?: boolean;

  /**
   * Whether microphone is enabled (controlled or initial state)
   */
  microphoneEnabled?: boolean;

  /**
   * Called when microphone is toggled on/off
   */
  onMicToggle?: (enabled: boolean) => void;

  /**
   * Called when dual mode connection is established and settings are sent
   */
  onConnectionReady?: () => void;

  /**
   * Called when agent starts speaking (TTS begins)
   */
  onAgentSpeaking?: () => void;

  /**
   * Called when agent finishes speaking (AgentAudioDone)
   */
  onAgentSilent?: () => void;

  /**
   * VAD (Voice Activity Detection) Event Callbacks
   */
  
  /**
   * Called when the user stops speaking (based on VAD/endpointing)
   */
  onUserStoppedSpeaking?: () => void;
  
  /**
   * Called when UtteranceEnd is detected from Deepgram's end-of-speech detection
   * Reference: https://developers.deepgram.com/docs/understanding-end-of-speech-detection
   */
  onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
  
  /**
   * Called when SpeechStarted is detected from Deepgram Transcription API
   */
  onSpeechStarted?: (data: { channel: number[]; timestamp: number }) => void;
  
  // Note: onSpeechStopped removed - SpeechStopped is not a real Deepgram event
  // Use onUtteranceEnd for speech end detection instead
  
  /**
   * Called when VAD events are received from transcription service
   */
  onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;

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
}

/**
 * Control methods for the DeepgramVoiceInteraction component
 * This interface uses UpdateInstructionsPayload
 */
export interface DeepgramVoiceInteractionHandle {
  /**
   * Start the voice interaction
   */
  start: () => Promise<void>;
  
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
   * Connect for text-only interactions (no microphone)
   */
  connectTextOnly: () => Promise<void>;
  
  /**
   * Inject a user message to the agent
   */
  injectUserMessage: (message: string) => void;

  /**
   * Toggle microphone on/off
   */
  toggleMicrophone: (enabled: boolean) => Promise<void>;
  
  /**
   * Resume conversation with text input (lazy reconnection)
   */
  resumeWithText: (text: string) => Promise<void>;
  
  /**
   * Resume conversation with audio input (lazy reconnection)
   */
  resumeWithAudio: () => Promise<void>;
  
  /**
   * Connect with conversation context (for lazy reconnection)
   */
  connectWithContext: (sessionId: string, history: ConversationMessage[], options: AgentOptions) => Promise<void>;
  
  /**
   * Manually trigger connection timeout for testing lazy reconnection
   */
  triggerTimeoutForTesting: () => void;
  
  /**
   * Get connection states for debugging (testing only)
   */
  getConnectionStates: () => {
    transcription: string;
    agent: string;
    transcriptionConnected: boolean;
    agentConnected: boolean;
  };
  
  /**
   * Get current component state for debugging (testing only)
   */
  getState: () => any;
}

// REMOVE the duplicate AgentState definition at the end of this file
/* // REMOVED Definition
export type AgentState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'entering_sleep'
  | 'sleeping';
*/ 