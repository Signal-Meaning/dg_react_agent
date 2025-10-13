# Migration Guide: v0.x to v1.0.0

## Overview

This guide helps you migrate from dg_react_agent v0.x to v1.0.0. While v1.0.0 introduces significant new features, most existing implementations should work with minimal changes.

## Breaking Changes

### ⚠️ State Interface Changes

#### New State Properties
The state interface has been expanded with new properties. Existing code will continue to work, but you may want to utilize the new properties.

**Before (v0.x):**
```typescript
interface VoiceInteractionState {
  isReady: boolean;
  connections: Record<string, ConnectionState>;
  agentState: AgentState;
  microphonePermission: PermissionState;
  isRecording: boolean;
  isPlaying: boolean;
  error: string | null;
  micEnabledInternal: boolean;
  hasSentSettings: boolean;
  welcomeReceived: boolean;
  greetingInProgress: boolean;
  greetingStarted: boolean;
  isNewConnection: boolean;
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
}
```

**After (v1.0.0):**
```typescript
interface VoiceInteractionState {
  // Existing properties (unchanged)
  isReady: boolean;
  connections: Record<string, ConnectionState>;
  agentState: AgentState;
  microphonePermission: PermissionState;
  isRecording: boolean;
  isPlaying: boolean;
  error: string | null;
  micEnabledInternal: boolean;
  hasSentSettings: boolean;
  welcomeReceived: boolean;
  greetingInProgress: boolean;
  greetingStarted: boolean;
  isNewConnection: boolean;
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  
  // NEW: VAD-related state properties
  isUserSpeaking: boolean;
  lastUserSpeechTime: number | null;
  currentSpeechDuration: number | null;
  utteranceEndData: UtteranceEndData | null;
}
```

#### Migration Steps for State Changes
1. **No immediate action required** - new properties are optional
2. **Update TypeScript interfaces** if you're extending the state
3. **Utilize new VAD properties** for enhanced user experience

**Example:**
```typescript
// Before
const { isReady, agentState } = state;

// After (optional enhancement)
const { isReady, agentState, isUserSpeaking, utteranceEndData } = state;

// Use new VAD properties
if (isUserSpeaking) {
  console.log('User is currently speaking');
}

if (utteranceEndData) {
  console.log('Utterance ended:', utteranceEndData);
}
```

### ⚠️ Callback Signature Changes

#### New Callback Parameters
Some callbacks now include additional parameters for VAD events.

**Before (v0.x):**
```typescript
interface DeepgramVoiceInteractionProps {
  onUserStartedSpeaking?: () => void;
  onAgentSilent?: () => void;
  onAgentSpeaking?: () => void;
  onAgentResponse?: (response: string) => void;
  onError?: (error: string) => void;
}
```

**After (v1.0.0):**
```typescript
interface DeepgramVoiceInteractionProps {
  // Existing callbacks (unchanged)
  onUserStartedSpeaking?: () => void;
  onAgentSilent?: () => void;
  onAgentSpeaking?: () => void;
  onAgentResponse?: (response: string) => void;
  onError?: (error: string) => void;
  
  // NEW: VAD event callbacks
  onUserStoppedSpeaking?: () => void;
  onUtteranceEnd?: (data: UtteranceEndData) => void;
  onVADEvent?: (event: VADEvent) => void;
}
```

#### Migration Steps for Callbacks
1. **No immediate action required** - new callbacks are optional
2. **Add new callbacks** if you want VAD event handling
3. **Update TypeScript interfaces** if you're extending the props

**Example:**
```typescript
// Before
<DeepgramVoiceInteraction
  onUserStartedSpeaking={() => console.log('User started speaking')}
  onAgentResponse={(response) => console.log('Agent response:', response)}
/>

// After (with new VAD callbacks)
<DeepgramVoiceInteraction
  onUserStartedSpeaking={() => console.log('User started speaking')}
  onUserStoppedSpeaking={() => console.log('User stopped speaking')}
  onUtteranceEnd={(data) => console.log('Utterance ended:', data)}
  onVADEvent={(event) => console.log('VAD event:', event)}
  onAgentResponse={(response) => console.log('Agent response:', response)}
/>
```

