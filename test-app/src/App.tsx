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
  AudioConstraints
} from '../../src/types';
import { loadInstructionsFromFile } from '../../src/utils/instructions-loader';

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
  
  // Expose deepgramRef to window for testing
  useEffect(() => {
    (window as any).deepgramRef = deepgramRef;
  }, []);
  
  // State for UI
  const [isReady, setIsReady] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [connectionStates, setConnectionStates] = useState<Partial<Record<ServiceType, ConnectionState>>>({
    agent: 'closed'
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
  
  // Memoize options objects to prevent unnecessary re-renders/effect loops

  // Monitor deepgramRef changes - only log once when it becomes available
  const hasLoggedRef = useRef(false);
  useEffect(() => {
    if (deepgramRef.current && !hasLoggedRef.current) {
      console.log('🔗 [APP] DeepgramVoiceInteraction ref is now available');
      addLog('🔗 [APP] DeepgramVoiceInteraction ref is now available');
      hasLoggedRef.current = true;
      
      // Expose ref globally for E2E tests
      (window as Window & { deepgramRef?: typeof deepgramRef }).deepgramRef = deepgramRef;
      console.log('🔗 [APP] Exposed deepgramRef globally for E2E tests');
    }
  }, [addLog]); // Include addLog in dependencies

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

  const memoizedTranscriptionOptions = useMemo(() => ({
    // Use environment variables with sensible defaults
    model: import.meta.env.VITE_TRANSCRIPTION_MODEL || 'nova-3',
    language: import.meta.env.VITE_TRANSCRIPTION_LANGUAGE || 'en-US',
    smart_format: import.meta.env.VITE_TRANSCRIPTION_SMART_FORMAT !== 'false',
    interim_results: import.meta.env.VITE_TRANSCRIPTION_INTERIM_RESULTS !== 'false',
    diarize: import.meta.env.VITE_TRANSCRIPTION_DIARIZE !== 'false',
    channels: parseInt(import.meta.env.VITE_TRANSCRIPTION_CHANNELS || '1'),
    vad_events: true, // Enable VAD events
    utterance_end_ms: parseInt(import.meta.env.VITE_TRANSCRIPTION_UTTERANCE_END_MS || '1000'),
    sample_rate: 16000,
    encoding: 'linear16'
  }), []);

  const memoizedAgentOptions = useMemo(() => ({
    // Use environment variables with sensible defaults
    language: import.meta.env.VITE_AGENT_LANGUAGE || 'en',
    // Agent can use a different model for listening if desired, 
    // keyterms only affect the transcription service input.
    listenModel: import.meta.env.VITE_AGENT_MODEL || 'nova-3', 
    thinkProviderType: 'open_ai',
    // Default model is `gpt-4o-mini` but other models can be provided such as `gpt-4.1-mini`
    thinkModel: import.meta.env.VITE_AGENT_THINK_MODEL || 'gpt-4o-mini',
    // Uncomment the following lines to use custom endpoint URL and API key values for the Voice Agent `think` message
    //thinkEndpointUrl: 'https://api.openai.com/v1/chat/completions',
    //thinkApiKey: import.meta.env.VITE_THINK_API_KEY || '',
    voice: import.meta.env.VITE_AGENT_VOICE || 'aura-asteria-en',
    instructions: loadedInstructions || 'You are a helpful voice assistant. Keep your responses concise and informative.',
    greeting: import.meta.env.VITE_AGENT_GREETING || 'Hello! How can I assist you today?',
    // Pass conversation history as context in Deepgram API format
    context: conversationHistory.length > 0 ? {
      messages: conversationHistory.map(message => ({
        type: "History",
        role: message.role,
        content: message.content
      }))
    } : undefined
  }), [loadedInstructions, conversationHistory]); // Include conversationHistory dependency

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
    // Use type assertion to handle the actual structure from Deepgram
    // which differs from our TranscriptResponse type
    const deepgramResponse = transcript as unknown as {
      type: string;
      channel: {
        alternatives: Array<{
          transcript: string;
          confidence: number;
          words: Array<{
            word: string;
            start: number;
            end: number;
            confidence: number;
            speaker?: number;
            punctuated_word?: string;
          }>;
        }>;
      };
      is_final: boolean;
    };

    if (deepgramResponse.channel?.alternatives?.[0]?.transcript) {
      const text = deepgramResponse.channel.alternatives[0].transcript;
      // Get speaker ID if available
      const speakerId = deepgramResponse.channel.alternatives[0].words?.[0]?.speaker;
      const displayText = speakerId !== undefined 
        ? `Speaker ${speakerId}: ${text}` 
        : text;
      
      setLastTranscript(displayText);
      
      // Log transcript to event log (and console via addLog)
      const transcriptType = deepgramResponse.is_final ? 'final' : 'interim';
      addLog(`[TRANSCRIPT] "${text}" (${transcriptType})`);
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
    const channelStr = data.channel.join(',');
    setUtteranceEnd(`Channel: [${channelStr}], Last word end: ${data.lastWordEnd}s`);
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
          
          // Check if connection is closed and needs to be re-established (using tracked state)
          // Per issue #206: microphone button should start both services if configured
          if (connectionStates.agent !== 'connected') {
            console.log('🎤 [APP] Agent connection closed, re-establishing connection...');
            addLog('Re-establishing agent connection...');
            // Start both services when microphone is activated
            await deepgramRef.current.start({ agent: true, transcription: true });
            console.log('🎤 [APP] Connection re-established');
          }
          
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
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey={import.meta.env.VITE_DEEPGRAM_API_KEY || ''}
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
        // VAD event handlers
        onUserStartedSpeaking={handleUserStartedSpeaking}
        onUserStoppedSpeaking={handleUserStoppedSpeaking}
        onUtteranceEnd={handleUtteranceEnd}
        onAgentSpeaking={handleAgentSpeaking}
        onIdleTimeoutActiveChange={handleIdleTimeoutActiveChange}
        audioConstraints={memoizedAudioConstraints} // Issue #243: Echo cancellation configuration
        debug={isDebugMode} // Enable debug only when debug mode is explicitly enabled
      />
      
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
