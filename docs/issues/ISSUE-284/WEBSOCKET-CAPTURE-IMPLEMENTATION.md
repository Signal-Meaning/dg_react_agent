# WebSocket Settings Message Capture Implementation

**Date**: January 2025  
**Issue**: #284 - Function Calling SettingsApplied Investigation  
**Status**: Implemented, but Vite module caching preventing execution

## Overview

This document describes the automated WebSocket capture implementation for capturing the exact Settings message payload sent to Deepgram's Voice Agent API. This is critical evidence for the support ticket regarding `SettingsApplied` not being received when functions are included.

## Implementation Details

### 1. Enhanced WebSocketManager Logging

**File**: `src/utils/websocket/WebSocketManager.ts`

**Changes Made**:
- Added logging in `sendJSON()` method to capture Settings messages
- Always logs Settings messages (even without debug mode) for support tickets
- Exposes Settings payload to `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` (exact JSON string)
- Exposes parsed Settings to `window.__DEEPGRAM_WS_SETTINGS_PARSED__` (parsed object)
- Only exposes to window when `__DEEPGRAM_TEST_MODE__` is enabled

**Code Location**: Lines 588-622

```typescript
// Always log Settings messages with full JSON for debugging (even without debug mode)
// This helps capture the exact payload being sent for support tickets
if (data && data.type === 'Settings') {
  // Always expose Settings payload to window for automated testing
  // This is the exact JSON string that will be sent over WebSocket
  if (typeof window !== 'undefined') {
    (window as any).__DEEPGRAM_WS_SETTINGS_PAYLOAD__ = jsonString;
    try {
      (window as any).__DEEPGRAM_WS_SETTINGS_PARSED__ = JSON.parse(jsonString);
    } catch (e) {
      console.error('Error parsing Settings JSON for window exposure:', e);
    }
  }
  
  // Always log Settings messages (even without debug mode) for support tickets
  console.log('📤 [WEBSOCKET.sendJSON] ✅ Settings message detected!');
  console.log('📤 [WEBSOCKET.sendJSON] Settings message payload (exact JSON string):', jsonString);
  // ... parsed logging
}
```

### 2. Component Window Exposure (Existing)

**File**: `src/components/DeepgramVoiceInteraction/index.tsx`

**Existing Implementation**:
- Component already exposes `__DEEPGRAM_LAST_SETTINGS__` when functions are present
- Only works when `agentOptions.functions && agentOptions.functions.length > 0`
- Only works when `__DEEPGRAM_TEST_MODE__` is enabled
- Exposes both Settings object and functions array

**Code Location**: Lines 1372-1383

### 3. E2E Test Updates

**File**: `test-app/tests/e2e/function-calling-e2e.spec.js`

**Changes Made**:
- Enhanced test to capture Settings from multiple sources:
  1. Primary: `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` (from WebSocketManager)
  2. Fallback: `window.__DEEPGRAM_LAST_SETTINGS__` (from component)
  3. Stringify fallback to get exact JSON string
- Added console log capture for SETTINGS DEBUG logs
- Added retry logic with multiple attempts
- Enhanced debugging output

**Test Location**: `test('should test minimal function definition for SettingsApplied issue', ...)`

## Current Issue: Vite Module Caching

### Problem

The enhanced WebSocketManager code is not executing in E2E tests, despite:
- Code being present in the source file
- Test mode being enabled (`hasTestMode: true`)
- Component logs showing Settings is being sent
- `sendJSON()` being called with type "Settings"

### Symptoms

1. **WebSocketManager logs not appearing**: We see "Called with type: Settings" but not "Settings message detected!"
2. **Window variables not set**: `__DEEPGRAM_WS_SETTINGS_PAYLOAD__` is never set
3. **Component window exposure also failing**: `__DEEPGRAM_LAST_SETTINGS__` is not set (suggests functions may not be detected)

### Root Cause

**Vite Module Caching**: The test-app imports from source (`../../src/components/DeepgramVoiceInteraction`), but Vite may be caching the old WebSocketManager module. When Playwright tests run, they may be using a cached version of the module that doesn't include the new logging code.

### Evidence

- File timestamp shows recent modification: `Nov 14 17:16:38 2025`
- Code is present in source file (verified with grep)
- Test shows "Called with type: Settings" but no subsequent logs
- Component window exposure check shows: `{ hasTestMode: true, hasLastSettings: false, hasLastFunctions: false }`

### Solution

**Restart Vite Dev Server**: The Vite dev server needs to be restarted to clear module cache and pick up the new WebSocketManager code.

**Status**: Vite dev server has been restarted, but logs still not appearing. This suggests:
1. Vite may be bundling/caching the module differently than expected
2. The test-app's import path (`../../src/components/DeepgramVoiceInteraction`) may resolve to a different WebSocketManager instance
3. There may be a timing issue where Settings is sent before the enhanced code is loaded

**Next Investigation**: 
- Verify WebSocketManager module is being loaded from the correct path
- Check if there are multiple WebSocketManager instances
- Consider using Browser DevTools Network Tab as a more reliable capture method

## Testing Status

### What Works

- ✅ Test mode is enabled correctly
- ✅ Component logs show Settings is being sent
- ✅ `sendJSON()` is being called with type "Settings"
- ✅ Test infrastructure is in place

### What Doesn't Work

- ❌ WebSocketManager enhanced logging not executing
- ❌ Window variables not being set
- ❌ Component window exposure not working (functions may not be detected)

## Next Steps

1. **Restart Vite Dev Server** to clear module cache
2. **Re-run E2E test** to verify WebSocketManager code executes
3. **Verify window variables** are set correctly
4. **Capture exact payload** for support ticket
5. **Update support ticket** with captured payload

## Files Modified

1. `src/utils/websocket/WebSocketManager.ts` - Enhanced logging
2. `test-app/tests/e2e/function-calling-e2e.spec.js` - Enhanced capture logic
3. `src/components/DeepgramVoiceInteraction/index.tsx` - Added component logging (already existed)

## Related Documents

- `DEEPGRAM-SUPPORT-TICKET.md` - Support ticket template
- `EVIDENCE.md` - Evidence collection
- `TEST-RESULTS.md` - Test results summary