### ⚠️ Error Handling Changes

#### Enhanced Error Objects
Error handling has been improved with more detailed error information.

**Before (v0.x):**
```typescript
onError?: (error: string) => void;
```

**After (v1.0.0):**
```typescript
onError?: (error: string) => void; // Still supported
// Enhanced error handling available through state
// error property now includes more detailed information
```

#### Migration Steps for Error Handling
1. **No immediate action required** - existing error handling continues to work
2. **Enhance error handling** by utilizing the improved error state
3. **Add error recovery** using the new error handling capabilities

**Example:**
```typescript
// Before
const handleError = (error: string) => {
  console.error('Error:', error);
  setErrorMessage(error);
};

// After (enhanced)
const handleError = (error: string) => {
  console.error('Error:', error);
  setErrorMessage(error);
  
  // Enhanced error handling
  if (error.includes('WebSocket')) {
    // Handle WebSocket errors specifically
    attemptReconnection();
  } else if (error.includes('Audio')) {
    // Handle audio errors specifically
    resetAudioManager();
  }
};
```

## New Features

### 🎤 Voice Activity Detection (VAD) Events

#### UserStoppedSpeaking Event
Detect when the user stops speaking.

```typescript
<DeepgramVoiceInteraction
  onUserStoppedSpeaking={() => {
    console.log('User stopped speaking');
    // Handle user stopping speech
  }}
/>
```

#### UtteranceEnd Event
Detect the end of user utterances with detailed information.

```typescript
<DeepgramVoiceInteraction
  onUtteranceEnd={(data) => {
    console.log('Utterance ended:', data);
    // data includes: duration, timestamp, confidence, etc.
  }}
/>
```

#### VADEvent Callback
Comprehensive VAD event handling.

```typescript
<DeepgramVoiceInteraction
  onVADEvent={(event) => {
    console.log('VAD event:', event);
    // Handle all VAD events in one place
  }}
/>
```

### 🔄 Lazy Reconnection with Context

#### Conversation Context Preservation
Maintain conversation history across disconnections.

```typescript
// Context is automatically preserved
const { conversationHistory, sessionId } = state;

// Manual reconnection with context
const resumeWithText = async (text: string) => {
  // Reconnects with full conversation context
  await deepgramRef.current?.resumeWithText(text);
};
```

#### Session Management
Automatic session ID generation and tracking.

```typescript
// Session ID is automatically managed
const { sessionId } = state;
console.log('Current session:', sessionId);
```

### 🎯 Enhanced State Management

#### Real-time VAD State
Track user speaking state in real-time.

```typescript
const { isUserSpeaking, lastUserSpeechTime, currentSpeechDuration } = state;

if (isUserSpeaking) {
  console.log('User is speaking for', currentSpeechDuration, 'ms');
}
```

#### Utterance End Data
Access detailed utterance end information.

```typescript
const { utteranceEndData } = state;

if (utteranceEndData) {
  console.log('Last utterance duration:', utteranceEndData.duration);
  console.log('Confidence:', utteranceEndData.confidence);
}
```

## Step-by-Step Migration

### Step 1: Update Dependencies

```bash
npm install deepgram-voice-interaction-react@^1.0.0
```

### Step 2: Review Breaking Changes

1. **Check state interface usage** - ensure compatibility with new properties
2. **Review callback implementations** - consider adding new VAD callbacks
3. **Update error handling** - utilize enhanced error information

### Step 3: Add New Features (Optional)

1. **Add VAD event handling** for enhanced user experience
2. **Implement lazy reconnection** for better connection management
3. **Utilize enhanced state** for improved UI responsiveness

### Step 4: Test Migration

1. **Run existing tests** - ensure they still pass
2. **Test new features** - verify VAD events work correctly
3. **Test error scenarios** - ensure error handling works properly

### Step 5: Deploy

1. **Deploy to staging** - test in staging environment
2. **Monitor for issues** - watch for any migration-related problems
3. **Deploy to production** - deploy when confident

