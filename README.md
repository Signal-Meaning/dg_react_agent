# Deepgram Voice Interaction React Component

A headless React component designed to drastically simplify the integration of Deepgram's real-time transcription and voice agent capabilities into web applications. It handles the low-level complexities of WebSocket connections, browser microphone access, and agent audio playback, allowing you to focus on building your application's UI and logic.

**Development Note:** This component was forked from the original Deepgram repository at commit `7191eb4a062f35344896e873f02eba69c9c46a2d` (pre-fork). All development after that point is considered post-fork. The original component provided basic microphone functionality via `startAudioCapture()` method, which is preserved in this fork.

[![npm version](https://img.shields.io/npm/v/@signal-meaning/deepgram-voice-interaction-react?registry_uri=https://npm.pkg.github.com)](https://npm.pkg.github.com/@signal-meaning/deepgram-voice-interaction-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Project Objectives

**Fork Purpose:** This fork of `dg_react_agent` adds `test-app` as a demonstration of a React web testable frontend to the dg_react_agent React component.

**API Compatibility Requirement:** The component MUST maintain API compatibility with the Deepgram Voice Agent API:
- Voice Agent API v1: https://developers.deepgram.com/docs/voice-agent
- Migration Guide: https://developers.deepgram.com/docs/voice-agent-v1-migration

Any improvements must be justified and maintain compatibility with the Voice Agent API.

**Test App Goals:** The test-app and its related tests are intended to:
- Recommend certain integration patterns and avoid others
- Act as a starting point for React developers
- Demonstrate proper usage of the headless dg_react_agent component
- MUST maintain API compatibility with the headless dg_react_agent component

## Features

-   **Real-time Transcription:** Streams microphone audio to Deepgram's Speech-to-Text API and provides live results.
-   **Voice Agent Interaction:** Connects to Deepgram's Voice Agent API, enabling two-way voice conversations.
-   **Microphone Handling:** Manages browser microphone access (requesting permissions) and audio capture using the Web Audio API.
-   **Agent Audio Playback:** Automatically plays audio responses received from the voice agent using the Web Audio API.
-   **Robust Control:** Provides methods to programmatically start, stop, interrupt the agent, toggle sleep mode, update agent instructions, and inject messages.
-   **Event-Driven:** Uses callbacks (`props`) to deliver transcription updates, agent state changes, agent utterances, user messages, connection status, errors, and more.
*   **Keyterm Prompting:** Supports Deepgram's Keyterm Prompting feature for improved accuracy on specific terms (requires Nova-3 model).
*   **Sleep/Wake:** Includes functionality to put the agent into a sleep state where it ignores audio input until explicitly woken.
-   **Headless:** Contains **no UI elements**, giving you complete control over the look and feel of your application.
-   **TypeScript:** Built with TypeScript for enhanced type safety and developer experience.

## Component Modes

This component is highly flexible and can operate in three distinct modes:

1. **Transcription + Agent (Dual Mode):**
   - **Configuration:** Provide both `transcriptionOptions` and `agentOptions` props
   - **Behavior:** Uses both services - transcribes speech while simultaneously enabling agent conversations
   - **Use Case:** Applications requiring both real-time transcription and agent interaction
   - **Key Benefits:** 
     - Get independent transcription results while also interacting with the agent
     - Transcription is handled separately from agent, allowing different models/settings
     - All callbacks for both services are available
   - **Example Scenario:** A meeting assistant that both transcribes the conversation and allows participants to ask an AI questions

2. **Transcription Only:**
   - **Configuration:** Provide `transcriptionOptions` prop, **completely omit** the `agentOptions` prop
   - **Behavior:** Only connects to the transcription service, no agent functionality is initialized
   - **Use Case:** Applications needing only speech-to-text without agent capabilities
   - **Key Benefits:**
     - Lighter weight (no agent connection or audio playback)
     - Focused functionality for pure transcription needs
     - Enhanced control over transcription options without agent constraints
   - **Example Scenario:** A dictation app that converts speech to text for note-taking

3. **Agent Only:**
   - **Configuration:** Provide `agentOptions` prop, **completely omit** the `transcriptionOptions` prop
   - **Behavior:** Only initializes the agent service (which handles its own transcription internally)
   - **Use Case:** Voice agent applications where you don't need separate transcription results
   - **Key Benefits:**
     - Simplified setup for agent-only interactions
     - Agent handles transcription internally (via the `listenModel` option)
     - No duplicate transcription processing (saves resources)
   - **Example Scenario:** A voice assistant that responds to queries but doesn't need to display intermediate transcription

> **IMPORTANT:** For proper initialization, you must completely **omit** (not pass) the options prop for any service you don't want to use. Passing an empty object (`{}`) will still activate that service.

### Mode Selection Guide

Choose your mode based on these criteria:

- **Do you need to display live transcripts?** If yes, you need Transcription Only or Dual Mode.
- **Do you need an AI assistant that responds to voice?** If yes, you need Agent Only or Dual Mode.
- **Do you need separate control over transcription options?** If yes, use Dual Mode instead of Agent Only.
- **Are you concerned about performance/resource usage?** Use the most minimal mode for your needs (avoid Dual Mode if you only need one service).

### Callbacks Relevant to Each Mode

| Callback | Transcription Only | Agent Only | Dual Mode |
|----------|:-----------------:|:----------:|:---------:|
| `onReady` | ✅ | ✅ | ✅ |
| `onConnectionStateChange` | ✅ | ✅ | ✅ |
| `onError` | ✅ | ✅ | ✅ |
| `onTranscriptUpdate` | ✅ | ❌ | ✅ |
| `onUserStartedSpeaking` | ✅ | ❌ | ✅ |
| `onUserStoppedSpeaking` | ✅ | ❌ | ✅ |
| `onAgentStateChange` | ❌ | ✅ | ✅ |
| `onAgentUtterance` | ❌ | ✅ | ✅ |
| `onUserMessage` | ❌ | ✅ | ✅ |
| `onPlaybackStateChange` | ❌ | ✅ | ✅ |

## Installation

This package is published to the private GitHub Package Registry. To install it, you'll need to configure npm to use the GitHub Package Registry for the `@signal-meaning` scope.

### 1. Configure npm for GitHub Package Registry

Create or update your `.npmrc` file in your project root:

```bash
# GitHub Package Registry configuration
@signal-meaning:registry=https://npm.pkg.github.com
# Authentication token for GitHub Package Registry
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 2. Set up authentication

You'll need a GitHub Personal Access Token with `read:packages` permission. Set it as an environment variable:

```bash
export GITHUB_TOKEN=your_github_token_here
```

Or add it to your `.env` file:

```bash
GITHUB_TOKEN=your_github_token_here
```

### 3. Install the package

```bash
npm install @signal-meaning/deepgram-voice-interaction-react
# or
yarn add @signal-meaning/deepgram-voice-interaction-react
```

### Alternative: Login with npm

Instead of using environment variables, you can also authenticate using npm login:

```bash
npm login --scope=@signal-meaning --registry=https://npm.pkg.github.com
```

When prompted, use your GitHub username and your Personal Access Token as the password.

## Migration Guide

### From v0.1.0 to v0.1.1

**Breaking Change:** `autoConnect` prop behavior changed
- **Before:** `autoConnect` defaulted to `undefined` and auto-connected
- **After:** `autoConnect` defaults to `undefined` and does NOT auto-connect
- **Fix:** Explicitly set `autoConnect={true}` if you want auto-connection behavior

```tsx
// Before (v0.1.0) - auto-connected by default
<DeepgramVoiceInteraction
  apiKey={apiKey}
  agentOptions={agentOptions}
/>

// After (v0.1.1) - requires explicit autoConnect
<DeepgramVoiceInteraction
  apiKey={apiKey}
  autoConnect={true}  // Add this for auto-connection
  agentOptions={agentOptions}
/>
```

## Quick Start

```tsx
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-api-key"
      agentOptions={{
        instructions: "You are a helpful assistant",
        voice: "aura-asteria-en"
      }}
      onAgentUtterance={(utterance) => console.log(utterance.text)}
    />
  );
}
```

## Environment Variables

The component supports extensive configuration through environment variables. This allows you to customize transcription models, agent settings, and other options without hardcoding values in your application.

For a complete list of available environment variables, see [test-app/ENVIRONMENT_VARIABLES.md](test-app/ENVIRONMENT_VARIABLES.md).

For detailed information about testing utilities and audio sample generation, see [docs/TEST-UTILITIES.md](docs/TEST-UTILITIES.md).

**New to testing voice features?** Start with [docs/TESTING-QUICK-START.md](docs/TESTING-QUICK-START.md) for a practical guide.

For current VAD testing status and DRY refactoring implementation, see [docs/VAD-TEST-STATUS-REPORT.md](docs/VAD-TEST-STATUS-REPORT.md).

### Example Configuration

Create a `.env` file in your project root:

```bash
# Required
VITE_DEEPGRAM_API_KEY=your-api-key-here
VITE_DEEPGRAM_PROJECT_ID=your-project-id-here

