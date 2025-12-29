import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import DeepgramVoiceInteraction from '../../src/components/DeepgramVoiceInteraction';
import { 
  DeepgramVoiceInteractionHandle,
  TranscriptResponse,
  LLMResponse,
  UserMessageResponse,
  AgentState,
  ConnectionState,
  ServiceType,
  DeepgramError,
  ConversationRole,
  AudioConstraints,
  FunctionCallRequest,
  FunctionCallResponse
} from '../../src/types';
import { loadInstructionsFromFile } from '../../src/utils/instructions-loader';
import { ClosureIssueTestPage } from './closure-issue-test-page';

// Type declaration for E2E test support
// Only used in test-app for E2E testing, not part of the component's public API
declare global {
  interface Window {
    deepgramRef?: React.RefObject<DeepgramVoiceInteractionHandle>;
    handleFunctionCall?: (request: FunctionCallRequest, sendResponse: (response: FunctionCallResponse) => void) => void | FunctionCallResponse | Promise<FunctionCallResponse>;
    // Test-specific window properties for E2E tests (Issue #305)
    __testUserMessage?: string | null;
    __testUserMessageSet?: boolean;
    __testConnectionState?: 'connected' | 'disconnected' | 'auto';
    __testConnectionStateSet?: boolean;
    __testAutoStartAgent?: boolean;
    __testAutoStartAgentSet?: boolean;
    __testAutoStartTranscription?: boolean;
    __testAutoStartTranscriptionSet?: boolean;
    __testInterruptAgent?: boolean;
    __testInterruptAgentSet?: boolean;
    __testStartAudioCapture?: boolean;
    __testStartAudioCaptureSet?: boolean;
    __testOnUserMessageSent?: () => void;
    __testOnAgentInterrupted?: () => void;
    __testAgentResponseReceived?: boolean;
    __testFunctionCallHandler?: (request: FunctionCallRequest, sendResponse: (response: FunctionCallResponse) => void) => void | FunctionCallResponse | Promise<FunctionCallResponse>;
    __testFunctionCallRequestReceived?: boolean;
    __testFunctionCallResponseSent?: boolean;
    __DEEPGRAM_TEST_MODE__?: boolean;
    __testSetUserMessage?: (message: string | null) => void;
    __testSetConnectionState?: (state: 'connected' | 'disconnected' | 'auto') => void;
    __testSetAutoStartAgent?: (value: boolean) => void;
    __testSetAutoStartTranscription?: (value: boolean) => void;
    __testSetInterruptAgent?: (value: boolean) => void;
    __testSetStartAudioCapture?: (value: boolean) => void;
    __testGetUserMessage?: () => string | null;
    __testGetConnectionState?: () => 'connected' | 'disconnected' | 'auto' | undefined;
    __testGetInterruptAgent?: () => boolean;
    __testGetStartAudioCapture?: () => boolean;
  }
}

// Type alias for convenience
type TestWindow = Window;

// Type for transcript history entries
type TranscriptHistoryEntry = {
  text: string;
  is_final: boolean;
  speech_final: boolean;
  timestamp: number;
};

