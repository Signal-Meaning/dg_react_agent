# Deepgram Voice Agent Protocol Documentation

## Overview

This document provides a comprehensive analysis of the actual Deepgram Voice Agent protocol as implemented in the `dg_react_agent` package. This is based on thorough code analysis and differs from the theoretical protocol analysis provided earlier.

## Key Findings

### 1. **No Welcome-First Flow by Default**
The current implementation does **NOT** support a welcome-first flow. The agent only sends a greeting when:
- The user explicitly calls `start()` method
- The agent WebSocket connects and sends Settings
- The agent receives a `SettingsApplied` response
- **Only then** does the agent potentially send a greeting

### 2. **Component Initialization Flow**
```
1. Component mounts
2. AudioManager initializes
3. WebSocket managers created (but not connected)
4. Component reports `isReady: true`
5. Component waits for user to call `start()`
6. User calls `start()` → WebSockets connect
7. Agent sends Settings message
8. Agent receives SettingsApplied
9. Agent may send greeting (if configured)
```

### 3. **Actual State Machine**
The real state machine is much simpler than the theoretical one:

```
DISCONNECTED → READY → [USER CALLS start()] → CONNECTING → CONNECTED → [AGENT RESPONSES]
```

## Detailed Protocol Analysis

### Component Modes

The component supports three modes:

1. **Dual Mode** (Transcription + Agent): Both `transcriptionOptions` and `agentOptions` provided
2. **Transcription-Only Mode**: Only `transcriptionOptions` provided
3. **Agent-Only Mode**: Only `agentOptions` provided

### WebSocket Endpoints

- **Transcription**: `wss://api.deepgram.com/v1/listen`
- **Agent**: `wss://agent.deepgram.com/v1/agent/converse`

### Authentication

Uses WebSocket subprotocol: `['token', apiKey]`

### Agent Protocol Messages

#### Outgoing Messages (Client → Server)

1. **Settings** (sent immediately after connection)
```json
{
  "type": "Settings",
  "audio": {
    "input": {
      "encoding": "linear16",
      "sample_rate": 16000
    },
    "output": {
      "encoding": "linear16", 
      "sample_rate": 24000
    }
  },
  "agent": {
    "language": "en",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "nova-2"
      }
    },
    "think": {
      "provider": {
        "type": "open_ai",
        "model": "gpt-4o-mini"
      },
      "prompt": "You are a helpful voice assistant."
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "model": "aura-asteria-en"
      }
    },
    "greeting": "Hello! How can I help you?"
  }
}
```

2. **UpdatePrompt** (dynamic prompt updates)
3. **UpdateSpeak** (TTS parameter updates)
4. **InjectAgentMessage** (inject agent message)
5. **FunctionCallResponse** (respond to function calls)
6. **KeepAlive** (heartbeat)

#### Incoming Messages (Server → Client)

1. **Welcome** - Initial greeting from agent
2. **SettingsApplied** - Confirmation of settings
3. **ConversationText** - Text content (user or assistant)
4. **UserStartedSpeaking** - VAD event
5. **AgentThinking** - Agent processing
6. **AgentStartedSpeaking** - TTS beginning
7. **AgentAudioDone** - TTS finished
8. **FunctionCallRequest** - Agent wants to call function
9. **Error** - Error messages
10. **Warning** - Warning messages

### State Transitions

The actual state transitions are:

```
idle → listening (on UserStartedSpeaking)
listening → thinking (on UserStoppedSpeaking)
thinking → speaking (on AgentStartedSpeaking)
speaking → idle (on AgentAudioDone)
```

### Critical Issues with Current Implementation

1. **No Automatic Welcome**: The agent does not automatically send a greeting on connection
2. **Manual Start Required**: User must explicitly call `start()` method
3. **No Text-Only Mode**: The component always requires audio initialization
4. **Microphone Always Enabled**: Once started, microphone is always active

## Recommended Protocol Modifications

To achieve the desired welcome-first behavior, the following changes are needed:

### 1. Auto-Start Option
Add an `autoStart` prop to automatically call `start()` when ready:

```typescript
interface DeepgramVoiceInteractionProps {
  // ... existing props
  autoStart?: boolean; // New prop
}
```

### 2. Text-Only Mode
Add a `textOnly` prop to disable audio requirements:

```typescript
interface DeepgramVoiceInteractionProps {
  // ... existing props
  textOnly?: boolean; // New prop
}
```

### 3. Microphone Control
Add explicit microphone control:

```typescript
interface DeepgramVoiceInteractionProps {
  // ... existing props
  microphoneEnabled?: boolean; // New prop
  onMicrophoneToggle?: (enabled: boolean) => void; // New callback
}
```

### 4. Welcome-First Flow
Modify the agent connection flow to:
1. Connect agent WebSocket
2. Send Settings
3. Wait for SettingsApplied
4. Automatically send greeting (if configured)
5. Wait for user to enable microphone

## Implementation Recommendations

### For Welcome-First Behavior

1. **Modify the component** to support `autoStart` and `textOnly` modes
2. **Add microphone control** to disable until user interaction
3. **Implement greeting flow** that doesn't require microphone
4. **Add state management** for microphone enabled/disabled

### For Protocol Validation

1. **Create comprehensive tests** that validate the actual protocol flow
2. **Test all message types** as they are actually implemented
3. **Validate state transitions** according to the real state machine
4. **Test error handling** for all failure scenarios

## Conclusion

The current `dg_react_agent` implementation does not support the desired welcome-first flow. Significant modifications are needed to achieve this behavior. The protocol is simpler than the theoretical analysis suggested, but lacks the flexibility needed for optimal user experience.

The key insight is that the component is designed as a low-level WebSocket wrapper that requires explicit user interaction to start, rather than a high-level conversational interface that can proactively engage users.