# Optional - override defaults
VITE_TRANSCRIPTION_MODEL=nova-2
VITE_TRANSCRIPTION_LANGUAGE=en-GB
VITE_AGENT_VOICE=aura-2-luna-en
VITE_AGENT_GREETING=Hi there! How can I help you today?
```

## Getting Started

This component simplifies complex interactions. Here's how to get started with common use cases:

## ⚠️ Critical: Options Props Must Be Memoized

**IMPORTANT:** The `agentOptions` and `transcriptionOptions` props MUST be memoized using `useMemo` to prevent infinite re-initialization and poor performance.

### ✅ Correct Usage (Required)
```tsx
const agentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-3',
  // ... other options
}), []); // Empty dependency array for static config

const transcriptionOptions = useMemo(() => ({
  model: 'nova-2',
  language: 'en-US',
  // ... other options
}), []);

<DeepgramVoiceInteraction 
  agentOptions={agentOptions}
  transcriptionOptions={transcriptionOptions}
/>
```

### ❌ Incorrect Usage (Causes Problems)
```tsx
// DON'T DO THIS - causes infinite re-initialization
<DeepgramVoiceInteraction 
  agentOptions={{
    language: 'en',
    listenModel: 'nova-3',
  }}
  transcriptionOptions={{
    model: 'nova-2',
    language: 'en-US',
  }}
