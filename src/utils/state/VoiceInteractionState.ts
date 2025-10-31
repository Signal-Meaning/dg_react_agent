import { AgentState, ConnectionState, ServiceType } from '../../types';

/**
 * State of the voice interaction component
 */
export interface VoiceInteractionState {
  /**
   * Connection states for each service
   */
  connections: Record<ServiceType, ConnectionState>;
  
  /**
   * Current state of the agent
   */
  agentState: AgentState;
  
  /**
   * Microphone permission status
   */
  microphonePermission: 'granted' | 'denied' | 'prompt';
  
  /**
   * Whether audio recording is active
   */
  isRecording: boolean;
  
  /**
   * Whether audio playback is active
   */
  isPlaying: boolean;
  
  /**
   * Overall ready state of the component
   */
  isReady: boolean;
  
  /**
   * Error state
   */
  error: string | null;
  
  /**
   * Whether settings have been sent to the agent
   */
  hasSentSettings: boolean;
  
  /**
   * Whether welcome message has been received
   */
  welcomeReceived: boolean;
  
  /**
   * Whether greeting is currently in progress
   */
  greetingInProgress: boolean;
  
  /**
   * Whether greeting has started
   */
  greetingStarted: boolean;
  
  /**
   * Connection session tracking
   */
  isNewConnection: boolean;
  hasEstablishedSession: boolean;
  

  /**
   * VAD (Voice Activity Detection) state properties
   */
  /**
   * Current user speaking status
   */
  isUserSpeaking: boolean;
  
  /**
   * Timestamp of last user speech activity
   */
  lastUserSpeechTime: number | null;
  
  /**
   * Duration of current speech session
   */
  currentSpeechDuration: number | null;

  /**
   * UtteranceEnd data from Deepgram
   */
  utteranceEndData?: {
    channel: number[];
    lastWordEnd: number;
  };

  /**
   * Flag to track if agent is waiting for completion after AgentAudioDone
   */
  agentWaitingForCompletion: boolean;
}

/**
 * Events that can change the state
 */
export type StateEvent =
  | { type: 'CONNECTION_STATE_CHANGE'; service: ServiceType; state: ConnectionState }
  | { type: 'AGENT_STATE_CHANGE'; state: AgentState }
  | { type: 'MICROPHONE_PERMISSION_CHANGE'; status: 'granted' | 'denied' | 'prompt' }
  | { type: 'RECORDING_STATE_CHANGE'; isRecording: boolean }
  | { type: 'PLAYBACK_STATE_CHANGE'; isPlaying: boolean }
  | { type: 'READY_STATE_CHANGE'; isReady: boolean }
  | { type: 'ERROR'; message: string | null }
  | { type: 'SETTINGS_SENT'; sent: boolean }
  | { type: 'WELCOME_RECEIVED'; received: boolean }
  | { type: 'GREETING_PROGRESS_CHANGE'; inProgress: boolean }
  | { type: 'GREETING_STARTED'; started: boolean }
  | { type: 'CONNECTION_TYPE_CHANGE'; isNew: boolean }
  | { type: 'SESSION_ESTABLISHED'; established: boolean }
  | { type: 'RESET_GREETING_STATE' }
  | { type: 'USER_SPEAKING_STATE_CHANGE'; isSpeaking: boolean }
  | { type: 'UTTERANCE_END'; data: { channel: number[]; lastWordEnd: number } }
  | { type: 'UPDATE_SPEECH_DURATION'; duration: number }
  | { type: 'RESET_SPEECH_TIMER' };

/**
 * Initial state
 */
export const initialState: VoiceInteractionState = {
  connections: {
    transcription: 'closed',
    agent: 'closed',
  },
  agentState: 'idle',
  microphonePermission: 'prompt',
  isRecording: false,
  isPlaying: false,
  isReady: false,
  error: null,
  hasSentSettings: false,
  welcomeReceived: false,
  greetingInProgress: false,
  greetingStarted: false,
  isNewConnection: true,
  hasEstablishedSession: false,
  
  // VAD state properties
  isUserSpeaking: false,
  lastUserSpeechTime: null,
  currentSpeechDuration: null,
  
  // Agent completion tracking
  agentWaitingForCompletion: false,
};

