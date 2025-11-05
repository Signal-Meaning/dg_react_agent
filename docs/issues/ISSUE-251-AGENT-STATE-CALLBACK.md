# Issue #251: onAgentStateChange('speaking') not called when TTS playback starts

**Status**: 🔴 OPEN  
**Priority**: HIGH  
**Created**: January 2025  
**Branch**: `davidrmcgee/issue251`  
**Related**: Voice Commerce Issue #418

## 🎯 Executive Summary

The component does NOT call `onAgentStateChange('speaking')` when TTS playback starts, even though it calls `onPlaybackStateChange(true)`. This breaks the expected behavior where applications should be able to detect the 'speaking' state via `onAgentStateChange`.

## 📋 Problem Statement

### Expected Behavior

When TTS playback starts, the library should call:
1. ✅ `onPlaybackStateChange(true)` - Currently works
2. ❌ `onAgentStateChange('speaking')` - Currently missing

### Actual Behavior

- ✅ `onPlaybackStateChange(true)` is called when TTS playback starts
- ❌ `onAgentStateChange('speaking')` is NOT called when TTS playback starts
- ❌ Application's internal `agentState` remains `'idle'` instead of transitioning to `'speaking'`

## 🔍 Root Cause Analysis

The component has two mechanisms to transition to 'speaking' state:

### 1. AgentStartedSpeaking Message Handler

```2124:2133:src/components/DeepgramVoiceInteraction/index.tsx
if (data.type === 'AgentStartedSpeaking') {
  console.log('🗣️ [AGENT EVENT] AgentStartedSpeaking received');
  console.log('🎯 [AGENT] AgentStartedSpeaking received - transitioning to speaking state');
  sleepLog('Dispatching AGENT_STATE_CHANGE to speaking');
  dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });

  // Track agent speaking
  if (state.greetingInProgress && !state.greetingStarted) {
    dispatch({ type: 'GREETING_STARTED', started: true });
  }
  
  return;
}
```

### 2. Audio Playback Event Handler (Fallback)

```2120:2133:src/components/DeepgramVoiceInteraction/index.tsx
// Transition agent to speaking when playback starts
// This is the primary mechanism for detecting TTS playback and transitioning to speaking state
// It handles cases where AgentStartedSpeaking message isn't received or is delayed
// This works for transitions from: idle -> speaking, thinking -> speaking, listening -> speaking
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  if (currentState !== 'speaking') {
    console.log(`🎯 [AGENT] Audio playback started - transitioning from ${currentState} to speaking`);
    sleepLog(`Dispatching AGENT_STATE_CHANGE to speaking (from playback start, previous state: ${currentState})`);
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  } else {
    console.log(`🎯 [AGENT] Audio playback started but already in speaking state - no transition needed`);
  }
}
```

### 3. Callback Trigger (useEffect)

```850:857:src/components/DeepgramVoiceInteraction/index.tsx
// Notify agent state changes ONLY when the value actually changes
useEffect(() => {
  if (onAgentStateChange && state.agentState !== prevAgentStateRef.current) {
    log('Notifying parent: agentState changed to', state.agentState);
    onAgentStateChange(state.agentState);
    prevAgentStateRef.current = state.agentState;
  }
}, [state.agentState, onAgentStateChange]);
```

### The Race Condition

**Scenario 1: AgentStartedSpeaking arrives before playback**
- `AgentStartedSpeaking` handler dispatches `AGENT_STATE_CHANGE` to 'speaking'
- State updates to 'speaking' internally
- Audio playback starts later
- Playback handler sees state is already 'speaking' and skips dispatch (line 2126 check)
- If React hasn't fired the useEffect yet (due to batching/timing), `onAgentStateChange('speaking')` may not be called
- The playback path doesn't trigger it because state is already 'speaking'