/>
```

**Why?** The component's main useEffect depends on these props. Inline objects create new references on every render, causing the component to tear down and recreate WebSocket connections constantly, leading to:
- Infinite re-initialization loops
- Console spam with repeated logs
- Poor performance and unnecessary network traffic
- Potential connection rate limiting

**Development Warning:** In development mode, the component will warn you if it detects non-memoized options props.

## Auto-Connect Behavior

The `autoConnect` prop controls whether the component automatically establishes connections when ready:

- `autoConnect={true}`: Automatically connects to services when ready (enables text-only interactions)
- `autoConnect={false}`: Requires manual connection via `start()` method
- `autoConnect={undefined}` (default): Same as `false` - no auto-connection

**Important:** When `autoConnect` is `true`, the component will establish WebSocket connections immediately when ready, enabling text-only interactions even before microphone access is granted.

```tsx
// Auto-connect enabled (recommended for most use cases)
<DeepgramVoiceInteraction
  apiKey={apiKey}
  autoConnect={true}
  agentOptions={memoizedAgentOptions}
/>

// Manual connection control
<DeepgramVoiceInteraction
  apiKey={apiKey}
  autoConnect={false}
  agentOptions={memoizedAgentOptions}
  onReady={(isReady) => {
    if (isReady) {
      deepgramRef.current?.start();
    }
  }}
/>
```

### 1. Basic Real-time Transcription (Transcription Only Mode)

This example focuses solely on getting live transcripts from microphone input.

```tsx
import React, { useRef, useState, useCallback, useMemo } from 'react';
// Adjust import path based on your setup (package vs local)
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react'; 
import type { 
  DeepgramVoiceInteractionHandle, 
  TranscriptResponse,
  TranscriptionOptions,
  DeepgramError 
} from '@signal-meaning/deepgram-voice-interaction-react';

function SimpleTranscriber() {
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isReady, setIsReady] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');

  // Define transcription options (use useMemo to prevent unnecessary re-renders)
  const transcriptionOptions = useMemo<TranscriptionOptions>(() => ({
    model: 'nova-2', // Or your preferred model
    language: 'en-US',
    interim_results: true,
    smart_format: true,
  }), []);
  
  // --- Callbacks ---
  const handleReady = useCallback((ready: boolean) => {
    console.log(`Transcription component ready: ${ready}`);
    setIsReady(ready);
  }, []);

  const handleTranscriptUpdate = useCallback((transcript: TranscriptResponse) => {
    if (transcript.is_final && transcript.channel?.alternatives?.[0]) {
      const text = transcript.channel.alternatives[0].transcript;
      console.log('Final transcript:', text);
      setLastTranscript(text);
    } else if (transcript.channel?.alternatives?.[0]) {
      // Handle interim results if needed
      // console.log('Interim transcript:', transcript.channel.alternatives[0].transcript);
    }
  }, []);
  
  const handleError = useCallback((error: DeepgramError) => {
    console.error('Deepgram Error:', error);
  }, []);

  // --- Control Functions ---
  const startTranscription = () => deepgramRef.current?.start();
  const stopTranscription = () => deepgramRef.current?.stop();
  
  return (
    <div>
      <h1>Live Transcription</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY || "YOUR_DEEPGRAM_API_KEY"}
        transcriptionOptions={transcriptionOptions}
        // IMPORTANT: agentOptions prop is completely omitted, not just empty
        onReady={handleReady}
        onTranscriptUpdate={handleTranscriptUpdate}
        onError={handleError}
        debug={true} // Enable console logs from the component
      />
      
      <div>
        <button onClick={startTranscription} disabled={!isReady}>Start Transcribing</button>
        <button onClick={stopTranscription} disabled={!isReady}>Stop Transcribing</button>
      </div>
      
      <h2>Last Transcript:</h2>
      <p>{lastTranscript || '(Waiting...)'}</p>
    </div>
  );
}

