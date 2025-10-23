# Issue #149: Idle Timeout Coordination Bug - Transcription and Agent Services Timeout Independently

**Issue**: [#149 - Bug: Idle timeout coordination bug: transcription and agent services timeout independently](https://github.com/Signal-Meaning/dg_react_agent/issues/149)

**Status**: 🔄 **IN PROGRESS** - Working on Unified Timeout Management

**Date**: January 13, 2025

**Branch**: `davidrmcgee/issue149`

---

## Problem Summary

The `dg_react_agent` library has separate idle timeout mechanisms for transcription and agent services that are not coordinated. This causes the transcription connection to close prematurely while the agent connection remains open, leading to:

1. **Microphone button appearing inactive (purple) while still recording**
2. **Inconsistent user experience** where the UI doesn't reflect the actual recording state
3. **Need for workarounds** in application code

## Root Cause Analysis

### Current Architecture Issues

#### Dual Timeout System
- **Agent WebSocket**: Independent idle timeout (typically 10s)
- **Transcription WebSocket**: Independent idle timeout (typically 10s)
- **No Coordination**: Services can timeout at different times
- **Race Conditions**: One service can timeout while the other remains active

#### Specific Problems
1. **UtteranceEnd** → Both services disabled ✅
2. **User speaks** → Transcription detects activity, resets its timeout ✅
3. **Agent service** still has old timeout running → Times out while user is talking ❌
4. **Or vice versa** → Transcription times out while agent is responding ❌

### Current Workaround (Band-aid Solution)

Applications currently use `updateSessionState` to extend timeouts, but this is a fragile workaround that:
- Requires application-level coordination
- Doesn't solve the fundamental architecture issue
- Creates maintenance burden for developers
- Can lead to inconsistent behavior across applications

## Expected Behavior

Both transcription and agent services should:
- **Use the same idle timeout value**
- **Timeout together when truly idle**
- **Stay connected together when either service is active**
- **Only timeout when both services are genuinely idle**

## Current Behavior

- **Transcription service times out independently**
- **Agent service has its own separate timeout**
- **Services can be in different states** (one connected, one disconnected)
- **This creates UI/UX inconsistencies**

## Reproduction Steps

1. Start a voice session with both transcription and agent services
2. Begin speaking to trigger transcription
3. Wait for agent to respond
4. Observe that transcription connection closes while agent is still speaking
5. Microphone button shows inactive state (purple) but continues recording

## Impact

- **Affects all applications** using `dg_react_agent` with voice features
- **Creates confusing user experience**
- **Requires application-level workarounds**
- **Breaks the expected behavior** that both services should stay connected together

## Proposed Solution

The library should implement a **unified idle timeout management system** where:

### 1. Shared Timeout Configuration
Both services use the same timeout value and configuration

### 2. Coordinated Activity
Activity on either service resets the timeout for both services

### 3. Unified Closure
Both services close together when the unified timeout expires

### 4. Agent Speaking Protection
The timeout is disabled when the agent is speaking (as it currently does for agent service)

### 5. Single Source of Truth
One timeout manager controls both services instead of separate managers

## Technical Implementation Plan

### Phase 1: Analysis and Design
- [ ] **Analyze current timeout mechanisms** in `WebSocketManager.ts`
- [ ] **Identify coordination points** between transcription and agent services
- [ ] **Design unified timeout manager** architecture
- [ ] **Plan migration strategy** from dual to single timeout system

### Phase 2: Core Implementation
- [ ] **Create `ConversationIdleTimeout` class** for unified management
- [ ] **Implement activity detection** from both services
- [ ] **Add coordinated timeout logic** for both services
- [ ] **Integrate with existing WebSocket managers**

### Phase 3: Integration and Testing
- [ ] **Update component integration** to use unified timeout
- [ ] **Add comprehensive test coverage** for timeout coordination
- [ ] **Test edge cases** (agent speaking, user interruptions, etc.)
- [ ] **Validate UI state consistency** during timeout scenarios

### Phase 4: Documentation and Migration
- [ ] **Update documentation** with new timeout behavior
- [ ] **Create migration guide** for existing applications
- [ ] **Remove workaround recommendations** from docs
- [ ] **Add troubleshooting guide** for timeout issues

## Proposed Architecture

### Unified Timeout Manager

```typescript
class ConversationIdleTimeout {
  private timeoutId: NodeJS.Timeout | null = null;
  private isDisabled = false;
  private onTimeout: () => void;
  private timeoutDuration: number;
  
  constructor(timeoutDuration: number, onTimeout: () => void) {
    this.timeoutDuration = timeoutDuration;
    this.onTimeout = onTimeout;
  }
  
  // Activity detected from either service
  onActivity() {
    if (!this.isDisabled) {
      this.reset();
    }
  }
  
  // Disable after UtteranceEnd
  disable() {
    this.isDisabled = true;
    this.clear();
  }
  
  // Re-enable on new connection
  enable() {
    this.isDisabled = false;
    this.reset();
  }
  
  private reset() {
    this.clear();
    this.timeoutId = setTimeout(() => {
      this.onTimeout();
    }, this.timeoutDuration);
  }
  
  private clear() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
```

### Integration Points

```typescript
// In DeepgramVoiceInteraction component
class DeepgramVoiceInteraction {
  private conversationTimeout: ConversationIdleTimeout;
  
  constructor() {
    this.conversationTimeout = new ConversationIdleTimeout(
      this.idleTimeoutMs,
      () => this.handleConversationTimeout()
    );
  }
  
  // Activity from transcription service
  private handleTranscriptionMessage(data: any) {
    if (this.isMeaningfulMessage(data)) {
      this.conversationTimeout.onActivity();
    }
    // ... existing logic
  }
  
  // Activity from agent service
  private handleAgentMessage(data: any) {
    if (this.isMeaningfulMessage(data)) {
      this.conversationTimeout.onActivity();
    }
    // ... existing logic
  }
  
  // UtteranceEnd disables timeout
  private handleUtteranceEnd() {
    this.conversationTimeout.disable();
    // ... existing logic
  }
}
```

## Benefits of Unified Approach

- **Simpler logic**: One timeout to manage instead of two
- **Consistent behavior**: Both services always timeout together
- **Easier debugging**: Single point of timeout control
- **More reliable**: No race conditions between services
- **Better UX**: UI state always reflects actual connection state
- **Eliminates workarounds**: No need for application-level coordination

## Technical Details

Currently, the library appears to have:

- **Separate WebSocket managers** for transcription and agent services
- **Independent idle timeout mechanisms**
- **No coordination** between the two timeout systems

The fix should consolidate these into a single, coordinated timeout management system.

## Files to Review

### Core Files
- `src/utils/websocket/WebSocketManager.ts` - Current timeout logic
- `src/components/DeepgramVoiceInteraction/index.tsx` - Service coordination
- `src/hooks/useIdleTimeoutManager.ts` - Existing timeout management
- `src/utils/state/VoiceInteractionState.ts` - State management

### Test Files
- `tests/e2e/idle-timeout-behavior.spec.js` - Existing timeout tests
- `tests/e2e/user-stopped-speaking-demonstration.spec.js` - VAD timeout tests
- `tests/e2e/extended-silence-idle-timeout.spec.js` - Extended timeout tests

### Documentation
- `docs/VAD-EVENTS-AND-TIMEOUT-BEHAVIOR.md` - Current timeout documentation
- `docs/issues/ISSUE-58-Idle-Timeout-Synchronization.md` - Related issue context

## Related Issues

- **Issue #58**: Idle Timeout Synchronization (partially related, different approach)
- **Issue #100**: VAD Events Working in Dual Mode (context for service coordination)
- **Issue #148**: Duplicate of this issue (closed as duplicate)

## Test Strategy

### Unit Tests
- [ ] Test `ConversationIdleTimeout` class behavior
- [ ] Test activity detection from both services
- [ ] Test coordinated timeout logic
- [ ] Test edge cases (agent speaking, interruptions)

### Integration Tests
- [ ] Test full conversation flow with unified timeout
- [ ] Test UI state consistency during timeouts
- [ ] Test workaround removal (no more `updateSessionState` needed)
- [ ] Test backward compatibility

### E2E Tests
- [ ] Test microphone button state consistency
- [ ] Test recording state accuracy
- [ ] Test timeout behavior in real conversation scenarios
- [ ] Test agent speaking protection

## Success Criteria

- [ ] **Both services timeout together** when truly idle
- [ ] **UI state accurately reflects** connection state
- [ ] **No more workarounds needed** in application code
- [ ] **Consistent behavior** across all timeout scenarios
- [ ] **Backward compatibility** maintained
- [ ] **Comprehensive test coverage** for all scenarios

## Next Steps

### Immediate (This Week)
1. **Analyze current timeout mechanisms** in detail
2. **Design unified timeout manager** architecture
3. **Create proof of concept** implementation
4. **Test with existing test cases**

### Short Term (Next 2 Weeks)
1. **Implement core unified timeout manager**
2. **Integrate with existing WebSocket managers**
3. **Add comprehensive test coverage**
4. **Validate with existing applications**

### Long Term (Next Month)
1. **Complete integration and testing**
2. **Update documentation and migration guides**
3. **Remove workaround recommendations**
4. **Release with proper versioning**

## Status: 🔄 **IN PROGRESS**

**Current Phase**: Analysis and Design
**Next Milestone**: Proof of concept implementation
**Blockers**: None identified
**Estimated Completion**: 2-3 weeks

---

*This issue affects the core user experience of voice-enabled applications and should be prioritized as it impacts the fundamental functionality of the library.*