**Scenario 2: Playback starts before AgentStartedSpeaking**
- Audio playback starts
- Playback handler dispatches `AGENT_STATE_CHANGE` to 'speaking' (if state wasn't already 'speaking')
- State updates to 'speaking'
- useEffect should fire and call `onAgentStateChange('speaking')`
- This scenario should work correctly

**Scenario 3: AgentStartedSpeaking arrives but state doesn't update**
- `AgentStartedSpeaking` handler dispatches `AGENT_STATE_CHANGE` to 'speaking'
- State update is batched/delayed by React
- Audio playback starts before state update completes
- Playback handler sees state is still not 'speaking' and dispatches again
- This should work, but could cause duplicate dispatches

## 🧪 Evidence

### Test Results from Voice Commerce

E2E test `should call onAgentStateChange("speaking") when TTS playback starts` FAILED:
- `agent-speaking` DOM element never became visible
- `agentState` remained `'idle'` throughout TTS playback
- Library only emitted `onPlaybackStateChange(true)` but not `onAgentStateChange('speaking')`

### Test Execution

```bash
USE_REAL_API_KEYS=true npx playwright test agent-state-transitions.e2e.test.js
```

**Test Output:**
```
❌ Test failed: Agent state did not transition to "speaking"
   This indicates the library is not calling onAgentStateChange("speaking") when TTS starts
```

## 💥 Impact

1. **Applications cannot detect speaking state** via `onAgentStateChange`
2. **State management is incomplete** - missing critical state transition
3. **Tests fail** - cannot verify agent speaking behavior
4. **Workaround required** - applications must use `onPlaybackStateChange(true)` instead

### Current Workaround

Applications are using `onPlaybackStateChange(true)` to detect when agent is speaking, but this is not ideal because:
- `onPlaybackStateChange` is about playback state, not agent state
- `onAgentStateChange` should be the authoritative source for agent state
- State machine completeness requires all states to be emitted

## 🎯 Solution Approach

### Option 1: Always Dispatch on Playback Start (Recommended)

Ensure `onAgentStateChange('speaking')` is called when TTS playback starts, even if the state is already 'speaking'. Modify the playback handler to always dispatch, but use a flag to prevent duplicate callbacks:

```typescript
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  if (currentState !== 'speaking') {
    // Normal transition - dispatch state change
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  } else {
    // State already 'speaking' but playback just started - ensure callback fires
    // Force a re-trigger of the callback by temporarily resetting prevAgentStateRef
    // OR directly call onAgentStateChange if state is already 'speaking'
    if (onAgentStateChange) {
      onAgentStateChange('speaking');
    }
  }
}
```

**Pros:**
- Guarantees callback fires when playback starts
- Handles both scenarios (AgentStartedSpeaking first or playback first)
- Minimal code change

**Cons:**
- May cause duplicate callback calls if state just changed
- Directly calls callback instead of going through state machine

### Option 2: Force State Update on Playback Start

Always dispatch state change on playback start, even if state is already 'speaking', and let the useEffect handle deduplication:

```typescript
if (event.isPlaying) {
  // Always dispatch - useEffect will handle deduplication
  dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
}
```

**Pros:**
- Simpler code
- Goes through normal state machine flow
- useEffect handles deduplication automatically

**Cons:**
- May cause unnecessary re-renders if state is already 'speaking'
- Still relies on useEffect timing for callback

### Option 3: Direct Callback in Playback Handler

Directly call `onAgentStateChange` in the playback handler when playback starts, regardless of current state:

```typescript
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  if (currentState !== 'speaking') {
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  }
  // Always notify callback when playback starts
  if (onAgentStateChange) {
    onAgentStateChange('speaking');
  }
}
```

**Pros:**
- Guarantees callback fires when playback starts
- Clear separation: state update vs callback notification
- Handles all race conditions

**Cons:**
- Bypasses the normal useEffect callback mechanism
- May cause duplicate callbacks if useEffect also fires
- Not consistent with other callback patterns

### Option 4: Reset prevAgentStateRef on Playback Start

Force the useEffect to fire by resetting `prevAgentStateRef.current` when playback starts:

```typescript
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  if (currentState === 'speaking') {
    // Force callback to fire by resetting prevAgentStateRef
    prevAgentStateRef.current = 'idle'; // or whatever it was before
    // Trigger useEffect by updating state (even if value is same)
    // But React won't re-render if state is same...
  } else {
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  }
}
```

**Pros:**
- Uses existing callback mechanism
- No duplicate calls

**Cons:**
- Hacky - manipulating refs to force callback
- May not work if React batches updates
- Complex logic

## ✅ Recommended Solution

**Option 3: Direct Callback in Playback Handler** (with deduplication)

This ensures the callback fires when playback actually starts, which is what consumers expect. The callback represents "playback has started" not just "state has changed".

```typescript
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  
  // Update state if needed
  if (currentState !== 'speaking') {
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  }
  
  // Always notify callback when playback starts (regardless of state)
  // This ensures consumers get notified when TTS actually starts playing
  if (onAgentStateChange && currentState === 'speaking') {
    // State already 'speaking' - callback may not have fired yet due to React batching
    // Force callback to fire now
    onAgentStateChange('speaking');
  }
  // If state wasn't 'speaking', the dispatch above will trigger the useEffect callback
}
```

Actually, wait - if we always call it, we might get duplicates. Let's use a ref to track if we've notified for this playback start:

```typescript
const lastPlaybackNotifyRef = useRef<boolean>(false);

// In playback handler:
if (event.isPlaying) {
  const currentState = stateRef.current.agentState;
  
  // Update state if needed
  if (currentState !== 'speaking') {
    dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  }
  
  // Always notify when playback starts (once per playback start)
  if (onAgentStateChange && !lastPlaybackNotifyRef.current) {
    onAgentStateChange('speaking');
    lastPlaybackNotifyRef.current = true;
  }
}

// Reset when playback stops:
if (!event.isPlaying) {
  lastPlaybackNotifyRef.current = false;
}
```

## 🧪 Testing Plan

### Unit Tests

1. Test that `onAgentStateChange('speaking')` is called when audio playback starts
2. Test that callback fires even if state is already 'speaking' (from AgentStartedSpeaking)
3. Test that callback doesn't fire twice in same playback cycle
4. Test that callback fires when AgentStartedSpeaking arrives before playback
5. Test that callback fires when playback starts before AgentStartedSpeaking

### E2E Tests

1. Test that `onAgentStateChange('speaking')` is called when TTS playback starts
2. Test that `agentState` transitions to 'speaking' in the UI
3. Test state transitions with real Deepgram API

### Test Location

- Unit tests: `tests/agent-state-handling.test.ts` (add new tests)
- E2E tests: `test-app/tests/e2e/agent-state-transitions.spec.js` (add test case)

## 📊 Implementation Status

- [ ] Analyze root cause
- [ ] Choose solution approach
- [ ] Implement fix
- [ ] Add unit tests
- [ ] Add E2E tests
- [ ] Verify fix with Voice Commerce team
- [ ] Update documentation if needed

## 📝 Related Issues

- Voice Commerce Issue #418: Library Issue: onAgentStateChange('speaking') not called when TTS playback starts
- Voice Commerce Issue #417: Add Test Coverage for Agent State Transitions (onAgentStateChange)

## 🔗 References

- Voice Agent API: https://developers.deepgram.com/docs/voice-agent
- Issue #251: https://github.com/Signal-Meaning/dg_react_agent/issues/251
- Voice Commerce Issue #418: https://github.com/Signal-Meaning/voice-commerce/issues/418

---

**Labels:** `bug`, `high-priority`, `agent-state`, `callback`, `voice-commerce`

**Last Updated**: January 2025