export default SimpleTranscriber;
```

### 2. Basic Agent Interaction (Agent Only Mode)

This example focuses on interacting with a voice agent, using its responses.

```tsx
import React, { useRef, useState, useCallback, useMemo } from 'react';
// Adjust import path based on your setup (package vs local)
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';
import type { 
  DeepgramVoiceInteractionHandle, 
  AgentState, 
  LLMResponse,
  AgentOptions,
  DeepgramError,
  UserMessageResponse // Added for the new callback
} from '@signal-meaning/deepgram-voice-interaction-react';

function SimpleAgent() {
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isReady, setIsReady] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [lastAgentResponse, setLastAgentResponse] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState(''); // Added for user messages
  
  // Define agent options (use useMemo to prevent unnecessary re-renders)
  const agentOptions = useMemo<AgentOptions>(() => ({
    instructions: 'You are a friendly chatbot.',
    // Specify Deepgram listen provider if you want agent to handle STT
    listenModel: 'nova-2', 
    // Specify voice, think model, etc.
    voice: 'aura-asteria-en', 
    thinkModel: 'gpt-4o-mini',
  }), []);

  // --- Callbacks ---
  const handleReady = useCallback((ready: boolean) => {
    console.log(`Agent component ready: ${ready}`);
    setIsReady(ready);
  }, []);

  const handleAgentStateChange = useCallback((state: AgentState) => {
    console.log(`Agent state: ${state}`);
    setAgentState(state);
  }, []);

  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    console.log('Agent said:', utterance.text);
    setLastAgentResponse(utterance.text);
  }, []);
  
  // Handle user messages from the server
  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    console.log('User message from server:', message.text);
    setLastUserMessage(message.text);
  }, []);
  
  const handleError = useCallback((error: DeepgramError) => {
    console.error('Deepgram Error:', error);
  }, []);

  // --- Control Functions ---
  const startInteraction = () => deepgramRef.current?.start();
  const stopInteraction = () => deepgramRef.current?.stop();
  const interruptAgent = () => deepgramRef.current?.interruptAgent();
  const injectTestMessage = () => deepgramRef.current?.injectAgentMessage("Hello from the client!");

  return (
    <div>
      <h1>Voice Agent Interaction</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY || "YOUR_DEEPGRAM_API_KEY"}
        // Pass agentOptions, completely omit transcriptionOptions
        agentOptions={agentOptions}
        onReady={handleReady}
        onAgentStateChange={handleAgentStateChange}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage} // Added new callback
        onError={handleError}
        debug={true} // Enable console logs from the component
      />
      
      <div>
        <button onClick={startInteraction} disabled={!isReady}>Start Interaction</button>
        <button onClick={stopInteraction} disabled={!isReady}>Stop Interaction</button>
        <button onClick={interruptAgent} disabled={!isReady}>Interrupt Agent</button>
        <button onClick={injectTestMessage} disabled={!isReady}>Inject Message</button> {/* Added inject button */}
      </div>
      
      <h2>Agent State: {agentState}</h2>
      <h2>Last Agent Response:</h2>
      <p>{lastAgentResponse || '(Waiting...)'}</p>
      <h2>Last User Message (from Server):</h2> {/* Added display for user message */} 
      <p>{lastUserMessage || '(Waiting...)'}</p>
    </div>
  );
}

export default SimpleAgent;
```

### 3. Combined Transcription and Agent Interaction (Dual Mode)

Leverage both services simultaneously. Get live transcripts *while* interacting with the agent.

```tsx
// (Combine imports, state, callbacks, and controls from examples 1 & 2)
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';
import type { 
  // ... include UserMessageResponse ... 
} from '@signal-meaning/deepgram-voice-interaction-react';
// ...

function CombinedInteraction() {
  // ... Add state for user messages ...
  // ... Add handleUserMessage callback ...
  
  return (
    <div>
      <h1>Combined Interaction</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY || "YOUR_DEEPGRAM_API_KEY"}
        // Include BOTH options for dual mode
        transcriptionOptions={transcriptionOptions}
        agentOptions={agentOptions}
        // Pass all relevant callbacks
        onReady={/*...*/}
        onTranscriptUpdate={/*...*/}
        onAgentStateChange={/*...*/}
        onAgentUtterance={/*...*/}
        onUserMessage={/* handleUserMessage */}
        onError={/*...*/}
        onPlaybackStateChange={(playing) => console.log('Agent playing:', playing)}
        debug={true}
      />
      
      <div>
        {/* Add buttons for Start, Stop, Interrupt, Inject Message, Toggle Sleep, Update Context etc. */}
      </div>
      
      {/* Display relevant state */}
      <h2>Agent State: {agentState}</h2>
      <h2>Live Transcript:</h2>
      <p>{lastTranscript || '(Waiting...)'}</p>
      <h2>Last Agent Response:</h2>
      <p>{lastAgentResponse || '(Waiting...)'}</p>
      <h2>Last User Message (from Server):</h2> {/* Added display for user message */}
      <p>{/* Display user message state */}</p>
    </div>
  );
}

