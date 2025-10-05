# Product Specification: Welcome-First Voice Agent

## Overview

Transform the `dg_react_agent` from a manual-start component to a proactive conversational interface that automatically greets users and provides controlled microphone access.

## Requirements

### Core Functionality
1. **Automatic Welcome**: Agent sends greeting message immediately upon connection without user interaction
2. **Microphone Control**: Microphone remains disabled until user explicitly enables it
3. **Text-Only Mode**: Support text-driven conversations without requiring audio
4. **Barge-In Support**: User can interrupt agent speech by starting to speak

### User Experience
- **Proactive Engagement**: Agent greets user immediately when component loads
- **Controlled Audio**: User decides when to enable microphone
- **Seamless Text Input**: Users can type messages without microphone
- **Interrupt Capability**: Users can interrupt agent speech naturally

## Technical Requirements

### New Props
```typescript
interface DeepgramVoiceInteractionProps {
  welcomeFirst?: boolean;                    // Auto-connect and send greeting
  microphoneEnabled?: boolean;               // Control microphone state
  onMicToggle?: (enabled: boolean) => void; // Microphone toggle callback
  onWelcomeReceived?: () => void;            // Welcome message received
  onGreetingStarted?: () => void;            // Greeting TTS started
  onGreetingComplete?: () => void;           // Greeting TTS completed
}
```

### State Management
- Track welcome message status
- Manage microphone enabled/disabled state
- Handle greeting in progress state
- Support barge-in during greeting

### Protocol Flow
1. Component mounts
2. AudioManager initializes
3. Agent WebSocket connects automatically
4. Settings message sent
5. SettingsApplied received
6. Welcome message sent immediately
7. Microphone remains disabled until user toggle

## Success Criteria
- ✅ Agent greets user without manual start
- ✅ Microphone disabled by default
- ✅ Text input works without microphone
- ✅ User can interrupt agent speech
- ✅ All existing functionality preserved
- ✅ Comprehensive test coverage

## Implementation Approach
- Modify core `DeepgramVoiceInteraction` component
- Add new props and state management
- Implement automatic connection flow
- Add microphone control logic
- Support text-only conversations
- Add comprehensive testing

## Target Module
All changes target the `dg_react_agent` module:
- Core component modifications
- Test app updates
- Documentation updates
- Protocol validation tests