/**
 * Reducer function to update state based on events
 */
export function stateReducer(state: VoiceInteractionState, event: StateEvent): VoiceInteractionState {
  switch (event.type) {
    case 'CONNECTION_STATE_CHANGE':
      return {
        ...state,
        connections: {
          ...state.connections,
          [event.service]: event.state,
        },
        // Auto-clear error if connection becomes successful
        error: event.state === 'connected' ? null : state.error,
      };
      
    case 'AGENT_STATE_CHANGE':
      return {
        ...state,
        agentState: event.state,
      };
      
    case 'MICROPHONE_PERMISSION_CHANGE':
      return {
        ...state,
        microphonePermission: event.status,
      };
      
    case 'RECORDING_STATE_CHANGE':
      return {
        ...state,
        isRecording: event.isRecording,
      };
      
    case 'PLAYBACK_STATE_CHANGE':
      return {
        ...state,
        isPlaying: event.isPlaying,
      };
      
    case 'READY_STATE_CHANGE':
      return {
        ...state,
        isReady: event.isReady,
      };
      
    case 'ERROR':
      return {
        ...state,
        error: event.message,
      };

    case 'SETTINGS_SENT':
      return {
        ...state,
        hasSentSettings: event.sent,
      };

    case 'WELCOME_RECEIVED':
      return {
        ...state,
        welcomeReceived: event.received,
      };

    case 'GREETING_PROGRESS_CHANGE':
      return {
        ...state,
        greetingInProgress: event.inProgress,
      };

    case 'GREETING_STARTED':
      return {
        ...state,
        greetingStarted: event.started,
      };
      
    case 'CONNECTION_TYPE_CHANGE':
      return {
        ...state,
        isNewConnection: event.isNew,
      };
      
    case 'SESSION_ESTABLISHED':
      return {
        ...state,
        hasEstablishedSession: event.established,
      };
      
    case 'RESET_GREETING_STATE':
      return {
        ...state,
        welcomeReceived: false,
        greetingInProgress: false,
        greetingStarted: false,
      };
      
      
    case 'USER_SPEAKING_STATE_CHANGE':
      // Handle malformed actions gracefully
      if (typeof event.isSpeaking !== 'boolean') {
        return state;
      }
      return {
        ...state,
        isUserSpeaking: event.isSpeaking,
        lastUserSpeechTime: event.isSpeaking ? Date.now() : state.lastUserSpeechTime,
      };
      
    case 'UTTERANCE_END':
      return {
        ...state,
        isUserSpeaking: false,
        utteranceEndData: {
          channel: event.data.channel,
          lastWordEnd: event.data.lastWordEnd,
        },
      };
      
    case 'UPDATE_SPEECH_DURATION':
      return {
        ...state,
        currentSpeechDuration: event.duration,
      };
      
    case 'RESET_SPEECH_TIMER':
      return {
        ...state,
        isUserSpeaking: false,
        lastUserSpeechTime: null,
        currentSpeechDuration: null,
        utteranceEndData: undefined,
      };
      
    default:
      return state;
  }
}

/**
 * Derived state properties
 */
export const derivedStates = {
  /**
   * Checks if all services are connected
   */
  isFullyConnected: (state: VoiceInteractionState): boolean => {
    return Object.values(state.connections).every(status => status === 'connected');
  },
  
  /**
   * Checks if any service has an error
   */
  hasConnectionError: (state: VoiceInteractionState): boolean => {
    return Object.values(state.connections).some(status => status === 'error');
  },
  
  /**
   * Gets overall connection status
   */
  overallConnectionStatus: (state: VoiceInteractionState): ConnectionState => {
    if (Object.values(state.connections).some(status => status === 'error')) {
      return 'error';
    }
    
    if (Object.values(state.connections).some(status => status === 'connecting')) {
      return 'connecting';
    }
    
    if (Object.values(state.connections).every(status => status === 'connected')) {
      return 'connected';
    }
    
    return 'closed';
  },
};