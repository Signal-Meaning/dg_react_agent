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
  DeepgramError
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
  
  // State for UI
  const [isReady, setIsReady] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [connectionStates, setConnectionStates] = useState<Record<ServiceType, ConnectionState>>({
    transcription: 'closed',
    agent: 'closed'
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [currentKeepalive, setCurrentKeepalive] = useState<string | null>(null);
  
  // Instructions state
  const [loadedInstructions, setLoadedInstructions] = useState<string>('');
  const [instructionsLoading, setInstructionsLoading] = useState(true);
  
  // Auto-connect dual mode state
  const [micEnabled, setMicEnabled] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentSilent, setAgentSilent] = useState(false);
  
  // VAD state
  const [userStoppedSpeaking, setUserStoppedSpeaking] = useState<string | null>(null);
  const [utteranceEnd, setUtteranceEnd] = useState<string | null>(null);
  const [vadEvent, setVadEvent] = useState<string | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  
  // Text input state
  const [textInput, setTextInput] = useState('');
  
  // Helper to add logs - memoized
  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`]);
    // Clear keepalive when a real event occurs
    setCurrentKeepalive(null);
  }, []); // No dependencies, created once
  
  // Helper to update keepalive - memoized
  const updateKeepalive = useCallback((message: string) => {
    setCurrentKeepalive(`${new Date().toISOString().substring(11, 19)} - ${message}`);
  }, []); // No dependencies, created once
  
  // Memoize options objects to prevent unnecessary re-renders/effect loops
  const memoizedTranscriptionOptions = useMemo(() => ({
    // Nova-3 enables keyterm prompting
    model: 'nova-3', 
    language: 'en-US',
    smart_format: true,
    interim_results: true,
    diarize: true, 
    channels: 1,
    // Add keyterms that might be tricky for standard models
    keyterm: [
      "Casella", // Proper noun
      "Symbiosis", // Less common word
      "Kerfuffle", // Unusual word
      "Supercalifragilisticexpialidocious" // Very long/unusual
    ]
  }), []); // Empty dependency array means this object is created only once

  // Monitor deepgramRef changes - only log once when it becomes available
  useEffect(() => {
    if (deepgramRef.current) {
      console.log('🔗 [APP] DeepgramVoiceInteraction ref is now available');
      addLog('🔗 [APP] DeepgramVoiceInteraction ref is now available');
    }
  }, [addLog]); // Remove deepgramRef.current from dependencies to avoid infinite loop

  // Load instructions using the instructions-loader utility
  useEffect(() => {
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
      }
    };

    loadInstructions();
  }, [addLog]);

  const memoizedAgentOptions = useMemo(() => ({
    language: 'en',
    // Agent can use a different model for listening if desired, 
    // keyterms only affect the transcription service input.
    listenModel: 'nova-3', 
    thinkProviderType: 'open_ai',
    // Default model is `gpt-4o-mini` but other models can be provided such as `gpt-4.1-mini`
    thinkModel: 'gpt-4o-mini',
    // Uncomment the following lines to use custom endpoint URL and API key values for the Voice Agent `think` message
    //thinkEndpointUrl: 'https://api.openai.com/v1/chat/completions',
    //thinkApiKey: import.meta.env.VITE_THINK_API_KEY || '',
    voice: 'aura-2-apollo-en',
    instructions: loadedInstructions,
    greeting: 'Hello! How can I assist you today?',
  }), [loadedInstructions]); // Include loadedInstructions in dependency array

  // Memoize endpoint config to point to custom endpoint URLs
  const memoizedEndpointConfig = useMemo(() => ({
    transcriptionUrl: 'wss://api.deepgram.com/v1/listen',
    agentUrl: 'wss://agent.deepgram.com/v1/agent/converse',
  }), []);

  // Targeted sleep/wake logging for the App component
  const sleepLogApp = useCallback((message: string) => {
    addLog(`[SLEEP_CYCLE][APP] ${message}`);
  }, [addLog]);
  
  // Event handlers - memoized with useCallback
  const handleReady = useCallback((ready: boolean) => {
    setIsReady(ready);
    addLog(`Component is ${ready ? 'ready' : 'not ready'}`);
  }, [addLog]); // Depends on addLog
  
  const handleTranscriptUpdate = useCallback((transcript: TranscriptResponse) => {
    // Log the full transcript structure for debugging
    console.log('Full transcript response:', transcript);

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
      
      if (deepgramResponse.is_final) {
        addLog(`Final transcript: ${displayText}`);
      }
    }
  }, [addLog]); // Depends on addLog
  
  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    setAgentResponse(utterance.text);
    addLog(`Agent said: ${utterance.text}`);
  }, [addLog]); // Depends on addLog
  
  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    setUserMessage(message.text);
    addLog(`User message from server: ${message.text}`);
  }, [addLog]); // Depends on addLog
  
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
  
  // Add a handler for audio playing status
  const handlePlaybackStateChange = useCallback((isPlaying: boolean) => {
    setIsPlaying(isPlaying);
    addLog(`Audio playback: ${isPlaying ? 'started' : 'stopped'}`);
  }, [addLog]);
  
  const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
    setConnectionStates(prev => ({
      ...prev,
      [service]: state
    }));
    addLog(`${service} connection state: ${state}`);
  }, [addLog]); // Depends on addLog
  
  const handleError = useCallback((error: DeepgramError) => {
    addLog(`Error (${error.service}): ${error.message}`);
    console.error('Deepgram error:', error);
  }, [addLog]); // Depends on addLog

  // VAD event handlers
  const handleUserStoppedSpeaking = useCallback((data: { timestamp?: number }) => {
    const timestamp = data.timestamp ? new Date(data.timestamp).toISOString().substring(11, 19) : 'unknown';
    setUserStoppedSpeaking(timestamp);
    setIsUserSpeaking(false);
    addLog(`🎤 User stopped speaking at ${timestamp}`);
  }, [addLog]);

  const handleUtteranceEnd = useCallback((data: { channel: number[]; lastWordEnd: number }) => {
    const channelStr = data.channel.join(',');
    setUtteranceEnd(`Channel: [${channelStr}], Last word end: ${data.lastWordEnd}s`);
    setIsUserSpeaking(false);
    addLog(`🔚 UtteranceEnd detected - Channel: [${channelStr}], Last word end: ${data.lastWordEnd}s`);
  }, [addLog]);

  const handleVADEvent = useCallback((data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => {
    const timestamp = data.timestamp ? new Date(data.timestamp).toISOString().substring(11, 19) : 'unknown';
    const confidence = data.confidence ? ` (${(data.confidence * 100).toFixed(1)}%)` : '';
    setVadEvent(`${data.speechDetected ? 'Speech detected' : 'No speech'} at ${timestamp}${confidence}`);
    setIsUserSpeaking(data.speechDetected);
    addLog(`🎯 VAD Event: ${data.speechDetected ? 'Speech detected' : 'No speech'} at ${timestamp}${confidence}`);
  }, [addLog]);

  // Auto-connect dual mode event handlers
  const handleMicToggle = useCallback((enabled: boolean) => {
    setMicEnabled(enabled);
    addLog(`Microphone ${enabled ? 'enabled' : 'disabled'}`);
  }, [addLog]);

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    
    try {
      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      const isRealApiKey = apiKey && 
        apiKey !== 'your-deepgram-api-key-here' && 
        apiKey !== 'your_actual_deepgram_api_key_here' &&
        !apiKey.startsWith('test-') && 
        apiKey.length >= 20; // Deepgram API keys are typically 20+ characters
      
      if (isRealApiKey) {
        // Real API key - use lazy reconnect with text
        addLog(`🔄 [LAZY_RECONNECT] Resuming conversation with text: ${textInput}`);
        setUserMessage(textInput);
        
        if (deepgramRef.current) {
          // Use lazy reconnect method instead of direct injection
          await deepgramRef.current.resumeWithText(textInput);
          addLog('✅ [LAZY_RECONNECT] Text message sent via resumeWithText');
        } else {
          addLog('Error: DeepgramVoiceInteraction ref not available');
        }
      } else {
        // Mock API key - use simulated responses
        addLog(`Sending text message to MOCK agent: ${textInput}`);
        setUserMessage(textInput);
        
        // Simulate agent response for testing with mock API key
        setTimeout(() => {
          setAgentResponse(`[MOCK] I received your message: "${textInput}". How can I help you with that?`);
          addLog('Mock agent responded to text message');
        }, 1000);
      }
      
      setTextInput('');
    } catch (error) {
      addLog(`Error sending text message: ${(error as Error).message}`);
      console.error('Text submit error:', error);
    }
  }, [textInput, addLog]);

  const handleConnectionReady = useCallback(() => {
    setConnectionReady(true);
    addLog('Dual mode connection established and settings sent');
  }, [addLog]);

  const handleAgentSpeaking = useCallback(() => {
    setAgentSpeaking(true);
    addLog('Agent started speaking');
  }, [addLog]);

  const handleAgentSilent = useCallback(() => {
    setAgentSilent(true);
    addLog('Agent finished speaking');
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
  
  const interruptAgent = () => {
    console.log('🚨 Interrupt button clicked!');
    addLog('🔇 Interrupting agent - attempting to stop all audio');
    
    if (deepgramRef.current) {
      deepgramRef.current.interruptAgent();
      console.log('✅ interruptAgent() method called');
    } else {
      console.error('❌ deepgramRef.current is null!');
    }
  };
  
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
        // Enable microphone with lazy reconnect
        addLog('🔄 [LAZY_RECONNECT] Resuming conversation with audio');
        console.log('🎤 [APP] About to call resumeWithAudio()');
        
        if (deepgramRef.current) {
          console.log('🎤 [APP] deepgramRef.current exists, calling resumeWithAudio()');
          await deepgramRef.current.resumeWithAudio();
          console.log('🎤 [APP] resumeWithAudio() completed successfully');
          addLog('✅ [LAZY_RECONNECT] Audio conversation resumed');
        } else {
          console.log('🎤 [APP] deepgramRef.current is null!');
          addLog('❌ [APP] deepgramRef.current is null - cannot resume audio');
        }
      } else {
        // Disable microphone
        console.log('🎤 [APP] Disabling microphone');
        await deepgramRef.current?.toggleMicrophone(false);
        addLog('Microphone disabled');
      }
    } catch (error) {
      console.log('🎤 [APP] Error in toggleMicrophone:', error);
      addLog(`Error toggling microphone: ${(error as Error).message}`);
      console.error('Microphone toggle error:', error);
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
        <h2 style={{ margin: '0 0 15px 0', color: '#fbb6ce', fontSize: '18px' }}>⚠️ Deepgram API Key Status</h2>
        <p style={{ margin: '0 0 15px 0' }}><strong>This test app supports both REAL and MOCK modes:</strong></p>
        <div style={{ margin: '15px 0', padding: '15px', backgroundColor: '#2d3748', borderRadius: '6px', border: '1px solid #4a5568' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#fc8181', fontSize: '16px' }}>🔴 Current Mode: MOCK</h4>
          <p style={{ margin: '0', color: '#a0aec0' }}>Text messages will show simulated responses with <code style={{ backgroundColor: '#4a5568', padding: '2px 4px', borderRadius: '3px', fontSize: '13px', color: '#e2e8f0' }}>[MOCK]</code> prefix.</p>
        </div>
        <p style={{ margin: '15px 0 10px 0' }}><strong>To enable REAL Deepgram integration:</strong></p>
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
        <p style={{ margin: '0', fontStyle: 'italic', color: '#a0aec0' }}>With a real API key, text messages will be sent to the actual Deepgram agent service.</p>
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
        onKeepalive={(service) => updateKeepalive(`💓 [KEEPALIVE] ${service} keepalive sent`)}
        // Auto-connect dual mode props
        autoConnect={true}
        microphoneEnabled={micEnabled}
        onMicToggle={handleMicToggle}
        onConnectionReady={handleConnectionReady}
        onAgentSpeaking={handleAgentSpeaking}
        onAgentSilent={handleAgentSilent}
        // VAD event props
        onUserStoppedSpeaking={handleUserStoppedSpeaking}
        onUtteranceEnd={handleUtteranceEnd}
        onVADEvent={handleVADEvent}
        // VAD configuration
        utteranceEndMs={1000}
        interimResults={true}
        debug={false}
      />
      
      <div style={{ border: '1px solid blue', padding: '10px', margin: '15px 0' }}>
        <h4>Component States:</h4>
        <p>App UI State (isSleeping): <strong>{(isSleeping || agentState === 'entering_sleep').toString()}</strong></p>
        <p>Core Component State (agentState via callback): <strong>{agentState}</strong></p>
        <p>Transcription Connection: <strong data-testid="connection-status">{connectionStates.agent}</strong></p>
        <p>Agent Connection: <strong>{connectionStates.agent}</strong></p>
        
        {/* API Mode Indicator */}
        {(() => {
          const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
          const isRealApiKey = apiKey && 
            apiKey !== 'your-deepgram-api-key-here' && 
            apiKey !== 'your_actual_deepgram_api_key_here' &&
            !apiKey.startsWith('test-') && 
            apiKey.length >= 20; // Deepgram API keys are typically 20+ characters
          
          return (
            <div style={{ 
              margin: '10px 0', 
              padding: '8px', 
              backgroundColor: isRealApiKey ? '#1a4d1a' : '#2d3748', 
              border: `1px solid ${isRealApiKey ? '#48bb78' : '#4a5568'}`,
              borderRadius: '4px',
              color: isRealApiKey ? '#9ae6b4' : '#e2e8f0'
            }} data-testid="api-mode-indicator">
              <strong>
                {isRealApiKey ? '🟢 REAL API Mode' : '🟡 MOCK API Mode'}
              </strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.9em', color: isRealApiKey ? '#9ae6b4' : '#a0aec0' }}>
                {isRealApiKey 
                  ? 'Text messages sent to actual Deepgram agent service' 
                  : 'Text messages show simulated responses with [MOCK] prefix'
                }
              </p>
            </div>
          );
        })()}
        <p>Audio Recording: <strong>{isRecording.toString()}</strong></p>
        <p>Audio Playing: <strong>{isPlaying.toString()}</strong></p>
        <h4>Auto-Connect Dual Mode States:</h4>
        <div data-testid="auto-connect-states">
          <p>Microphone Enabled: <strong data-testid="mic-status">{micEnabled ? 'Enabled' : 'Disabled'}</strong></p>
          <p>Connection Ready: <strong data-testid="connection-ready">{connectionReady.toString()}</strong></p>
          <p>Agent Speaking: <strong data-testid="agent-speaking">{agentSpeaking.toString()}</strong></p>
          <p>Agent Silent: <strong data-testid="agent-silent">{agentSilent.toString()}</strong></p>
        </div>
        
        <h4>VAD (Voice Activity Detection) States:</h4>
        <div data-testid="vad-states">
          <p>User Speaking: <strong data-testid="user-speaking">{isUserSpeaking.toString()}</strong></p>
          <p>User Stopped Speaking: <strong data-testid="user-stopped-speaking">{userStoppedSpeaking || 'Not detected'}</strong></p>
          <p>Utterance End: <strong data-testid="utterance-end">{utteranceEnd || 'Not detected'}</strong></p>
          <p>VAD Event: <strong data-testid="vad-event">{vadEvent || 'Not detected'}</strong></p>
        </div>
      </div>
      
      <div style={{ margin: '20px 0', display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
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
        <button 
          onClick={interruptAgent}
          disabled={!isRecording}
          style={{ padding: '10px 20px', pointerEvents: 'auto' }}
        >
          Interrupt Audio
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
          disabled={!isReady}
          style={{ 
            padding: '10px 20px',
            backgroundColor: micEnabled ? '#e0f7fa' : 'transparent',
            pointerEvents: 'auto'
          }}
          data-testid="microphone-button"
        >
          {micEnabled ? 'Disable Mic' : 'Enable Mic'}
        </button>
        <button 
          onClick={() => {
            deepgramRef.current?.triggerTimeoutForTesting();
            addLog('🧪 [TEST] Manually triggered connection timeout');
          }}
          disabled={!isReady}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
          title="Manually trigger connection timeout for testing lazy reconnection"
        >
          🧪 Test Timeout
        </button>
      </div>
      
      {/* Auto-connect dual mode status */}
      {connectionReady && (
        <div style={{
          margin: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px',
          border: '2px solid #48bb78',
          borderRadius: '8px',
          backgroundColor: '#1a4d1a',
          color: '#9ae6b4'
        }}>
          <p style={{ 
            margin: '0 0 10px 0', 
            fontWeight: 'bold'
          }} data-testid="greeting-sent">
            {agentSpeaking ? '🎤 Agent is speaking' 
              : agentSilent ? '✅ Agent finished speaking - ready for interaction' 
              : '🔗 Dual mode connected - waiting for agent...'}
          </p>
          {!micEnabled && (
            <p style={{ 
              margin: '0', 
              fontStyle: 'italic', 
              color: '#a0aec0'
            }}>
              Microphone disabled - click "Enable Mic" to start speaking
            </p>
          )}
        </div>
      )}

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
            onKeyPress={(e) => {
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

      <div style={{ marginTop: '20px', border: '1px solid #4a5568', padding: '10px', pointerEvents: 'auto', backgroundColor: '#1a202c' }}>
        <h3 style={{ color: '#e2e8f0' }}>Event Log</h3>
        <button onClick={() => { setLogs([]); setCurrentKeepalive(null); }} style={{ marginBottom: '10px', pointerEvents: 'auto', backgroundColor: '#4a5568', color: '#e2e8f0', border: '1px solid #2d3748', padding: '5px 10px', borderRadius: '4px' }}>Clear Logs</button>
        <pre style={{ maxHeight: '300px', overflowY: 'scroll', background: '#2d3748', padding: '5px', color: '#e2e8f0', border: '1px solid #4a5568', borderRadius: '4px' }}>
          {currentKeepalive ? [currentKeepalive, ...logs.slice().reverse()].join('\n') : logs.slice().reverse().join('\n')}
        </pre>
      </div>
    </div>
  );
}

export default App;