export default CombinedInteraction;
```

## Core Concepts

*   **Headless Component:** This component manages all the background work (audio, WebSockets, state) but renders **no UI**. You build your interface using standard React components and connect it using the component's `ref` and callback `props`.
*   **Three Operating Modes:** The component can run in Transcription Only mode, Agent Only mode, or Dual mode (both services). Simply include or omit the corresponding options props (`transcriptionOptions` and/or `agentOptions`).
*   **Control via Ref:** Use `React.useRef` to create a reference to the component instance. This `ref.current` provides access to control methods:
    *   `start()`: Initializes connections and starts microphone capture.
    *   `stop()`: Stops microphone capture and closes connections.
    *   `interruptAgent()`: Immediately stops any agent audio playback and clears the queue.
    *   `sleep()`: Puts the agent into a state where it ignores audio input.
    *   `wake()`: Wakes the agent from the sleep state.
    *   `toggleSleep()`: Switches between active and sleep states.
    *   `updateAgentInstructions(payload)`: Sends new context or instructions to the agent mid-conversation.
    *   `injectAgentMessage(message: string)`: Sends a message directly into the agent conversation programmatically. 
*   **Configuration via Props:** Configure the component's behavior by passing props:
    *   `apiKey`: Your Deepgram API key (required).
    *   `transcriptionOptions`: An object matching Deepgram's `/v1/listen` query parameters. **Omit completely** (not just `{}`) when not using transcription.
    *   `agentOptions`: An object defining the agent's configuration. **Omit completely** (not just `{}`) when not using agent.
    *   `endpointConfig`: Optionally override the default Deepgram WebSocket URLs (useful for dedicated deployments).
    *   `debug`: Set to `true` to enable verbose logging in the browser console.
*   **Data/Events via Callbacks:** The component communicates back to your application using callback functions passed as props:
    *   `onReady(isReady: boolean)`: Indicates if the component is initialized and ready to start.
    *   `onConnectionStateChange(service: ServiceType, state: ConnectionState)`: Reports status changes ('connecting', 'connected', 'error', 'closed') for 'transcription' and 'agent' services.
    *   `onTranscriptUpdate(transcriptData: TranscriptResponse)`: Delivers live transcription results (both interim and final). Check `transcriptData.is_final`.
    *   `onAgentStateChange(state: AgentState)`: Reports the agent's current state ('idle', 'listening', 'thinking', 'speaking', 'entering_sleep', 'sleeping').
    *   `onAgentUtterance(utterance: LLMResponse)`: Provides the text content generated by the agent.
    *   `onUserMessage(message: UserMessageResponse)`: Provides user messages received from the server (from `ConversationText` events with `role:user`).
    *   `onUserStartedSpeaking()` / `onUserStoppedSpeaking()`: Triggered based on voice activity detection from both agent and transcription services. The agent service sends `UserStartedSpeaking`/`UserStoppedSpeaking` events, while the transcription service sends `SpeechStarted`/`SpeechStopped` events (when `vad_events` is enabled in `transcriptionOptions`). See [VAD Events Reference](docs/VAD-EVENTS-REFERENCE.md) for detailed information.
    *   `onPlaybackStateChange(isPlaying: boolean)`: Indicates if the agent audio is currently playing.
    *   `onError(error: DeepgramError)`: Reports errors from microphone access, WebSockets, or the Deepgram APIs.
*   **Microphone Input:** The component handles requesting microphone permissions from the user via the browser prompt. Once granted and `start()` is called, it uses the Web Audio API (`getUserMedia`, `AudioContext`, `AudioWorklet`) to capture audio. It automatically processes and streams this audio in the required format (Linear16 PCM, 16kHz default) to Deepgram's WebSocket endpoints.
*   **Audio Output (Agent):** Binary audio data received from the Agent WebSocket endpoint is automatically decoded and played back through the user's speakers using the Web Audio API. The playback queue is managed internally. The `interruptAgent()` method provides immediate cessation of playback.
*   **WebSocket Management:** The component encapsulates the creation, connection, authentication, and message handling for WebSockets connecting to both the Deepgram Transcription (`/v1/listen`) and Agent (`/v1/agent`) endpoints. Connection state is reported via `onConnectionStateChange`. Keepalives are handled automatically by the underlying manager.
*   **State Management:** Internal state (connection status, agent status, recording/playback status, etc.) is managed using `useReducer`. Relevant changes are communicated externally via the callback props.
*   **Sleep/Wake:** The `sleep()`, `wake()`, and `toggleSleep()` methods control the agent's active state. When sleeping, the component actively ignores VAD/transcription events and stops sending audio data to the agent service. An intermediate `entering_sleep` state handles potential race conditions during the transition.

## API Reference

### Props (`DeepgramVoiceInteractionProps`)

| Prop                    | Type                                                     | Required | Description                                                                                               |
| :---------------------- | :------------------------------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------- |
| `apiKey`                | `string`                                                 | Yes      | Your Deepgram API key.                                                                                    |
| `transcriptionOptions`  | `TranscriptionOptions`                                   | *        | Options for the transcription service. See `TranscriptionOptions` type & [Deepgram STT Docs][stt-docs]. **Omit completely** (not just `{}`) when not using transcription. |
| `agentOptions`          | `AgentOptions`                                           | *        | Options for the agent service. See `AgentOptions` type & [Deepgram Agent Docs][agent-docs]. **Omit completely** (not just `{}`) when not using agent. |
| `endpointConfig`        | `EndpointConfig` (`{ transcriptionUrl?, agentUrl? }`)    | No       | Override default Deepgram WebSocket URLs.                                                                 |
| `autoConnect`           | `boolean`                                                | No       | Whether to automatically connect when ready. Default: `undefined` (no auto-connect).                     |
| `microphoneEnabled`     | `boolean`                                                | No       | Whether microphone is enabled. Default: `false`.                                                          |
| `sleepOptions`          | `SleepOptions`                                           | No       | Configuration for agent sleep behavior.                                                                   |
| `onReady`               | `(isReady: boolean) => void`                             | No       | Called when the component is initialized and ready to start.                                              |
| `onConnectionStateChange`| `(service: ServiceType, state: ConnectionState) => void` | No       | Called when WebSocket connection state changes for 'transcription' or 'agent'.                            |
| `onTranscriptUpdate`    | `(transcriptData: TranscriptResponse) => void`           | No       | Called with live transcription results (interim & final).                                                 |
| `onAgentStateChange`    | `(state: AgentState) => void`                            | No       | Called when the agent's state changes.                                                                    |
| `onAgentUtterance`      | `(utterance: LLMResponse) => void`                       | No       | Called when the agent produces a text response.                                                           |
| `onUserMessage`         | `(message: UserMessageResponse) => void`                 | No       | Called when a user message is received from the server (`role:user`).                                     |
| `onUserStartedSpeaking` | `() => void`                                             | No       | Called when user speech starts (VAD).                                                                     |
| `onUserStoppedSpeaking` | `() => void`                                             | No       | Called when user speech stops (VAD).                                                                      |
| `onPlaybackStateChange` | `(isPlaying: boolean) => void`                           | No       | Called when agent audio playback starts or stops.                                                         |
| `onMicToggle`           | `(enabled: boolean) => void`                             | No       | Called when microphone state changes.                                                                     |
| `onConnectionReady`     | `() => void`                                             | No       | Called when dual mode connection is established.                                                          |
| `onAgentSpeaking`       | `() => void`                                             | No       | Called when agent starts speaking.                                                                        |
| `onAgentSilent`         | `() => void`                                             | No       | Called when agent finishes speaking.                                                                      |
| `onError`               | `(error: DeepgramError) => void`                         | No       | Called when an error occurs (mic, WebSocket, API, etc.).                                                  |
| `debug`                 | `boolean`                                                | No       | Enable verbose logging to the browser console.                                                            |

\* At least one of `transcriptionOptions` or `agentOptions` must be provided, otherwise the component will throw an error.

*[stt-docs]: https://developers.deepgram.com/docs/streaming-audio-overview
*[agent-docs]: https://developers.deepgram.com/docs/voice-agent-overview

### Control Methods (`DeepgramVoiceInteractionHandle`)

These methods are accessed via the `ref` attached to the component (e.g., `deepgramRef.current?.start()`).

| Method                    | Parameters                           | Return Type     | Description                                                                |
| :------------------------ | :----------------------------------- | :-------------- | :------------------------------------------------------------------------- |
| `start`                   | `none`                               | `Promise<void>` | Initializes connections, requests mic access, and starts recording/streaming. |
| `stop`                    | `none`                               | `Promise<void>` | Stops recording/streaming and closes WebSocket connections.                |
| `updateAgentInstructions` | `payload: UpdateInstructionsPayload` | `void`          | Sends new instructions or context to the agent mid-session. Only works in agent or dual mode. |
| `interruptAgent`          | `none`                               | `void`          | Immediately stops agent audio playback and clears the audio queue. Only works in agent or dual mode. |
| `sleep`                   | `none`                               | `void`          | Puts the agent into sleep mode (ignores audio input). Only works in agent or dual mode. |
| `wake`                    | `none`                               | `void`          | Wakes the agent from sleep mode. Only works in agent or dual mode. |
| `toggleSleep`             | `none`                               | `void`          | Toggles the agent between active and sleep states. Only works in agent or dual mode. |
| `injectAgentMessage`      | `message: string`                    | `void`          | Sends a message directly to the agent. Only works in agent or dual mode.    |

## Advanced Configuration

### Custom Endpoints

If you are using Deepgram's self-hosted solution or have dedicated endpoints, provide them via `endpointConfig`:

```tsx
<DeepgramVoiceInteraction
  // ...
  endpointConfig={{
    transcriptionUrl: 'wss://your-dg-instance.com/v1/listen',
    agentUrl: 'wss://your-dg-agent-instance.com/v1/agent' 
  }}
  // ...
