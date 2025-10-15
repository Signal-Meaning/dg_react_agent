# Issue #58: Idle Timeout Synchronization Between WebSocket Services

## Problem Statement

The current implementation has separate idle timeouts for each WebSocket service (agent and transcription), creating race conditions and inconsistent behavior where one service can timeout while the other remains active.

## Current Architecture Issues

### Dual Timeout System
- **Agent WebSocket**: 10s idle timeout
- **Transcription WebSocket**: 10s idle timeout
- **Independent operation**: Services can timeout at different times
- **Complex synchronization**: Requires event passing to keep timeouts in sync

### Race Conditions
1. **UtteranceEnd** → Both services disabled ✅
2. **User speaks** → Transcription detects activity, resets its timeout ✅
3. **Agent service** still has old timeout running → Times out while user is talking ❌
4. **Or vice versa** → Transcription times out while agent is responding ❌

## Current Workaround (Quick Fix)

### Implementation Status: PARTIALLY COMPLETE

**Files Modified:**
- `src/utils/websocket/WebSocketManager.ts` - Added cross-service event emission
- `src/components/DeepgramVoiceInteraction/index.tsx` - Added event handlers

**Key Changes:**
1. **Cross-service event handling**: Added `re_enable_idle_timeout` events
2. **Activity detection**: Only meaningful messages (Results with content, ConversationText) trigger re-enabling
3. **Synchronized disabling**: UtteranceEnd disables both services
4. **Synchronized re-enabling**: Activity on either service re-enables both

### Current Flow
```
UtteranceEnd → Both services disabled + start 10s countdown
User speaks → Results arrive → Transcription re-enables both services
Agent responds → Agent messages → Agent re-enables both services
True silence → Both services timeout together
```

### Known Issues
1. **Keepalive messages**: Don't reset timeout (correct behavior)
2. **Event emission**: Added debug logging to verify events are being emitted
3. **Timeout not firing**: Fixed `disableIdleTimeoutResets()` to start timeout immediately

## Test Status

**Test File:** `tests/e2e/idle-timeout-behavior.spec.js`

### Test Cases
1. **Microphone activation after idle timeout** - ✅ PASSING (Issue #58 fixed)
2. **Active conversation continuity** - ❓ NEEDS VERIFICATION
3. **Loading state during reconnection** - ❓ NEEDS VERIFICATION

### Manual Testing Scenarios
1. **Basic timeout**: Let connection idle → Should timeout after 10s ✅
2. **Reconnection**: Click mic after timeout → Should reconnect ✅
3. **Active conversation**: Speak after UtteranceEnd → Should stay connected ❓
4. **Context preservation**: Reconnect and ask about previous topic → Should remember ❓

## Debug Information

### Logs to Look For
```
🔄 [WebSocketManager] Emitting re_enable_idle_timeout event for transcription
🔄 [IDLE_TIMEOUT] Re-enabling idle timeout resets for agent service due to transcription activity
🔧 [WebSocketManager] Disabled idle timeout resets for [service] - connection will timeout naturally
🔧 [WebSocketManager] Idle timeout reached (10000ms) - closing [service] connection
```

### Current Issue
**Keepalive keeps running after UtteranceEnd** - The timeout should fire after 10s but doesn't. This suggests either:
1. No meaningful messages are being received after UtteranceEnd, OR
2. The `shouldResetIdleTimeout()` logic isn't detecting Results as meaningful

## Next Steps to Resume

### Immediate Debugging
1. **Check event emission**: Look for `🔄 [WebSocketManager] Emitting re_enable_idle_timeout` logs
2. **Verify activity detection**: Check if Results with content are being detected as meaningful
3. **Test timeout firing**: Verify that `disableIdleTimeoutResets()` actually starts the timeout

### Code to Check
```typescript
// In WebSocketManager.ts - should emit events
if (this.idleTimeoutDisabled) {
  console.log(`🔄 [WebSocketManager] Emitting re_enable_idle_timeout event for ${this.options.service}`);
  this.emit({ type: 're_enable_idle_timeout', service: this.options.service });
}

// In shouldResetIdleTimeout() - should detect meaningful Results
if (data.type === 'Results') {
  const hasTranscript = hasAlternatives && data.alternatives[0].transcript && data.alternatives[0].transcript.trim().length > 0;
  if (hasTranscript) {
    return true; // This should trigger re-enabling
  }
}
```

### Test Commands
```bash
# Run the idle timeout tests
npx playwright test tests/e2e/idle-timeout-behavior.spec.js

# Run with debug logging
DEBUG=* npx playwright test tests/e2e/idle-timeout-behavior.spec.js
```

## Long-term Solution (Future GitHub Issue)

### Proposed Architecture
**Single Shared Idle Timeout Manager** instead of per-service timeouts:

```typescript
class ConversationIdleTimeout {
  private timeoutId: NodeJS.Timeout | null = null;
  private isDisabled = false;
  private onTimeout: () => void;
  
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
}
```

### Benefits
- **Simpler logic**: One timeout to manage instead of two
- **Consistent behavior**: Both services always timeout together
- **Easier debugging**: Single point of timeout control
- **More reliable**: No race conditions between services

## Related Issues
- **Issue #58**: Microphone reconnection after idle timeout (this issue - partially complete)
- **Issue #61**: Improve transcription logging verbosity
- **Future issue**: Single shared idle timeout architecture

## Files to Review
- `src/utils/websocket/WebSocketManager.ts` - Core timeout logic
- `src/components/DeepgramVoiceInteraction/index.tsx` - Event handling
- `tests/e2e/idle-timeout-behavior.spec.js` - Test coverage
- `docs/issues/ISSUE-43-Solution.md` - Related context

## Status: PAUSED - Ready for Resumption

The quick fix is partially implemented but needs debugging to verify the cross-service event handling is working correctly. The fundamental architecture issue remains and should be addressed with the single shared timeout manager approach.
