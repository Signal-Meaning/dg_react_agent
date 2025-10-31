# Agent State Transitions Test Documentation

## Purpose and Scope

This test file (`agent-state-transitions.spec.js`) focuses on **core agent state transitions** during conversation flow. It validates the fundamental state machine behavior: idle → speaking → idle for text input scenarios.

**Key Principle**: Each test validates a unique state transition sequence that demonstrates a specific requirement.

## Test Coverage Strategy

### What This File Tests

1. **Text Input State Transitions**
   - `idle → speaking → idle` - Basic text message flow
   - Validates that TTS playback triggers `speaking` state
   - Validates that playback completion triggers `idle` state

2. **Tool-Triggered State Transitions** (skipped until Issue #212)
   - `idle → thinking → speaking → idle` - When tools trigger AgentThinking message
   - This test is skipped and will be enabled when tool-triggered conversations are implemented

### What This File Does NOT Test (Covered Elsewhere)

1. **Voice Input State Transitions** - Covered by:
   - `vad-redundancy-and-agent-timeout.spec.js` - Comprehensive voice interaction with state validation
   - `idle-timeout-behavior.spec.js` - Voice interaction timeout behavior
   - Other VAD/audio test suites validate state transitions during voice interactions

2. **Idle Timeout Behavior** - Covered by:
   - `idle-timeout-behavior.spec.js` - Idle timeout behavior in various scenarios
   - `vad-redundancy-and-agent-timeout.spec.js` - Agent state timeout behavior during voice interactions

3. **Agent Interruption Scenarios** - Covered by:
   - `audio-interruption-timing.spec.js` - Interruption behavior and timing

## Design Decisions

### Why Voice Tests Are Separate

Voice input state transitions require different validation:
- Voice interactions transition through `listening` state (text input does not)
- VAD events and audio simulation add complexity
- Voice tests require microphone helpers and audio simulation utilities
- These concerns are better organized in dedicated VAD/voice test suites

### Why AgentThinking Requires Tools

According to Deepgram documentation, `AgentThinking` is triggered when the conversation triggers a tool call. Since the test-app doesn't currently support tool-triggered conversations (Issue #212), the thinking state cannot be validated in E2E tests with real APIs. The test is skipped until tools are implemented.

**Note**: `AgentThinking` message handling is validated by unit tests:
- `tests/agent-state-handling.test.ts` - AgentThinking message handling logic
- `tests/event-handling.test.js` - Event handling including AgentThinking

## System Requirements Coverage

Based on Issue #190 and Deepgram Voice Agent API documentation:

1. ✅ **State transitions for text input**: `idle → speaking → idle`
2. ⏸️ **State transitions for tool triggers**: `idle → thinking → speaking → idle` (blocked by Issue #212)
3. ✅ **Component correctly responds to playback events**: Playback `playing` event triggers `speaking` state
4. ✅ **Component correctly responds to playback completion**: Playback stop triggers `idle` state
5. ✅ **Final state validation**: Conversations end in `idle` state (not `speaking` or `listening`)

## Implementation Notes

### Playback Event → Speaking State

The component transitions to `speaking` state when:
1. `AgentStartedSpeaking` message is received from Deepgram (primary mechanism)
2. Audio playback starts (`playing` event from AudioManager) - fallback mechanism

The playback event handler ensures reliable state transitions even if `AgentStartedSpeaking` is delayed or not received:

```typescript
// From src/components/DeepgramVoiceInteraction/index.tsx
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  if (currentState !== 'speaking') {
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  }
}
```

### TTS Muting Behavior

- TTS is unmuted by default (`allowAgentRef` defaults to `ALLOW_AUDIO=true`)
- The test-app respects button state - if button shows muted, TTS won't play
- Tests assume default unmuted state (fresh page load)
- The component uses `allowAgentRef` to control whether audio buffers are processed

## Future Enhancements

### Potential Additions (When Relevant)

1. **Tool-triggered thinking test** - Enable when Issue #212 is implemented
2. **Edge case validations**:
   - State recovery after errors
   - Concurrent state changes (if multiple events arrive simultaneously)
   - State during reconnection (if connection drops/reconnects)

### Out of Scope

- Voice interaction tests (covered by VAD test suites)
- Idle timeout validation during states (covered by timeout test suites)
- Agent interruption scenarios (covered by interruption tests)
- Microphone activation flows (covered by microphone tests)

## Related Issues

- **Issue #190**: Missing Agent State Handlers - Original requirement for these tests
- **Issue #212**: Tool-triggered conversations - Required for thinking state E2E validation