/>
```

### Keyterm Prompting

To improve recognition of specific words or phrases, use the `keyterm` option within `transcriptionOptions`. **Note:** This currently only works with `model: 'nova-3'` and for English.

```tsx
<DeepgramVoiceInteraction
  // ...
  transcriptionOptions={{
    model: 'nova-3', // Required for keyterm
    language: 'en',  // Required for keyterm
    keyterm: ["Deepgram", "Casella", "Symbiosis", "Board Meeting AI"] 
  }}
  // ...
/>
```

The component handles appending each keyterm correctly to the WebSocket URL. Phrases with spaces are automatically encoded.

### Agent Configuration

The `agentOptions` prop allows detailed configuration of the voice agent. Refer to the `AgentOptions` type definition and the [Deepgram Agent Documentation][agent-docs] for available settings like:

*   `instructions`: Base prompt for the agent.
*   `voice`: The Aura voice model to use (e.g., `aura-asteria-en`).
*   `thinkModel`: The underlying LLM for thinking (e.g., `gpt-4o-mini`, `claude-3-haiku`).
*   `thinkProviderType`: The LLM provider (e.g., `open_ai`, `anthropic`).
*   `listenModel`: The STT model the agent uses internally (e.g., `nova-2`).
*   `greeting`: An optional initial greeting spoken by the agent.
*   ... and more.

## Performance Considerations

### Memoization Requirements
- Always memoize `agentOptions` and `transcriptionOptions` with `useMemo()`
- Inline objects cause infinite re-initialization and poor performance
- See [Critical: Options Props Must Be Memoized](#critical-options-props-must-be-memoized) section

### Resource Usage
- **Transcription Only**: Lightest weight, minimal resource usage
- **Agent Only**: Moderate usage, includes audio playback
- **Dual Mode**: Highest usage, two WebSocket connections + audio processing

### Optimization Tips
```tsx
// ✅ Good: Memoized options
const agentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-3',
  // ... other options
}), []); // Empty dependency array for static config

