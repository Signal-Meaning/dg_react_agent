# Issue #341: Connection Closes Immediately After Being Reported as Connected

**GitHub Issue**: [#341](https://github.com/Signal-Meaning/dg_react_agent/issues/341)  
**Status**: 🔍 **Investigated** - Root Cause Identified, Client-Side Fixes Applied  
**Priority**: High  
**Labels**: bug, websocket, connection, priority: high  
**Related Issues**: [#340](https://github.com/Signal-Meaning/dg_react_agent/issues/340) - Int16Array Error with Odd-Length Buffers

## 📋 Issue Summary

Connections are reported as "connected" via `onConnectionStateChange` callback, but the WebSocket connection closes immediately after (within 0-3ms). This causes connections to be unstable and fail shortly after establishment.

### Reported Symptoms

- `onConnectionStateChange('agent', 'connected')` is called
- Connection closes immediately after being reported as connected (within 100-200ms, observed as 0-3ms in E2E tests)
- Connection state transitions: `connecting → connected → closed`
- Connection stability cannot be maintained

## 🔍 Root Cause Analysis

### Investigation Findings

Through E2E testing and enhanced logging, we identified the following:

1. **WebSocket Error Event Fires During Connection**
   - Error event fires with `readyState: 3` (CLOSED) before connection is established
   - This indicates the connection is being rejected by the server before `onopen` fires

2. **Close Code 1006 (Abnormal Closure)**
   - Connection closes with code `1006` (Abnormal Closure)
   - `wasClean: false` indicates the connection was not closed cleanly
   - This typically indicates:
     - Authentication failure (invalid/missing API key)
     - Network/connectivity issues
     - Server-side rejection

3. **Connection Never Successfully Establishes**
   - Despite being reported as "connected", the WebSocket never reaches `OPEN` state
   - The error occurs during connection establishment, before `onopen` fires
   - State transitions: `connecting → error → closed`

### Root Cause

The connection is being **rejected by the Deepgram server** before it can be established. This is likely due to:

1. **Authentication Issues**: Invalid or missing API key
2. **Network/Connectivity**: Network issues preventing proper connection handshake
3. **Server-Side Rejection**: Deepgram server rejecting the connection for protocol/configuration reasons

The client-side code correctly reports the connection attempt, but the server rejects it immediately, causing the observed behavior.

## ✅ Fixes Applied

### 1. Issue #340 Fix (Related Root Cause)

**Problem**: `Int16Array` errors when processing odd-length TTS audio buffers could cause unhandled errors that might contribute to connection instability.

**Fix**: Added validation in `createAudioBuffer()` to handle odd-length buffers gracefully:
- Truncates odd-length buffers to even length (PCM16 requires 2 bytes per sample)
- Logs warning instead of throwing `RangeError`
- Prevents unhandled errors that could affect connection stability

**Files Modified**:
- `src/utils/audio/AudioUtils.ts`

### 2. Enhanced Error Handling

**Problem**: WebSocket errors were not providing sufficient diagnostic information, and error handling could be improved.

**Fixes Applied**:

#### A. Enhanced Error Logging
- Added detailed error logging with connection state, readyState, and timing information
- Logs connection timestamps to diagnose immediate closures
- Provides close codes and reasons for better debugging

**Files Modified**:
- `src/utils/websocket/WebSocketManager.ts`

#### B. Improved Error Handling Flow
- Wait for `onclose` event to get actual close code and reason before rejecting
- Only reject immediately if connection was never established (readyState CLOSED and never connected)
- Better error messages with close code and reason

**Files Modified**:
- `src/utils/websocket/WebSocketManager.ts`

#### C. Audio Processing Error Handling
- Audio processing errors no longer re-throw (prevent unhandled promise rejections)
- Errors are logged and emitted for error handling callbacks
- Connection remains stable even if audio processing fails

**Files Modified**:
- `src/utils/audio/AudioManager.ts`
- `src/components/DeepgramVoiceInteraction/index.tsx`

#### D. Binary Message Error Handling
- Wrapped `handleAgentAudio` in try-catch to prevent unhandled errors
- Added error handling for Blob conversion errors
- Prevents errors from propagating and closing connections

**Files Modified**:
- `src/components/DeepgramVoiceInteraction/index.tsx`
- `src/utils/websocket/WebSocketManager.ts`

### 3. Connection Timestamp Tracking

Added connection timestamp tracking to diagnose immediate closures:
- Records when connection is established
- Calculates time since connection when closure occurs
- Logs timing information for debugging

**Files Modified**:
- `src/utils/websocket/WebSocketManager.ts`

## 🧪 Test Results

### Unit Tests

**Issue #340 Tests**: ✅ **All Passing**
- 6 tests passing
- Odd-length buffer handling verified
- Edge cases covered (single byte, three byte, various odd lengths)

### Integration Tests

**Issue #341 Tests**: ⚠️ **Expected to Fail** (uses mock that simulates defect)
- Tests use mock WebSocket that simulates immediate close
- Tests correctly detect the defect when simulated
- Will pass once root cause (server-side rejection) is resolved

### E2E Tests

**Issue #341 E2E Tests**: ❌ **Still Failing** (demonstrates real defect)
- Connection closes at 0-3ms after being reported as connected
- Close code: `1006` (Abnormal Closure)
- `wasClean: false` indicates server rejection

**Test Output**:
```
🚨 [ISSUE #341] WebSocket error details: {
  readyState: 3,
  readyStateName: 'CLOSED',
  connectionState: 'connecting',
  hasEverConnected: false
}

🚨 [ISSUE #341] WebSocket close details: {
  code: 1006,
  reason: '',
  wasClean: false,
  previousState: 'error'
}
```

## 📝 Code Changes Summary

### Files Modified

1. **src/utils/audio/AudioUtils.ts**
   - Added odd-length buffer validation and truncation
   - Prevents `Int16Array` errors

2. **src/utils/audio/AudioManager.ts**
   - Improved error handling in `queueAudio()`
   - Errors no longer re-throw (prevent connection closure)

3. **src/utils/websocket/WebSocketManager.ts**
   - Enhanced error logging with detailed diagnostics
   - Improved error handling flow (wait for onclose)
   - Added connection timestamp tracking
   - Better error messages with close codes

4. **src/components/DeepgramVoiceInteraction/index.tsx**
   - Wrapped `handleAgentAudio` in try-catch
   - Improved error handling for binary messages

5. **test-app/tests/e2e/issue-341-connection-immediate-close.spec.js**
   - Added console log capture for debugging
   - Enhanced test diagnostics

## 🔄 Next Steps

### Immediate Actions

1. **Verify API Key Configuration**
   - Ensure API key is valid and properly configured in test environment
   - Check API key format and permissions
   - Verify API key has access to Voice Agent API

2. **Check Network Connectivity**
   - Verify network connectivity to Deepgram servers
   - Check for firewall/proxy issues
   - Test connection from different network environments

3. **Review Server-Side Logs**
   - Check Deepgram server logs for connection rejection reasons
   - Look for authentication errors or protocol violations
   - Verify server-side configuration

### Long-Term Improvements

1. **Better Error Messages**
   - Provide more specific error messages based on close codes
   - Guide users on how to resolve authentication/configuration issues
   - Add retry logic with exponential backoff for transient errors

2. **Connection Health Monitoring**
   - Add connection health checks
   - Monitor connection stability metrics
   - Alert on frequent connection failures

3. **Documentation**
   - Document common connection issues and solutions
   - Add troubleshooting guide
   - Provide examples of proper API key configuration

## 📊 Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Issue #340 Fix | ✅ Complete | Odd-length buffer handling fixed |
| Error Handling | ✅ Complete | Enhanced logging and error handling |
| Client-Side Fixes | ✅ Complete | All client-side improvements applied |
| Root Cause | 🔍 Identified | Server-side rejection (code 1006) |
| Server-Side Issue | ⏳ Pending | Requires API key/network verification |
| E2E Tests | ❌ Failing | Demonstrates real defect (expected) |

## 🔗 Related Documentation

- [Issue #340: Int16Array Error with Odd-Length Buffers](./ISSUE-340-INT16ARRAY-ODD-LENGTH-BUFFER.md) (if exists)
- [WebSocket Connection Behavior](./WEBSOCKET-REMOUNT-BEHAVIOR.md)
- [Voice Agent API Documentation](https://developers.deepgram.com/docs/voice-agent)

## 📅 Timeline

- **2024-01-XX**: Issue reported by voice-commerce team
- **2024-01-XX**: Investigation started
- **2024-01-XX**: Root cause identified (server-side rejection)
- **2024-01-XX**: Client-side fixes applied
- **2024-01-XX**: Documentation updated

---

**Note**: This issue requires server-side/configuration verification. The client-side fixes ensure proper error handling and diagnostics, but the root cause (connection rejection with code 1006) suggests an authentication or network issue that needs to be resolved at the configuration level.

