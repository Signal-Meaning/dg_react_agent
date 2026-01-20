# Issue #373: Bug - Idle Timeout Firing During Active Function Calls

**GitHub Issue**: [#373](https://github.com/Signal-Meaning/dg_react_agent/issues/373) 🔴 **OPEN**  
**Status**: 🔴 **IN PROGRESS** - Investigation Phase  
**Priority**: CRITICAL (blocking function calling functionality)  
**Labels**: bug, priority: critical, voice-agent  
**Branch**: `davidrmcgee/issue373`  
**Reported By**: Voice-commerce team (Issue #809)  
**Component Version**: @signal-meaning/deepgram-voice-interaction-react@^0.7.9  
**Target Version**: v0.7.10+ (patch release - bug fix)

---

## 🎯 Executive Summary

**Bug**: The component's idle timeout is incorrectly firing during active function call execution, causing connections to close before function call responses can be sent. This is incorrect behavior - the component should automatically prevent idle timeout during any active function call.

**Expected Behavior**: When `onFunctionCallRequest` is called, the component should automatically disable idle timeout until the function call response is sent. Function calls are inherently "thinking" activities and should not be subject to idle timeout.

**Current Behavior**: Idle timeout (10 seconds) continues to run during function call execution, causing connections to close mid-operation.

---

## 📋 Problem Statement

### Scenario 1: Idle Timeout During Function Call Execution

When a function call is triggered via `onFunctionCallRequest`, the agent enters a "thinking" state while the function executes. The component's idle timeout incorrectly continues to run during this period, causing the connection to close before the function completes.

**Impact:**
- ❌ Lost function call responses - The function completes but the response cannot be sent because the connection was closed
- ❌ Non-responsive agent - The agent appears frozen because the connection was terminated mid-operation
- ❌ Poor user experience - Users must manually reconnect and retry their request
- ❌ Broken functionality - Function calls that take longer than 10 seconds are impossible to complete

### Scenario 2: Idle Timeout During Agent "Thinking" Phase (Before Function Call)

Even before a function call is triggered, the agent may enter a "thinking" phase while deciding whether to call a function. The component's idle timeout incorrectly fires during this thinking phase, causing the connection to close before the agent can decide to call the function.

**Impact:**
- ❌ Function calls never triggered - The connection closes while the agent is still processing/thinking
- ❌ Incomplete agent responses - The agent cannot complete its decision-making process
- ❌ Connection closes during LLM processing - The idle timeout fires while the agent is actively thinking about whether to call a function
- ❌ Test failures - Tests that expect function calls fail because the connection closes before the function call is triggered

---

## 🔍 Root Cause Analysis

### Current Implementation

1. **Component transitions to 'thinking' state** when `FunctionCallRequest` is received (line 2243 in `index.tsx`)
2. **IdleTimeoutService checks** if `agentState === 'thinking'` to disable resets (line 213 in `IdleTimeoutService.ts`)
3. **Timing Issues:**
   - If the idle timeout is already running when the function call starts, it might not be stopped immediately
   - After `onFunctionCallRequest` is called, the function executes asynchronously. During this execution, the agent state might transition away from 'thinking' (e.g., if the function completes quickly and the agent starts speaking), but the function call response hasn't been sent yet
   - There's no explicit tracking of "active function call execution" state

### The Problem

The component does not track when a function call is actively executing (from when `onFunctionCallRequest` is called until the response is sent). During this period, if the agent state changes or the timeout was already running, the idle timeout can fire.

**Note**: The component DOES have a `responseSent` flag (line 2295) that tracks whether a response was sent for each individual function call (Issue #355 - response guarantee). However, this is:
- **Local to each function call** - scoped within the `forEach` loop iteration
- **Not used for idle timeout** - only used to ensure a response is sent
- **Not persistent** - doesn't track active calls across the component lifecycle

We need to add **global tracking** of all active function calls (e.g., a Set or Map) that persists and can be used for idle timeout management.

### Code References

- **Function call handling**: `src/components/DeepgramVoiceInteraction/index.tsx` (line 2243)
- **Per-call response tracking**: `src/components/DeepgramVoiceInteraction/index.tsx` (line 2295 - `responseSent` flag, Issue #355)
- **Idle timeout service**: `src/utils/IdleTimeoutService.ts` (line 213)
- **Idle timeout manager**: `src/hooks/useIdleTimeoutManager.ts`
- **Related issues**: Issue #294 (thinking state for function calls), Issue #302 (keepalive during thinking state), Issue #355 (response guarantee)

### Existing Tracking (Not Used for Idle Timeout)

The component already has per-call tracking via the `responseSent` flag (line 2295), but this is:
- **Local scope**: Scoped within each `forEach` iteration, not global
- **Single purpose**: Only used to guarantee a response is sent (Issue #355)
- **Not connected**: Not integrated with idle timeout service
- **Not persistent**: Doesn't track active calls across component lifecycle

**What's Missing**: A global tracking mechanism (e.g., `Set<string>` or `Map<string, FunctionCallInfo>`) that:
- Persists across the component lifecycle
- Tracks ALL active function calls (not just per-call)
- Integrates with `IdleTimeoutService` to disable timeout when ANY call is active

---

## 💡 Proposed Solution

### Option 1: Automatic Idle Timeout Management During Function Calls (REQUIRED FIX)

**This is the correct behavior and should be implemented in the component.**

#### Implementation Approach

The component should track active function call execution and automatically disable idle timeout during this period:

**Current State**: The component has per-call tracking (`responseSent` flag) for response guarantee (Issue #355), but no global tracking for idle timeout management.

**What We Need**: Add a global tracking mechanism (e.g., `Set<string>` or `Map<string, FunctionCallInfo>`) to track all active function calls.

1. **When `onFunctionCallRequest` is called:**
   - Add function call ID to active calls Set/Map
   - If this is the first active call, disable idle timeout resets (or stop any running timeout)
   - Ensure timeout cannot fire during function execution

2. **When the function call response is sent:**
   - Remove function call ID from active calls Set/Map
   - If this was the last active call, re-enable idle timeout resets
   - Allow timeout to start if conditions are met

3. **Error handling:**
   - Always remove from active calls Set/Map, even on error
   - Ensure idle timeout is re-enabled in `finally` blocks
   - Handle promise rejections correctly
   - Use reference counting: increment on start, decrement on completion

#### Why This Is The Correct Fix

- ✅ Function calls are active operations - The connection is actively being used
- ✅ Zero application code changes - Works automatically for all consumers
- ✅ Most robust - Handles all edge cases (errors, timeouts, promise rejections)
- ✅ Follows existing patterns - Component already manages idle timeout for other active states (speaking, audio capture, etc.)
- ✅ Prevents the bug - No possibility of timeout during function calls

#### Implementation Details

**Reference Counting:**
- Use reference counting to handle multiple concurrent function calls
- Increment counter when function call starts
- Decrement counter when function call completes
- Only re-enable timeout when counter reaches zero

**Integration Points:**
- Track function calls in the component state or a ref
- Integrate with `IdleTimeoutService` to disable/enable timeout
- Handle both imperative (`sendResponse`) and declarative (return value) patterns

---

## 🧪 Test Cases

### Test Case 1: Long-Running Function Call

**Scenario**: Function call takes 12 seconds (longer than 10s idle timeout)

**Expected:**
1. Function call starts
2. Idle timeout is automatically disabled
3. Function executes for 12 seconds
4. Connection stays open
5. Response is sent successfully
6. Idle timeout is re-enabled
7. Test passes ✅

**Actual (Current Bug):**
1. Function call starts
2. Idle timeout continues running
3. Function executes for 12 seconds
4. Connection closes after 10 seconds (idle timeout fires)
5. Response cannot be sent (connection is closed)
6. Test fails ❌

### Test Case 2: Agent Thinking Phase Before Function Call

**Scenario**: Agent takes time to decide whether to call a function

**Expected:**
1. User sends message
2. Agent enters thinking phase
3. Connection stays open during thinking
4. Function call is triggered
5. Function executes
6. Response is sent
7. Test passes ✅

**Actual (Current Bug):**
1. User sends message
2. Agent enters thinking phase
3. Connection closes after 10 seconds (idle timeout fires)
4. Function call is never triggered
5. Test fails ❌

### Reproducible Test

The voice-commerce team has provided a complete reproducible test case that demonstrates both scenarios. The test:
- Uses a function that takes 12 seconds to execute (longer than 10s idle timeout)
- Monitors connection state during function execution
- Verifies that connection stays open during function execution
- Currently fails because connection closes after 10 seconds

**Test Location**: See GitHub issue #373 for complete test code

---

## 📝 Implementation Plan

### Phase 1: Investigation ✅
- [x] Review bug report and understand the issue
- [x] Analyze current idle timeout implementation
- [x] Identify root cause
- [x] Create tracking document

### Phase 2: Design
- [ ] Design function call tracking mechanism
- [ ] Design integration with IdleTimeoutService
- [ ] Design reference counting for concurrent calls
- [ ] Design error handling approach

### Phase 3: Implementation
- [ ] Add function call tracking state/ref
- [ ] Integrate with IdleTimeoutService
- [ ] Implement automatic timeout disable on function call start
- [ ] Implement automatic timeout enable on function call complete
- [ ] Add error handling (finally blocks, promise rejections)
- [ ] Add reference counting for concurrent calls

### Phase 4: Testing
- [ ] Write unit tests for function call tracking
- [ ] Write integration tests for idle timeout during function calls
- [ ] Run voice-commerce team's reproducible test
- [ ] Test concurrent function calls
- [ ] Test error scenarios
- [ ] Test edge cases (quick functions, slow functions, etc.)

### Phase 5: Documentation
- [ ] Update API documentation if needed
- [ ] Update changelog
- [ ] Document the fix in release notes

---

## 🔗 Related Issues

- **Issue #294**: onAgentStateChange('thinking') Not Emitted for Client-Side Function Calls
- **Issue #302**: Maintain keepalive during thinking state to prevent CLIENT_MESSAGE_TIMEOUT
- **Issue #809** (voice-commerce team): Original bug report
- **Issue #355**: Function call timeout analysis

---

## 📚 References

- **GitHub Issue**: [#373](https://github.com/Signal-Meaning/dg_react_agent/issues/373)
- **Component code**: `src/components/DeepgramVoiceInteraction/index.tsx` (line 2243)
- **Idle timeout service**: `src/utils/IdleTimeoutService.ts` (line 213)
- **Idle timeout manager**: `src/hooks/useIdleTimeoutManager.ts`
- **Voice-commerce team Issue #809**: Original bug report

---

## ❓ Open Questions

1. Is this a known issue? Has the component team encountered this bug before?
2. Are concurrent function calls supported? (affects reference counting design)
3. Should we track function calls at the component level or in IdleTimeoutService?
4. Do we need to handle nested function calls? (function call that triggers another function call)

---

## 📅 Timeline

- **Priority**: CRITICAL (blocking Issue #809, breaks function calling functionality)
- **Target Version**: Next patch release (v0.7.10+) - This is a bug fix, not a feature
- **Testing**: Test cases provided by voice-commerce team can validate the fix

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: Component Team (based on voice-commerce team bug report)