// ❌ Bad: Inline objects
<DeepgramVoiceInteraction
  agentOptions={{
    language: 'en',
    listenModel: 'nova-3',
  }}
/>
```

## Browser Compatibility

This component relies heavily on the **Web Audio API** (specifically `getUserMedia` and `AudioWorklet`) and the **WebSocket API**. It is primarily tested and optimized for modern **Chromium-based browsers** (Chrome, Edge). While it may work in other modern browsers like Firefox and Safari, full compatibility, especially concerning `AudioWorklet`, is not guaranteed.

### Browser Support Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|:------:|:-------:|:------:|:----:|
| Basic Transcription | ✅ | ✅ | ✅ | ✅ |
| Voice Agent | ✅ | ⚠️ | ⚠️ | ✅ |
| AudioWorklet | ✅ | ⚠️ | ⚠️ | ✅ |
| WebSocket | ✅ | ✅ | ✅ | ✅ |
| Microphone Access | ✅ | ✅ | ✅ | ✅ |

**Legend:** ✅ Fully Supported | ⚠️ Limited Support | ❌ Not Supported

**Notes:**
- Firefox and Safari have limited AudioWorklet support
- Voice agent functionality may be degraded on non-Chromium browsers
- WebSocket connections work across all modern browsers

## Troubleshooting / Debugging

*   **Enable Debug Logs:** Pass the `debug={true}` prop to the component. This will print detailed logs from the component's internal operations, state changes, WebSocket messages, and audio processing steps to the browser's developer console. Look for messages prefixed with `[DeepgramVoiceInteraction]` and `[SLEEP_CYCLE]`.
*   **Check API Key:** Ensure your Deepgram API key is correct and has the necessary permissions.
*   **Microphone Permissions:** Make sure the user has granted microphone access permissions to your site in the browser. Check browser settings if the prompt doesn't appear.
*   **Network Tab:** Use your browser's developer tools (Network tab, filtered to WS/WebSockets) to inspect the WebSocket connections, messages being sent/received, and any connection errors.
*   **Console Errors:** Check the browser console for any JavaScript errors originating from the component or its dependencies.
*   **Callback Handlers:** Ensure your callback functions passed as props (`onTranscriptUpdate`, `onError`, etc.) are correctly defined and handle the data/errors appropriately.
*   **Mode Configuration:** If the wrong services are being initialized, verify that you're correctly including or omitting the `transcriptionOptions` and `agentOptions` props based on your needs.

## Error Handling

### Common Error Scenarios
- **API Key Invalid**: Check `onError` callback for authentication errors
- **Microphone Denied**: Handle permission errors gracefully
- **Network Issues**: Implement retry logic for connection failures
- **Invalid Options**: Validate options before passing to component

### Error Recovery Patterns
```tsx
const handleError = (error) => {
  switch (error.code) {
    case 'invalid_api_key':
      // Show API key input
      setShowApiKeyInput(true);
      break;
    case 'microphone_denied':
      // Show microphone permission request
      setShowMicPermission(true);
      break;
    case 'connection_failed':
      // Implement retry logic
      setTimeout(() => {
        deepgramRef.current?.start();
      }, 1000);
      break;
    default:
      console.error('Deepgram error:', error);
  }
};