function App() {
  // Fail-fast check for required API key
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  const projectId = import.meta.env.VITE_DEEPGRAM_PROJECT_ID;
  
  // Check for test mode override (for Playwright tests)
  const isTestMode = window.location.search.includes('test-mode=true');
  const shouldShowError = isTestMode ? 
    ((window as Window & { testApiKey?: string }).testApiKey === 'missing' || 
     (window as Window & { testApiKey?: string }).testApiKey === 'placeholder' || 
     (window as Window & { testApiKey?: string }).testApiKey === 'test-prefix') :
    (!apiKey || apiKey === 'your-deepgram-api-key-here' || apiKey === 'your_actual_deepgram_api_key_here' || apiKey.startsWith('test-') || 
     !projectId || projectId === 'your-real-project-id');

  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);
  
  // State for UI
  const [isReady, setIsReady] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptHistoryEntry[]>([]);
  const [agentResponse, setAgentResponse] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [connectionStates, setConnectionStates] = useState<Partial<Record<ServiceType, ConnectionState>>>({
    agent: 'closed',
    transcription: 'closed' // Initialize transcription state to track it properly
  });
  const [hasSentSettingsDom, setHasSentSettingsDom] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [micLoading, setMicLoading] = useState(false);
  
  // Instructions state
  const [loadedInstructions, setLoadedInstructions] = useState<string>('');
  const [instructionsLoading, setInstructionsLoading] = useState(true);
  
  // Conversation history for context management
  const [conversationHistory, setConversationHistory] = useState<Array<{
    role: ConversationRole;
    content: string;
    timestamp: number;
  }>>([]);
  
  // Auto-connect dual mode state
  const [micEnabled, setMicEnabled] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentSilent, setAgentSilent] = useState(false);
  // Greeting status indicator for E2E tests
  const [greetingSent, setGreetingSent] = useState(false);
  const hasShownGreetingRef = useRef(false);
  
  // TTS mute state
  const [ttsMuted, setTtsMuted] = useState(false);
  
  // VAD state
  const [userStartedSpeaking, setUserStartedSpeaking] = useState<string | null>(null);
  const [userStoppedSpeaking, setUserStoppedSpeaking] = useState<string | null>(null);
  const [utteranceEnd, setUtteranceEnd] = useState<string | null>(null);
  
  // Idle timeout state
  const [idleTimeoutActive, setIdleTimeoutActive] = useState<boolean>(false);
  
  // Backend proxy mode state (Issue #242)
  // Allow override via URL query params for E2E testing (same pattern as audioConstraints)
  const memoizedProxyConfig = useMemo(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const connectionModeParam = urlParams?.get('connectionMode');
    const proxyEndpointParam = urlParams?.get('proxyEndpoint');
    const proxyAuthTokenParam = urlParams?.get('proxyAuthToken');
    
    return {
      connectionMode: (connectionModeParam === 'proxy' ? 'proxy' : 'direct') as 'direct' | 'proxy',
      proxyEndpoint: proxyEndpointParam || import.meta.env.VITE_PROXY_ENDPOINT || '',
      proxyAuthToken: proxyAuthTokenParam || '',
    };
  }, []);
  
  const [connectionMode, setConnectionMode] = useState<'direct' | 'proxy'>(memoizedProxyConfig.connectionMode);
  const [proxyEndpoint, setProxyEndpoint] = useState<string>(memoizedProxyConfig.proxyEndpoint);
  const [proxyAuthToken, setProxyAuthToken] = useState<string>(memoizedProxyConfig.proxyAuthToken);
  
  // Audio constraints for echo cancellation testing (Issue #243)
  // Allow override via URL query params for E2E testing
  const memoizedAudioConstraints = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const constraintsParam = urlParams.get('audioConstraints');
    
    if (constraintsParam) {
      try {
        const parsed = JSON.parse(constraintsParam);
        console.log('🎤 [APP] Using audio constraints from URL:', parsed);
        return parsed as AudioConstraints;
      } catch (error) {
        console.warn('🎤 [APP] Failed to parse audioConstraints from URL:', error);
      }
    }
    
    // Default: return undefined to use component defaults
    return undefined;
  }, []);
  
  // Flag to prevent state override after UtteranceEnd
  const utteranceEndDetected = useRef(false);
  
  // Reset the utteranceEndDetected flag when component mounts
  // useEffect(() => {
  //   utteranceEndDetected.current = false;
  //   console.log('🔄 [TEST-APP] Component mounted - reset utteranceEndDetected flag');
  // }, []);
  
  // VAD state from Voice Agent API (UtteranceEnd)
  
  // Text input state
  const [textInput, setTextInput] = useState('');
  
  // Declarative Props State (Issue #305)
  const [declarativeUserMessage, setDeclarativeUserMessage] = useState<string | null>(null);
  const [declarativeConnectionState, setDeclarativeConnectionState] = useState<'connected' | 'disconnected' | 'auto' | undefined>(undefined);
  const [declarativeAutoStartAgent, setDeclarativeAutoStartAgent] = useState<boolean | undefined>(undefined);
  const [declarativeAutoStartTranscription, setDeclarativeAutoStartTranscription] = useState<boolean | undefined>(undefined);
  const [declarativeInterruptAgent, setDeclarativeInterruptAgent] = useState<boolean>(false);
  const [declarativeStartAudioCapture, setDeclarativeStartAudioCapture] = useState<boolean>(false);
  
  // Helper to add logs - memoized
  const addLog = useCallback((message: string) => {
    const timestampedMessage = `${new Date().toISOString().substring(11, 19)} - ${message}`;
    setLogs(prev => [...prev, timestampedMessage]);
    // Also log to console for debugging
    console.log(timestampedMessage);
    // Don't clear keepalive - let it persist in the log history
  }, []); // No dependencies, created once
  
  // Get debug state from URL or environment
  const isDebugMode = import.meta.env.VITE_DEBUG === 'true' || new URLSearchParams(window.location.search).get('debug') === 'true' || false;
  
  // Enable test mode for E2E tests (exposes Settings message to window)
  useEffect(() => {
    if (isTestMode || new URLSearchParams(window.location.search).get('test-mode') === 'true') {
      const testWindow = window as TestWindow;
      testWindow.__DEEPGRAM_TEST_MODE__ = true;
    }
  }, [isTestMode]);
  
  // Memoize options objects to prevent unnecessary re-renders/effect loops

  // Expose test utilities to window for E2E testing
  // This is only for the test-app, not part of the component's public API
  // NOTE: This is necessary for Playwright E2E tests to access component methods
  // from the browser context. In production apps, you would not expose refs to window.
  useEffect(() => {
    // Expose ref globally for E2E tests (only in test-app)
    // Type assertion is safe here because we know this is test-only code
    window.deepgramRef = deepgramRef as React.RefObject<DeepgramVoiceInteractionHandle>;
    
    // Expose declarative props setters for E2E tests (Issue #305)
    const testWindow = window as TestWindow;
    testWindow.__testSetUserMessage = (message: string | null) => {
      setDeclarativeUserMessage(message);
    };
    testWindow.__testSetConnectionState = (state: 'connected' | 'disconnected' | 'auto') => {
      setDeclarativeConnectionState(state);
    };
    testWindow.__testSetAutoStartAgent = (value: boolean) => {
      setDeclarativeAutoStartAgent(value);
    };
    testWindow.__testSetAutoStartTranscription = (value: boolean) => {
      setDeclarativeAutoStartTranscription(value);
    };
    testWindow.__testSetInterruptAgent = (value: boolean) => {
      setDeclarativeInterruptAgent(value);
    };
    testWindow.__testSetStartAudioCapture = (value: boolean) => {
      setDeclarativeStartAudioCapture(value);
    };
    
    // Expose getters for E2E tests
    testWindow.__testGetUserMessage = () => declarativeUserMessage;
    testWindow.__testGetConnectionState = () => declarativeConnectionState;
    testWindow.__testGetInterruptAgent = () => declarativeInterruptAgent;
    testWindow.__testGetStartAudioCapture = () => declarativeStartAudioCapture;
  }, [declarativeUserMessage, declarativeConnectionState, declarativeInterruptAgent, declarativeStartAudioCapture]); // Include state in deps to keep getters updated

  // Watch window.__test* variables for declarative props (Issue #305)
  // This allows E2E tests to set props via window variables
  useEffect(() => {
    const checkWindowVars = () => {
      const testWindow = window as TestWindow;
      
      // userMessage prop
      if (testWindow.__testUserMessageSet && testWindow.__testUserMessage !== undefined) {
        setDeclarativeUserMessage(testWindow.__testUserMessage);
        testWindow.__testUserMessageSet = false; // Reset flag
      }
      
      // connectionState prop
      if (testWindow.__testConnectionStateSet && testWindow.__testConnectionState !== undefined) {
        setDeclarativeConnectionState(testWindow.__testConnectionState);
        testWindow.__testConnectionStateSet = false;
      }
      
      // autoStartAgent prop
      if (testWindow.__testAutoStartAgentSet && testWindow.__testAutoStartAgent !== undefined) {
        setDeclarativeAutoStartAgent(testWindow.__testAutoStartAgent);
        testWindow.__testAutoStartAgentSet = false;
      }
      
      // autoStartTranscription prop
      if (testWindow.__testAutoStartTranscriptionSet && testWindow.__testAutoStartTranscription !== undefined) {
        setDeclarativeAutoStartTranscription(testWindow.__testAutoStartTranscription);
        testWindow.__testAutoStartTranscriptionSet = false;
      }
      
      // interruptAgent prop
      if (testWindow.__testInterruptAgentSet && testWindow.__testInterruptAgent !== undefined) {
        setDeclarativeInterruptAgent(testWindow.__testInterruptAgent);
        testWindow.__testInterruptAgentSet = false;
      }
      
      // startAudioCapture prop
      if (testWindow.__testStartAudioCaptureSet && testWindow.__testStartAudioCapture !== undefined) {
        setDeclarativeStartAudioCapture(testWindow.__testStartAudioCapture);
        testWindow.__testStartAudioCaptureSet = false;
      }
    };
    
    // Check immediately
    checkWindowVars();
    
    // Poll for changes (tests set these asynchronously)
    const interval = setInterval(checkWindowVars, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Sync micEnabled with declarativeStartAudioCapture prop (Issue #305)
  // This ensures the DOM indicator updates when the declarative prop changes
  useEffect(() => {
    setMicEnabled(declarativeStartAudioCapture);
  }, [declarativeStartAudioCapture]);

  // Load instructions using the instructions-loader utility
  const hasLoadedInstructions = useRef(false);
  useEffect(() => {
    if (hasLoadedInstructions.current) {
      // Debug log removed - this was appearing when debug mode was off
      return;
    }
    
    // Debug log removed - this was appearing when debug mode was off
    const loadInstructions = async () => {
      try {
        setInstructionsLoading(true);
        
        // Use the instructions-loader utility which handles:
        // 1. Environment variable override (VITE_DEEPGRAM_INSTRUCTIONS)
        // 2. File loading (instructions.txt)
        // 3. Graceful fallback to default instructions
        const instructions = await loadInstructionsFromFile();
        
        setLoadedInstructions(instructions);
        addLog(`Loaded instructions via loader: ${instructions.substring(0, 50)}...`);
      } catch (error) {
        console.error('Failed to load instructions:', error);
        addLog(`Failed to load instructions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Fallback to environment variable directly if loader fails
        const envInstructions = import.meta.env.VITE_DEEPGRAM_INSTRUCTIONS;
        if (envInstructions && envInstructions.trim()) {
          setLoadedInstructions(envInstructions.trim());
          addLog(`Using fallback env instructions: ${envInstructions.substring(0, 50)}...`);
        } else {
          // Final fallback to default
          const defaultInstructions = 'You are a helpful voice assistant. Keep your responses concise and informative.';
          setLoadedInstructions(defaultInstructions);
          addLog(`Using default instructions: ${defaultInstructions.substring(0, 50)}...`);
        }
      } finally {
        setInstructionsLoading(false);
        hasLoadedInstructions.current = true;
      }
    };

    loadInstructions();
  }, [addLog]); // Include addLog in dependencies

  const memoizedTranscriptionOptions = useMemo(() => {
    const interimResults = import.meta.env.VITE_TRANSCRIPTION_INTERIM_RESULTS !== 'false';
    console.log(`[TEST-APP] Transcription options - interim_results: ${interimResults} (env var: ${import.meta.env.VITE_TRANSCRIPTION_INTERIM_RESULTS || 'not set'})`);
    return {
      // Use environment variables with sensible defaults
      model: import.meta.env.VITE_TRANSCRIPTION_MODEL || 'nova-3',
      language: import.meta.env.VITE_TRANSCRIPTION_LANGUAGE || 'en-US',
      smart_format: import.meta.env.VITE_TRANSCRIPTION_SMART_FORMAT !== 'false',
      interim_results: interimResults,
      diarize: import.meta.env.VITE_TRANSCRIPTION_DIARIZE !== 'false',
      channels: parseInt(import.meta.env.VITE_TRANSCRIPTION_CHANNELS || '1'),
      vad_events: true, // Enable VAD events
      utterance_end_ms: parseInt(import.meta.env.VITE_TRANSCRIPTION_UTTERANCE_END_MS || '1000'),
      sample_rate: 16000,
      encoding: 'linear16'
    };
  }, []);

  // Track URL parameters to ensure useMemo recomputes when they change
  const urlParamsString = typeof window !== 'undefined' ? window.location.search : '';
  
  const memoizedAgentOptions = useMemo(() => {
    // Check for function calling test mode via URL parameter
    const urlParams = new URLSearchParams(urlParamsString);
    const enableFunctionCalling = urlParams.get('enable-function-calling') === 'true';
    const functionType = urlParams.get('function-type') || 'standard'; // 'standard', 'minimal', 'minimal-with-required'
    
    // Log for debugging E2E tests
    if (enableFunctionCalling) {
      console.log(`[APP] memoizedAgentOptions: enableFunctionCalling=true, functionType=${functionType}`);
    }
    
    // Define functions for function calling tests
    // Per Deepgram docs: if endpoint is not provided, function is called client-side
    // client_side property is NOT part of Settings message - it only appears in FunctionCallRequest responses
    let functions = undefined;
    
    if (enableFunctionCalling) {
      if (functionType === 'minimal') {
        // Absolute minimal function definition
        functions = [
          {
            name: 'test',
            description: 'test',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        ];
      } else if (functionType === 'minimal-with-required') {
        // Minimal function with explicit required array
        functions = [
          {
            name: 'test',
            description: 'test',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ];
      } else {
        // Standard function (default)
        functions = [
          {
            name: 'get_current_time',
            description: 'Get the current time in a specific timezone. Use this when users ask about the time, what time it is, or current time.',
            parameters: {
              type: 'object',
              properties: {
                timezone: {
                  type: 'string',
                  description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.'
                }
              }
            }
            // No endpoint = client-side function (per Deepgram API spec)
          }
        ];
      }
    }
    
    return {
      // Use environment variables with sensible defaults
      language: import.meta.env.VITE_AGENT_LANGUAGE || 'en',
      // Agent can use a different model for listening if desired, 
      // keyterms only affect the transcription service input.
      // For text-only interactions (function calling tests), omit listenModel to avoid CLIENT_MESSAGE_TIMEOUT
      // Only include listenModel if explicitly provided via env var (for voice interactions)
      ...(import.meta.env.VITE_AGENT_MODEL ? { listenModel: import.meta.env.VITE_AGENT_MODEL } : {}), 
      thinkProviderType: 'open_ai',
      // Default model is `gpt-4o-mini` but other models can be provided such as `gpt-4.1-mini`
      thinkModel: import.meta.env.VITE_AGENT_THINK_MODEL || 'gpt-4o-mini',
      // Uncomment the following lines to use custom endpoint URL and API key values for the Voice Agent `think` message
      //thinkEndpointUrl: 'https://api.openai.com/v1/chat/completions',
      //thinkApiKey: import.meta.env.VITE_THINK_API_KEY || '',
      voice: import.meta.env.VITE_AGENT_VOICE || 'aura-asteria-en',
      instructions: loadedInstructions || 'You are a helpful voice assistant. Keep your responses concise and informative.',
      greeting: import.meta.env.VITE_AGENT_GREETING || 'Hello! How can I assist you today?',
      // Include functions if function calling is enabled
      functions: functions,
      // Pass conversation history as context in Deepgram API format
      context: conversationHistory.length > 0 ? {
        messages: conversationHistory.map(message => ({
          type: "History",
          role: message.role,
          content: message.content
        }))
      } : undefined
    };
  }, [loadedInstructions, conversationHistory, urlParamsString]); // Include urlParamsString to recompute when URL params change

  // Memoize endpoint config to point to custom endpoint URLs
  const memoizedEndpointConfig = useMemo(() => ({
    agentUrl: import.meta.env.VITE_AGENT_URL || 'wss://agent.deepgram.com/v1/agent/converse',
  }), []);

  // Targeted sleep/wake logging for the App component
  const sleepLogApp = useCallback((message: string) => {
    addLog(`[SLEEP_CYCLE][APP] ${message}`);
  }, [addLog]);
  
  // Event handlers - memoized with useCallback
  const handleReady = useCallback((ready: boolean) => {
    setIsReady(ready);
    addLog(`Component is ${ready ? 'ready' : 'not ready'}`);
    // Note: Connections start lazily when needed (e.g., when microphone is activated)
  }, [addLog]); // Depends on addLog

  // Handle SettingsApplied event via callback (replaces getState() polling)
  const handleSettingsApplied = useCallback(() => {
    setHasSentSettingsDom(true);
    // Also mark greeting as sent if not already shown (fallback detection)
    if (!hasShownGreetingRef.current) {
      setGreetingSent(true);
      hasShownGreetingRef.current = true;
      addLog('Greeting marked sent (SettingsApplied received via callback)');
    }
  }, [addLog]);
  
  const handleTranscriptUpdate = useCallback((transcript: TranscriptResponse) => {
    // Use the simplified top-level transcript field (normalized by component)
    // The component extracts transcript text from channel.alternatives[0].transcript
    // and provides it at transcript.transcript for convenience
    const text = transcript.transcript;
    const isFinal = transcript.is_final;
    const speechFinal = transcript.speech_final || false;
    
    // Extract speaker ID from alternatives if available (for speaker diarization)
    const speakerId = transcript.alternatives?.[0]?.words?.[0]?.speaker;
    
    // Skip empty transcripts (can happen with early interim results)
    if (!text || text.trim().length === 0) {
      console.log(`[TRANSCRIPT-CALLBACK] Skipping empty transcript (interim result with no text yet)`);
      return;
    }
    
    console.log(`[TRANSCRIPT-CALLBACK] Received ${isFinal ? 'final' : 'interim'} transcript:`, {
      type: transcript.type,
      is_final: isFinal,
      speech_final: speechFinal,
      transcript: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      transcriptLength: text.length,
      hasAlternatives: !!transcript.alternatives,
      alternativesLength: transcript.alternatives?.length || 0,
      speakerId: speakerId !== undefined ? speakerId : 'none'
    });
    
    // At this point, text is guaranteed to be defined and non-empty
    if (text && text.trim().length > 0) {
      const displayText = speakerId !== undefined 
        ? `Speaker ${speakerId}: ${text}` 
        : text;
      
      setLastTranscript(displayText);
      
      // Log transcript to event log (and console via addLog)
      const transcriptType = transcript.is_final ? 'final' : 'interim';
      addLog(`[TRANSCRIPT] "${text}" (${transcriptType})`);
      
      // Store transcript in history for E2E testing (displayed in DOM)
      // This replaces window.__testTranscripts with a proper React state + DOM display
      const transcriptEntry: TranscriptHistoryEntry = {
        text: text,
        is_final: transcript.is_final || false,
        speech_final: 'speech_final' in transcript ? (transcript as { speech_final?: boolean }).speech_final || false : false,
        timestamp: Date.now()
      };
      
      setTranscriptHistory(prev => [...prev, transcriptEntry]);
      
      // Debug logging
      const transcriptTypeLabel = transcriptEntry.is_final 
        ? (transcriptEntry.speech_final ? 'final (speech_final)' : 'final')
        : 'interim';
      console.log(`[TRANSCRIPT-CAPTURE] Stored ${transcriptTypeLabel} transcript: "${text.substring(0, 50)}..." (is_final: ${transcriptEntry.is_final}, speech_final: ${transcriptEntry.speech_final})`);
    } else {
      // Log warning if we can't extract text from transcript
      console.warn('[TRANSCRIPT] Could not extract text from transcript:', {
        hasAlternatives: 'alternatives' in transcript,
        hasChannel: 'channel' in transcript,
        channelType: typeof (transcript as { channel?: unknown }).channel,
        keys: Object.keys(transcript)
      });
    }
  }, [addLog]); // Include addLog in dependencies
  
  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    setAgentResponse(utterance.text);
    addLog(`Agent said: ${utterance.text}`);
    // Track agent messages in conversation history
    setConversationHistory(prev => [...prev, {
      role: 'assistant',
      content: utterance.text,
      timestamp: Date.now()
    }]);
  }, [addLog]); // Depends on addLog
  
  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    setUserMessage(message.text);
    addLog(`User message from server: ${message.text}`);
    // Track user messages in conversation history
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: message.text,
      timestamp: Date.now()
    }]);
  }, [addLog]);
  
  const handleAgentStateChange = useCallback((state: AgentState) => {
    const prevState = agentState; // Capture previous state for comparison
    setAgentState(state);
    setIsSleeping(state === 'sleeping');
    addLog(`Agent state changed: ${state}`); // General log
    
    // Specific sleep cycle logging
    if (state === 'sleeping' && prevState !== 'sleeping') {
      sleepLogApp(`State changed TO sleeping.`);
    } else if (state !== 'sleeping' && prevState === 'sleeping') {
      sleepLogApp(`State changed FROM sleeping to ${state}.`);
    } else if (state === 'sleeping' && prevState === 'sleeping') {
      // This case might indicate an unnecessary update, but log it for now
      sleepLogApp(`State remained sleeping (received update).`);
    }
  }, [addLog, sleepLogApp, agentState]); // Depends on addLog, sleepLogApp, and agentState

  // Heuristic: mark greeting as sent when agent begins speaking before any user message has been sent
  useEffect(() => {
    if (hasShownGreetingRef.current) return;
    const noUserMessagesYet = conversationHistory.every(m => m.role !== 'user');
    if (agentState === 'speaking' && noUserMessagesYet) {
      setGreetingSent(true);
      hasShownGreetingRef.current = true;
      addLog('Greeting detected (heuristic): marked greeting-sent for tests');
    }
  }, [agentState, conversationHistory, addLog]);
  
  // Handler for audio playing status - now also manages agent speaking/silent state
  const handlePlaybackStateChange = useCallback((isPlaying: boolean) => {
    setIsPlaying(isPlaying);
    // Update agent speaking/silent state based on actual playback
    setAgentSpeaking(isPlaying);
    setAgentSilent(!isPlaying);
    
    // Audio playing when it should be blocked
    // If mute button is pressed (ttsMuted === true) but audio starts playing,
    // this indicates allowAgentRef blocking state was lost/reset between turns
    if (isPlaying && ttsMuted) {
      console.error('⚠️ Audio playback started while mute button is active!');
      console.error('   This indicates allowAgentRef blocking state was reset/lost between agent turns.');
      console.error('   - Mute button state: PRESSED (ttsMuted=true)');
      console.error('   - Audio playback state: PLAYING (isPlaying=true)');
      console.error('   - Expected: Audio should be blocked and NOT playing');
      addLog('⚠️ [BUG DETECTED] Audio playing while muted - Issue #223!');
    }
    
    if (isPlaying) {
      addLog('Audio playback: started');
    } else {
      addLog('Audio playback: stopped - Agent playback completed');
    }
  }, [addLog, ttsMuted]); // Include ttsMuted in dependencies
  
  const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
    setConnectionStates(prev => ({
      ...prev,
      [service]: state
    }));
    addLog(`${service} connection state: ${state}`);
    // Reset hasSentSettings mirror on agent disconnect/stop for clean reconnect assertions
    if (service === 'agent' && state === 'closed') {
      setHasSentSettingsDom(false);
    }
    // Connection states are now tracked via DOM elements (data-testid attributes)
    // Tests can read connection state directly from the DOM without callbacks
  }, [addLog]); // Depends on addLog
  
  const handleError = useCallback((error: DeepgramError) => {
    addLog(`Error (${error.service}): ${error.message}`);
    console.error('Deepgram error:', error);
  }, [addLog]); // Depends on addLog

  // VAD event handlers - clearly marked by source
  const handleUserStartedSpeaking = useCallback(() => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setUserStartedSpeaking(timestamp);
    utteranceEndDetected.current = false; // Reset flag for new speech session
    
    // Only log user speaking events in debug mode to reduce console spam
    if (isDebugMode) {
      addLog(`🎤 [AGENT] User started speaking at ${timestamp}`);
    }
  }, [addLog, isDebugMode]);

  const handleUserStoppedSpeaking = useCallback(() => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setUserStoppedSpeaking(timestamp);
    
    // Only log user stopped speaking events in debug mode to reduce console spam
    if (isDebugMode) {
      addLog(`🎤 [AGENT] User stopped speaking at ${timestamp}`);
    }
  }, [addLog, isDebugMode]);

  const handleUtteranceEnd = useCallback((data: { channel: number[]; lastWordEnd: number }) => {
    // #region debug log
    fetch('http://127.0.0.1:7244/ingest/1ac8ac92-902e-45db-8e4f-262b6d84a922',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:681',message:'handleUtteranceEnd callback called',data:{channel:data.channel,lastWordEnd:data.lastWordEnd},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const channelStr = data.channel.join(',');
    const utteranceEndText = `Channel: [${channelStr}], Last word end: ${data.lastWordEnd}s`;
    // #region debug log
    fetch('http://127.0.0.1:7244/ingest/1ac8ac92-902e-45db-8e4f-262b6d84a922',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:683',message:'Setting utteranceEnd state',data:{utteranceEndText:utteranceEndText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    setUtteranceEnd(utteranceEndText);
    utteranceEndDetected.current = true;
    
    // Only log UtteranceEnd events in debug mode to reduce console spam
    if (isDebugMode) {
      addLog(`🔚 [TRANSCRIPTION] UtteranceEnd detected`);
    }
  }, [addLog, isDebugMode]);

  const handleIdleTimeoutActiveChange = useCallback((isActive: boolean) => {
    setIdleTimeoutActive(isActive);
    if (isDebugMode) {
      addLog(`🎯 [IDLE_TIMEOUT] Timeout active: ${isActive}`);
    }
  }, [addLog, isDebugMode]);

  // Declarative props callbacks (Issue #305) - must be defined before early returns
  const handleUserMessageSent = useCallback(() => {
    setDeclarativeUserMessage(null);
    // Update window variable for tests
    const testWindow = window as TestWindow;
    testWindow.__testUserMessage = null;
    // Call test callback if provided
    if (testWindow.__testOnUserMessageSent) {
      testWindow.__testOnUserMessageSent();
    }
    // Mark response received for tests
    testWindow.__testAgentResponseReceived = true;
  }, []);

  const handleAgentInterrupted = useCallback(() => {
    setDeclarativeInterruptAgent(false);
    // Update window variable for tests
    const testWindow = window as TestWindow;
    testWindow.__testInterruptAgent = false;
    // Call test callback if provided
    if (testWindow.__testOnAgentInterrupted) {
      testWindow.__testOnAgentInterrupted();
    }
  }, []);

  // Function call request handler (Issue #305) - must be defined before early returns
  const handleFunctionCallRequest = useCallback((request: FunctionCallRequest, sendResponse: (response: FunctionCallResponse) => void) => {
    // Handle function call requests from Deepgram
    console.log('[APP] FunctionCallRequest received:', request);
    
    // Issue #305: Support declarative return value pattern
    // Check for test handler first (for E2E tests), then fallback to window.handleFunctionCall
    const testWindow = window as TestWindow;
    const handler = testWindow.__testFunctionCallHandler || testWindow.handleFunctionCall;
    
    // Mark that function call request was received (for tests)
    if (testWindow.__testFunctionCallHandler) {
      testWindow.__testFunctionCallRequestReceived = true;
    }
    
    if (handler) {
      // Call handler - it may return a value (declarative) or call sendResponse (imperative)
      const result = handler(request, sendResponse);
      // If it returns a value, that will be handled by the component
      // The component will mark __testFunctionCallResponseSent after processing
      if (result !== undefined && result !== null) {
        return result;
      } else {
        // Imperative pattern - handler called sendResponse
        // Mark response sent for tests
        testWindow.__testFunctionCallResponseSent = true;
      }
    }
  }, []);

  // Auto-connect dual mode event handlers

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    
    try {
      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      
      if (!apiKey || apiKey === 'your-deepgram-api-key-here' || apiKey === 'your_actual_deepgram_api_key_here') {
        addLog('❌ Please set VITE_DEEPGRAM_API_KEY environment variable with a valid Deepgram API key');
        return;
      }
      
      // Send text message to real Deepgram agent
      addLog(`Sending text message: ${textInput}`);
      setUserMessage(textInput);
      
      if (deepgramRef.current) {
        await deepgramRef.current.injectUserMessage(textInput);
        addLog('Text message sent to Deepgram agent');
      } else {
        addLog('Error: DeepgramVoiceInteraction ref not available');
      }
      
      setTextInput('');
    } catch (error) {
      addLog(`Error sending text message: ${(error as Error).message}`);
      console.error('Text submit error:', error);
    }
  }, [textInput, addLog]);


  const handleAgentSpeaking = useCallback(() => {
    // Note: agentSpeaking state is updated by handlePlaybackStateChange when playback actually starts
    // This callback only logs - state management is handled by onPlaybackStateChange
    addLog('Agent started speaking');
  }, [addLog]);

  // Control functions
  const startInteraction = async () => {
    try {
      await deepgramRef.current?.start();
      setIsRecording(true);
      addLog('Started interaction');
    } catch (error) {
      addLog(`Error starting: ${(error as Error).message}`);
      console.error('Start error:', error);
    }
  };
  
  const stopInteraction = async () => {
    try {
      await deepgramRef.current?.stop();
      setIsRecording(false);
      addLog('Stopped interaction');
    } catch (error) {
      addLog(`Error stopping: ${(error as Error).message}`);
      console.error('Stop error:', error);
    }
  };
  
  // (removed unused interruptAgent helper)
  
  // Toggle mute button - simple switch: click to mute, click again to unmute
  const handleMuteToggle = useCallback(() => {
    setTtsMuted(prevMuted => {
      const newMuted = !prevMuted;
      if (newMuted) {
        addLog('🔇 Agent audio blocked');
        if (deepgramRef.current) {
          deepgramRef.current.interruptAgent();
        }
      } else {
        addLog('🔊 Agent audio allowed');
        if (deepgramRef.current) {
          deepgramRef.current.allowAgent();
        }
      }
      return newMuted;
    });
  }, [addLog]);
  
  const updateContext = () => {
    // Define the possible instruction prompts
    const instructions = [
      "Talk like a pirate.",
      "Respond only in questions.",
      "Talk in Old English."
    ];
    
    // Randomly select an instruction
    const randomIndex = Math.floor(Math.random() * instructions.length);
    const selectedInstruction = instructions[randomIndex];
    
    if (deepgramRef.current) {
      deepgramRef.current.updateAgentInstructions({
        // Using 'instructions' key based on UpdateInstructionsPayload
        instructions: selectedInstruction 
      });
      addLog(`Updated agent context: ${selectedInstruction}`);
      sleepLogApp(`Sent instruction: "${selectedInstruction}"`); // Add sleep cycle log too
    } else {
      addLog('Error: Could not update context, deepgramRef is null');
    }
  };
  
  const toggleSleep = () => {
    if (deepgramRef.current) {
      sleepLogApp(`Toggle button clicked. Current app state isSleeping=${isSleeping}. Calling core toggleSleep().`);
      deepgramRef.current.toggleSleep();
      // Removed the potentially inaccurate log here, state change is handled by onAgentStateChange
    }
  };
  
  const injectMessage = () => {
    const testMessage = "This is a test message injected programmatically!";
    
    if (deepgramRef.current) {
      deepgramRef.current.injectAgentMessage(testMessage);
      addLog(`Injected message: "${testMessage}"`);
    } else {
      addLog('Error: Could not inject message, deepgramRef is null');
    }
  };

  const toggleMicrophone = async () => {
    try {
      console.log('🎤 [APP] toggleMicrophone called');
      console.log('🎤 [APP] micEnabled:', micEnabled);
      console.log('🎤 [APP] deepgramRef.current:', !!deepgramRef.current);
      
      if (!micEnabled) {
        // Enable microphone with lazy audio initialization
        setMicLoading(true);
        addLog('Starting audio capture (lazy initialization)');
        console.log('🎤 [APP] About to call startAudioCapture()');
        
        if (deepgramRef.current) {
          console.log('🎤 [APP] deepgramRef.current exists, calling startAudioCapture()');
          console.log('🎤 [APP] deepgramRef.current methods:', Object.keys(deepgramRef.current));
          
          // Always attempt to start both agent and transcription services
          // start() is safe for redundant calls - it will reuse existing connections
          // This ensures both services are available when microphone is activated
          // (VAD events and transcripts require transcription service)
          console.log('🎤 [APP] Starting both agent and transcription services...');
          addLog('Starting agent and transcription services...');
          await deepgramRef.current.start({ agent: true, transcription: true });
          console.log('🎤 [APP] Services started (or already connected)');
          
          if (typeof deepgramRef.current.startAudioCapture === 'function') {
            console.log('🎤 [APP] startAudioCapture method exists, calling it');
            await deepgramRef.current.startAudioCapture();
            console.log('🎤 [APP] startAudioCapture() completed successfully');
            addLog('Audio capture started successfully');
            
            // Update local state to reflect microphone is enabled
            setMicEnabled(true);
          } else {
            console.log('🎤 [APP] startAudioCapture method does not exist!');
            addLog('❌ [APP] startAudioCapture method not found on ref');
          }
        } else {
          console.log('🎤 [APP] deepgramRef.current is null!');
          addLog('❌ [APP] deepgramRef.current is null - cannot start audio capture');
        }
        setMicLoading(false);
      } else {
        // Disable microphone
        console.log('🎤 [APP] Disabling microphone');
        await deepgramRef.current?.stop();
        setMicEnabled(false);
        addLog('Microphone disabled');
      }
    } catch (error) {
      console.log('🎤 [APP] Error in toggleMicrophone:', error);
      addLog(`Error toggling microphone: ${(error as Error).message}`);
      console.error('Microphone toggle error:', error);
      setMicLoading(false);
    }
  };
  
  // Check if we should render the closure issue test page
  // NOTE: Must check this AFTER all hooks are called to avoid Rules of Hooks violation
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const testPage = urlParams?.get('test-page');
  
  // Render closure issue test page if requested (after all hooks are called)
  if (testPage === 'closure-issue') {
    return <ClosureIssueTestPage />;
  }
  
  // Show error if API key or project ID is missing
  if (shouldShowError) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#1a202c', 
        border: '1px solid #2d3748', 
        borderRadius: '8px',
        margin: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: '#fbb6ce', fontSize: '18px' }}>⚠️ Deepgram API Key Required</h2>
        <p style={{ margin: '0 0 15px 0' }}><strong>This test app requires a valid Deepgram API key to function:</strong></p>
        
        <p style={{ margin: '15px 0 10px 0' }}><strong>To enable Deepgram integration:</strong></p>
        <p style={{ margin: '0 0 10px 0' }}>Set the following in <code style={{ backgroundColor: '#4a5568', padding: '2px 4px', borderRadius: '3px', fontSize: '13px', color: '#e2e8f0' }}>test-app/.env</code>:</p>
        <pre style={{ 
          backgroundColor: '#2d3748', 
          padding: '15px', 
          borderRadius: '6px', 
          border: '1px solid #4a5568',
          fontSize: '13px',
          lineHeight: '1.4',
          overflow: 'auto',
          margin: '10px 0',
          color: '#e2e8f0'
        }}>
VITE_DEEPGRAM_API_KEY=your-real-deepgram-api-key
VITE_DEEPGRAM_PROJECT_ID=your-real-project-id
        </pre>
        <p style={{ margin: '15px 0 10px 0' }}>Get a free API key at: <a href="https://deepgram.com" target="_blank" style={{ color: '#63b3ed', textDecoration: 'none' }}>https://deepgram.com</a></p>
        <p style={{ margin: '0', fontStyle: 'italic', color: '#a0aec0' }}>Text messages will be sent to the Deepgram agent service when a valid API key is provided.</p>
      </div>
    );
  }
  
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      pointerEvents: 'auto' // Allow pointer events for E2E tests
    }} data-testid="voice-agent">
      <h1>Deepgram Voice Interaction Test</h1>
      
      <div data-testid="deepgram-component">
        <DeepgramVoiceInteraction
        ref={deepgramRef}
        {...(connectionMode === 'direct' 
          ? { apiKey: import.meta.env.VITE_DEEPGRAM_API_KEY || '' }
          : { 
              proxyEndpoint: proxyEndpoint || import.meta.env.VITE_PROXY_ENDPOINT,
              ...(proxyAuthToken ? { proxyAuthToken } : {})
            }
        )}
        transcriptionOptions={memoizedTranscriptionOptions}
        agentOptions={memoizedAgentOptions}
        endpointConfig={memoizedEndpointConfig}
        onReady={handleReady}
        onTranscriptUpdate={handleTranscriptUpdate}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
        onAgentStateChange={handleAgentStateChange}
        onConnectionStateChange={handleConnectionStateChange}
        onError={handleError}
        onPlaybackStateChange={handlePlaybackStateChange}
        onSettingsApplied={handleSettingsApplied}
        onFunctionCallRequest={handleFunctionCallRequest}
        // VAD event handlers
        onUserStartedSpeaking={handleUserStartedSpeaking}
        onUserStoppedSpeaking={handleUserStoppedSpeaking}
        onUtteranceEnd={handleUtteranceEnd}
        onAgentSpeaking={handleAgentSpeaking}
        onIdleTimeoutActiveChange={handleIdleTimeoutActiveChange}
        audioConstraints={memoizedAudioConstraints} // Issue #243: Echo cancellation configuration
        debug={isDebugMode} // Enable debug only when debug mode is explicitly enabled
        // Declarative Props (Issue #305)
        userMessage={declarativeUserMessage}
        onUserMessageSent={handleUserMessageSent}
        connectionState={declarativeConnectionState}
        autoStartAgent={declarativeAutoStartAgent}
        autoStartTranscription={declarativeAutoStartTranscription}
        interruptAgent={declarativeInterruptAgent}
        onAgentInterrupted={handleAgentInterrupted}
        startAudioCapture={declarativeStartAudioCapture}
        />
      </div>
      
      <div style={{ border: '1px solid blue', padding: '10px', margin: '15px 0' }}>
        <h4>Component States:</h4>
        <p>App UI State (isSleeping): <strong>{(isSleeping || agentState === 'entering_sleep').toString()}</strong></p>
        <p>Core Component State (agentState via callback): <strong data-testid="agent-state">{agentState}</strong></p>
        {/* Hidden indicator used by E2E tests to detect greeting was sent */}
        {greetingSent && <span data-testid="greeting-sent" style={{ opacity: 0 }}>true</span>}
        
        {/* API Key Status Indicator */}
        {(() => {
          const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
          const isValidApiKey = apiKey && 
            apiKey !== 'your-deepgram-api-key-here' && 
            apiKey !== 'your_actual_deepgram_api_key_here' &&
            !apiKey.startsWith('test-') && 
            apiKey.length >= 20; // Deepgram API keys are typically 20+ characters
          
          return (
            <div style={{ 
              margin: '10px 0', 
              padding: '8px', 
              backgroundColor: isValidApiKey ? '#1a4d1a' : '#4a1a1a', 
              border: `1px solid ${isValidApiKey ? '#48bb78' : '#e53e3e'}`,
              borderRadius: '4px',
              color: isValidApiKey ? '#9ae6b4' : '#feb2b2'
            }} data-testid="api-mode-indicator">
              <strong>
                {isValidApiKey ? '🟢 Valid Deepgram API Key' : '🔴 Invalid/Missing API Key'}
              </strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.9em', color: isValidApiKey ? '#9ae6b4' : '#feb2b2' }}>
                {isValidApiKey 
                  ? 'Text messages will be sent to Deepgram agent service' 
                  : 'Please set VITE_DEEPGRAM_API_KEY environment variable'
                }
              </p>
            </div>
          );
        })()}
        
        {/* Connection Mode Toggle (Issue #242) */}
        <div style={{ 
          margin: '15px 0', 
          padding: '10px', 
          border: '1px solid #4299e1', 
          borderRadius: '4px',
          backgroundColor: '#ebf8ff'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Connection Mode (Issue #242)</h4>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '15px' }}>
              <input
                type="radio"
                name="connectionMode"
                value="direct"
                checked={connectionMode === 'direct'}
                onChange={(e) => setConnectionMode(e.target.value as 'direct' | 'proxy')}
              />
              Direct (apiKey)
            </label>
            <label>
              <input
                type="radio"
                name="connectionMode"
                value="proxy"
                checked={connectionMode === 'proxy'}
                onChange={(e) => setConnectionMode(e.target.value as 'direct' | 'proxy')}
              />
              Proxy (proxyEndpoint)
            </label>
          </div>
          
          {connectionMode === 'proxy' && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Proxy Endpoint:
                </label>
                <input
                  type="text"
                  value={proxyEndpoint}
                  onChange={(e) => setProxyEndpoint(e.target.value)}
                  placeholder="ws://localhost:8080/deepgram-proxy"
                  style={{ 
                    width: '100%', 
                    padding: '5px',
                    fontFamily: 'monospace',
                    fontSize: '0.9em'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Auth Token (optional):
                </label>
                <input
                  type="text"
                  value={proxyAuthToken}
                  onChange={(e) => setProxyAuthToken(e.target.value)}
                  placeholder="JWT or session token"
                  style={{ 
                    width: '100%', 
                    padding: '5px',
                    fontFamily: 'monospace',
                    fontSize: '0.9em'
                  }}
                />
              </div>
              <p style={{ 
                marginTop: '10px', 
                fontSize: '0.85em', 
                color: '#2d3748',
                fontStyle: 'italic'
              }}>
                Current mode: <strong data-testid="connection-mode">{connectionMode}</strong>
                {connectionMode === 'proxy' && (
                  <span> → {proxyEndpoint || 'Not set'}</span>
                )}
              </p>
            </div>
          )}
        </div>
        
        <p>Audio Recording: <strong>{isRecording.toString()}</strong></p>
        <p>Audio Playing: <strong data-testid="audio-playing-status">{isPlaying.toString()}</strong></p>
        <p>Component Ready: <strong data-testid="component-ready-status">{isReady.toString()}</strong></p>
        <h4>Auto-Connect Dual Mode States:</h4>
        <div data-testid="auto-connect-states">
          <p>Microphone Enabled: <strong data-testid="mic-status">{micEnabled ? 'Enabled' : 'Disabled'}</strong></p>
          <p>Agent Speaking: <strong data-testid="agent-speaking">{agentSpeaking.toString()}</strong></p>
          <p>Agent Silent: <strong data-testid="agent-silent">{agentSilent.toString()}</strong></p>
        </div>
        
        <h4>VAD (Voice Activity Detection) States:</h4>
        <div data-testid="vad-states">
          <p>Debug - utteranceEndDetected: <strong>Removed - main component handles this</strong></p>
          
          <h5>From Agent WebSocket:</h5>
          <p>User Started Speaking: <strong data-testid="user-started-speaking">{userStartedSpeaking || 'Not detected'}</strong></p>
          <p>User Stopped Speaking: <strong data-testid="user-stopped-speaking">{userStoppedSpeaking || 'Not detected'}</strong></p>
          <p>Utterance End: <strong data-testid="utterance-end">{utteranceEnd || 'Not detected'}</strong></p>
          
          <h5>From Agent Service:</h5>
        </div>
        
        <h4>Idle Timeout State:</h4>
        <div data-testid="idle-timeout-state">
          <p>Timeout Active: <strong data-testid="idle-timeout-active">{idleTimeoutActive ? 'true' : 'false'}</strong></p>
        </div>
      </div>
      
      <div style={{ margin: '20px 0', display: 'flex', gap: '10px', alignItems: 'center', pointerEvents: 'auto' }}>
        {!isRecording ? (
          <button 
            onClick={startInteraction} 
            disabled={!isReady || isRecording}
            style={{ padding: '10px 20px', pointerEvents: 'auto' }}
            data-testid="start-button"
          >
            Start
          </button>
        ) : (
          <button 
            onClick={stopInteraction}
            disabled={!isRecording}
            style={{ padding: '10px 20px', pointerEvents: 'auto' }}
            data-testid="stop-button"
          >
            Stop
          </button>
        )}
        {/* Agent connection status moved here for quick visibility during tests */}
        <div style={{ fontSize: '14px' }}>
          Agent Connection: <strong data-testid="connection-status">{connectionStates.agent}</strong>
        </div>
        <div style={{ fontSize: '14px' }}>
          Transcription Connection: <strong data-testid="transcription-connection-status">{connectionStates.transcription}</strong>
        </div>
        <div style={{ fontSize: '14px' }}>
          Settings Applied: <strong data-testid="has-sent-settings">{String(hasSentSettingsDom)}</strong>
        </div>
        <button 
          onClick={handleMuteToggle}
          disabled={connectionStates.agent !== 'connected'}
          style={{ 
            padding: '10px 20px',
            backgroundColor: ttsMuted ? '#f56565' : 'transparent',
            transform: ttsMuted ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.1s ease',
            pointerEvents: 'auto',
            border: ttsMuted ? '2px inset' : '2px outset'
          }}
          data-testid="tts-mute-button"
        >
          {ttsMuted ? '🔇 Mute' : '🔊 Enable'}
        </button>
        <button 
          onClick={updateContext}
          disabled={!isRecording}
          style={{ padding: '10px 20px', pointerEvents: 'auto' }}
        >
          Update Context
        </button>
        <button 
          onClick={toggleSleep} 
          disabled={!isRecording || agentState === 'entering_sleep'}
          style={{
            padding: '10px 20px',
            backgroundColor: (isSleeping || agentState === 'entering_sleep') ? '#e0f7fa' : 'transparent',
            pointerEvents: 'auto'
          }}
        >
          {(isSleeping || agentState === 'entering_sleep') ? 'Wake Up' : 'Put to Sleep'}
        </button>
        <button 
          onClick={injectMessage}
          disabled={!isRecording}
          style={{ padding: '10px 20px', pointerEvents: 'auto' }}
        >
          Inject Message
        </button>
        <button 
          onClick={toggleMicrophone}
          disabled={!isReady || micLoading}
          style={{ 
            padding: '10px 20px',
            backgroundColor: micEnabled ? '#e0f7fa' : 'transparent',
            pointerEvents: 'auto',
            position: 'relative'
          }}
          data-testid="microphone-button"
        >
          {micLoading ? (
            <>
              <span style={{ marginRight: '8px' }}>⏳</span>
              Connecting...
            </>
          ) : (
            micEnabled ? 'Disable Mic' : 'Enable Mic'
          )}
        </button>
      </div>
      
      {isRecording && (
        <div style={{
          margin: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px',
          border: '2px solid #ff3333',
          borderRadius: '8px',
          backgroundColor: '#fff8f8'
        }}>
          <p style={{ 
            margin: '0 0 10px 0', 
            fontWeight: 'bold'
          }}>
            {isPlaying ? '🤖 Agent is speaking' 
              : agentState === 'listening' ? '👂 Agent listening' 
              : agentState === 'thinking' ? '🤔 Agent thinking' 
              : (agentState === 'sleeping' || agentState === 'entering_sleep') ? '😴 Agent sleeping' 
              : '🎙️ Microphone active'}
          </p>
          {(agentState === 'sleeping' || agentState === 'entering_sleep') && 
            <p style={{ 
              margin: '0', 
              fontStyle: 'italic', 
              color: '#555'
            }}>(Ignoring audio input)</p>}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginTop: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
          <h3>Live Transcript</h3>
          <pre data-testid="transcription">{lastTranscript || '(Waiting for transcript...)'}</pre>
        </div>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
          <h3>Agent Response</h3>
          <pre data-testid="agent-response">{agentResponse || '(Waiting for agent response...)'}</pre>
        </div>
      </div>
      
      {/* Transcript History - displayed in DOM for E2E testing */}
      <div data-testid="transcript-history" style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h3>Transcript History (for E2E testing)</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {transcriptHistory.length === 0 ? (
            <p>(No transcripts yet)</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {transcriptHistory.map((entry, index) => (
                <li 
                  key={index}
                  data-testid={`transcript-entry-${index}`}
                  data-is-final={entry.is_final}
                  data-speech-final={entry.speech_final}
                  data-timestamp={entry.timestamp}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    backgroundColor: entry.is_final ? (entry.speech_final ? '#1a4d1a' : '#4a3a00') : '#1a3a5c',
                    border: `1px solid ${entry.is_final ? (entry.speech_final ? '#48bb78' : '#f6ad55') : '#4299e1'}`,
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    color: '#ffffff'
                  }}
                >
                  <span style={{ fontWeight: 'bold', marginRight: '8px', color: entry.is_final ? (entry.speech_final ? '#9ae6b4' : '#fbd38d') : '#90cdf4' }}>
                    [{entry.is_final ? (entry.speech_final ? 'FINAL' : 'final') : 'interim'}]
                  </span>
                  <span data-testid={`transcript-text-${index}`} style={{ color: '#ffffff' }}>{entry.text}</span>
                  <span style={{ color: '#cbd5e0', fontSize: '0.85em', marginLeft: '8px' }}>
                    ({new Date(entry.timestamp).toLocaleTimeString()})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h3>User Message from Server</h3>
        <pre data-testid="user-message">{userMessage || '(No user messages from server yet...)'}</pre>
      </div>
      
      {/* Text Input for Text-Only Mode */}
      <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '10px', pointerEvents: 'auto' }}>
        <h3>Text Input (Text-Only Mode)</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Type your message here..."
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', pointerEvents: 'auto' }}
            data-testid="text-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onFocus={async () => {
              // Trigger AudioManager initialization (getAudioContext() does this lazily)
              // Then wait for AudioContext to be ready and resume if suspended
              deepgramRef.current?.getAudioContext?.();
              
              // Wait a moment for AudioManager to initialize, then check for AudioContext
              for (let i = 0; i < 10; i++) {
                const audioContext = deepgramRef.current?.getAudioContext?.();
                if (audioContext) {
                  if (audioContext.state === 'suspended') {
                    try {
                      await audioContext.resume();
                      addLog('✅ AudioContext resumed on text input focus');
                    } catch (error) {
                      addLog(`⚠️ Failed to resume AudioContext on focus: ${error}`);
                    }
                  }
                  break; // AudioContext found, done
                }
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
              }

              // Ensure agent connection is started on user gesture (gate start behind focus)
              // Per issue #206: text input focus should start only agent service
              try {
                const isConnected = connectionStates.agent === 'connected';
                if (!isConnected) {
                  addLog('Starting agent connection on text focus gesture');
                  await deepgramRef.current?.start?.({ agent: true, transcription: false });
                }
              } catch (e) {
                addLog(`⚠️ Failed to start agent on focus: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTextSubmit();
              }
            }}
          />
          <button
            onClick={handleTextSubmit}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', pointerEvents: 'auto' }}
            data-testid="send-button"
          >
            Send
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
          This allows you to send text messages without using the microphone.
        </p>
      </div>

      <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '10px', pointerEvents: 'auto' }}>
        <h3>Instructions Status</h3>
        <div style={{ marginBottom: '10px' }}>
          <strong>Status:</strong> {instructionsLoading ? 'Loading...' : 'Loaded'}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>Source:</strong> {loadedInstructions ? 'Instructions Loader' : 'Not Available'}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>Instructions Preview:</strong>
          <div style={{ 
            maxHeight: '100px', 
            overflowY: 'scroll', 
            background: '#2d3748', 
            padding: '5px', 
            marginTop: '5px',
            fontSize: '12px',
            border: '1px solid #4a5568',
            color: '#e2e8f0'
          }}>
            {loadedInstructions || 'No instructions loaded'}
          </div>
        </div>
      </div>

      <div data-testid="event-log" style={{ marginTop: '20px', border: '1px solid #4a5568', padding: '10px', pointerEvents: 'auto', backgroundColor: '#1a202c' }}>
        <h3 style={{ color: '#e2e8f0' }}>Event Log</h3>
        <button onClick={() => { setLogs([]); }} style={{ marginBottom: '10px', pointerEvents: 'auto', backgroundColor: '#4a5568', color: '#e2e8f0', border: '1px solid #2d3748', padding: '5px 10px', borderRadius: '4px' }}>Clear Logs</button>
        <pre style={{ maxHeight: '300px', overflowY: 'scroll', background: '#2d3748', padding: '5px', color: '#e2e8f0', border: '1px solid #4a5568', borderRadius: '4px' }}>
          {logs.slice().reverse().join('\n')}
        </pre>
      </div>
    </div>
  );
}

export default App;