## Common Migration Issues

### Issue 1: TypeScript Errors

**Problem:** TypeScript errors due to new state properties.

**Solution:**
```typescript
// Update your state interface extensions
interface MyCustomState extends VoiceInteractionState {
  // Your custom properties
  customProperty: string;
}
```

### Issue 2: Missing VAD Events

**Problem:** Not receiving VAD events.

**Solution:**
```typescript
// Ensure VAD events are properly configured
<DeepgramVoiceInteraction
  onUserStoppedSpeaking={() => console.log('User stopped')}
  onUtteranceEnd={(data) => console.log('Utterance ended:', data)}
  onVADEvent={(event) => console.log('VAD event:', event)}
/>
```

### Issue 3: Connection Issues

**Problem:** Connection problems after migration.

**Solution:**
```typescript
// Check connection state and implement lazy reconnection
const { connections } = state;

if (connections.agent === 'disconnected') {
  // Use lazy reconnection
  await deepgramRef.current?.resumeWithText('Hello');
}
```

## Testing Your Migration

### Unit Tests
```typescript
// Test new state properties
expect(state.isUserSpeaking).toBeDefined();
expect(state.utteranceEndData).toBeDefined();

// Test new callbacks
const mockOnUserStoppedSpeaking = jest.fn();
const mockOnUtteranceEnd = jest.fn();

// Test callback invocation
expect(mockOnUserStoppedSpeaking).toHaveBeenCalled();
expect(mockOnUtteranceEnd).toHaveBeenCalledWith(expect.any(Object));
```

### Integration Tests
```typescript
// Test VAD events
await waitFor(() => {
  expect(onUserStoppedSpeaking).toHaveBeenCalled();
});

// Test lazy reconnection
await deepgramRef.current?.resumeWithText('Test message');
expect(connections.agent).toBe('connected');
```

### E2E Tests
```typescript
// Test VAD events in browser
await page.waitForSelector('[data-testid="user-stopped-speaking"]');

// Test lazy reconnection
await page.click('[data-testid="resume-text-button"]');
await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")');
```

## Rollback Plan

If you encounter issues after migration:

### Step 1: Immediate Rollback
```bash
npm install deepgram-voice-interaction-react@^0.x
```

### Step 2: Remove New Features
Remove any new VAD event handling code:
```typescript
// Remove these if causing issues
onUserStoppedSpeaking={...}
onUtteranceEnd={...}
onVADEvent={...}
```

### Step 3: Revert State Usage
Revert to using only the original state properties:
```typescript
// Use only original properties
const { isReady, agentState, isRecording } = state;
```

## Support

### Getting Help
- **GitHub Issues**: Create an issue for migration questions
- **Documentation**: Check [NEW-FEATURES.md](./NEW-FEATURES.md) for detailed feature docs
- **Examples**: Review [EXAMPLES.md](./EXAMPLES.md) for usage patterns

### Reporting Issues
When reporting migration issues:
1. Include version information (from/to)
2. Provide complete error messages
3. Include relevant code examples
4. Describe steps taken before the issue

## Migration Checklist

- [ ] **Dependencies Updated**: Installed v1.0.0
- [ ] **Breaking Changes Reviewed**: Checked state interface and callbacks
- [ ] **New Features Added**: Implemented VAD events (optional)
- [ ] **Tests Updated**: Updated tests for new features
- [ ] **Migration Tested**: Tested in development environment
- [ ] **Staging Deployed**: Deployed and tested in staging
- [ ] **Production Deployed**: Deployed to production
- [ ] **Monitoring Active**: Monitoring for issues

## Next Steps

After successful migration:
1. **Explore New Features**: Utilize VAD events and lazy reconnection
2. **Optimize Performance**: Take advantage of performance improvements
3. **Enhance UX**: Use enhanced state management for better user experience
4. **Stay Updated**: Follow future releases for additional features

---

**Related Documentation:**
- [NEW-FEATURES.md](./NEW-FEATURES.md) - Detailed feature documentation
- [API-CHANGES.md](./API-CHANGES.md) - Complete API surface changes
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples and patterns