<DeepgramVoiceInteraction
  apiKey={apiKey}
  onError={handleError}
  // ... other props
/>
```

### Error Types
- `DeepgramError`: Base error type with `code` and `message` properties
- `MicrophoneError`: Microphone access or permission issues
- `WebSocketError`: Connection or communication failures
- `APIError`: Deepgram API-specific errors

## Common Patterns

### Voice Assistant with Text Fallback
```tsx
const [micEnabled, setMicEnabled] = useState(false);
const [response, setResponse] = useState('');

const agentOptions = useMemo(() => ({
  instructions: "You are a helpful voice assistant.",
  voice: "aura-asteria-en",
  greeting: "Hello! How can I help you today?"
}), []);

return (
  <DeepgramVoiceInteraction
    apiKey={apiKey}
    autoConnect={true}
    microphoneEnabled={micEnabled}
    onMicToggle={setMicEnabled}
    agentOptions={agentOptions}
    onAgentUtterance={(utterance) => setResponse(utterance.text)}
  />
);
```

### Transcription with Live Display
```tsx
const [transcript, setTranscript] = useState('');

const transcriptionOptions = useMemo(() => ({
  model: 'nova-2',
  language: 'en-US',
  interim_results: true
}), []);

return (
  <div>
    <DeepgramVoiceInteraction
      apiKey={apiKey}
      transcriptionOptions={transcriptionOptions}
      onTranscriptUpdate={(data) => 
        setTranscript(data.channel.alternatives[0].transcript)
      }
    />
    <div>{transcript}</div>
  </div>
);
```

### Dual Mode with Full Control
```tsx
const [isReady, setIsReady] = useState(false);
const [isConnected, setIsConnected] = useState(false);

const agentOptions = useMemo(() => ({
  instructions: "You are a meeting assistant.",
  voice: "aura-asteria-en"
}), []);

const transcriptionOptions = useMemo(() => ({
  model: 'nova-2',
  language: 'en-US'
}), []);

return (
  <DeepgramVoiceInteraction
    apiKey={apiKey}
    autoConnect={true}
    agentOptions={agentOptions}
    transcriptionOptions={transcriptionOptions}
    onReady={setIsReady}
    onConnectionReady={() => setIsConnected(true)}
    onTranscriptUpdate={(data) => console.log('Transcript:', data)}
    onAgentUtterance={(utterance) => console.log('Agent:', utterance.text)}
  />
);
```

## Frequently Asked Questions

### Q: Why do I need to memoize options props?
A: The component's useEffect depends on these props. Inline objects create new references on every render, causing infinite re-initialization loops.

### Q: Can I use this without a microphone?
A: Yes! Set `autoConnect={true}` and use text input. The agent will work without audio.

### Q: How do I handle microphone permissions?
A: The component handles this automatically. Check the `onError` callback for permission-related errors.

### Q: Can I use custom Deepgram endpoints?
A: Yes, use the `endpointConfig` prop to specify custom WebSocket URLs.

### Q: What's the difference between transcription and agent modes?
A: Transcription mode only converts speech to text. Agent mode provides AI conversation capabilities. Dual mode does both.

### Q: How do I interrupt the agent while it's speaking?
A: Use the `interruptAgent()` method or start speaking (if microphone is enabled) to interrupt.

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Create local package for testing
npm run package:local
```

### Release Management

The project includes automated tools for creating release issues and managing the release process:

```bash
# Create a patch release issue and working branch
npm run release:issue 0.4.2 patch

# Create a minor release issue and working branch  
npm run release:issue 0.5.0 minor

# Create a major release issue and working branch
npm run release:issue 1.0.0 major
```

This script will:
1. Validate that your working directory is clean
2. Switch to the main branch and pull latest changes
3. Create a GitHub issue with the appropriate release checklist
4. Create a new working branch named `issueNNN` (where NNN is the issue number)
5. Switch you to that branch ready to start release work

For detailed development information, see [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## License

MIT 