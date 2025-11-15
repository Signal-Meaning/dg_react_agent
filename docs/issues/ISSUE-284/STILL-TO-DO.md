# Issue #284: Still To Do - WebSocket Interception

## Status

**UPDATED**: January 2025 - ✅ **ISSUE RESOLVED** - Root cause identified and fixed. Component now re-sends Settings when `agentOptions` changes, resolving the timing issue. WebSocket capture was used for investigation but is no longer needed for resolution.

## Implementation Status

### What We've Done ✅
1. ✅ Verified Settings message structure via component logs
2. ✅ Verified Settings message structure via unit tests (mocked)
3. ✅ Created minimal function definitions
4. ✅ Run comparative tests (with/without functions)
5. ✅ Removed extraneous keys (`client_side`)
6. ✅ Documented component logs
7. ✅ **Implemented automated WebSocket capture in WebSocketManager** (see `WEBSOCKET-CAPTURE-IMPLEMENTATION.md`)
8. ✅ **Enhanced E2E tests to capture Settings from multiple sources**
9. ✅ **Restarted Vite dev server to clear module cache**

### What We Still Need To Do ❌

**1. Verify WebSocketManager Code Executes After Vite Restart**

**Current Status**: 
- Enhanced logging code is implemented in `WebSocketManager.sendJSON()`
- Code exposes Settings payload to `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__`
- Vite dev server has been restarted to clear module cache
- **NEXT**: Re-run E2E test to verify code executes

**What We Need**:
- Re-run E2E test with minimal function definition
- Verify WebSocketManager logs appear (e.g., "Settings message detected!")
- Verify `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` is set
- Capture the exact JSON payload
- If still not working, investigate further (may need to check if functions are being detected)

**2. Capture and Verify Settings Message Payload**

Once WebSocketManager code executes, we need to:
- Verify `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` contains the exact JSON string
- Verify Settings message has `"type": "Settings"` in the payload
- Verify functions are in `agent.think.functions` in the payload
- Verify no functions in root, `agent.functions`, or other locations
- Log the full payload for support ticket

## Next Steps

### Immediate: Verify Implementation Works

1. **Re-run E2E test** with minimal function definition:
   ```bash
   cd test-app
   npm run test:e2e:real-api -- tests/e2e/function-calling-e2e.spec.js -g "minimal function definition"
   ```

2. **Check for WebSocketManager logs**:
   - Look for "Settings message detected!" in console
   - Look for "Settings payload exposed to window" in console
   - Verify `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` is set

3. **If logs appear**:
   - Capture the exact JSON payload
   - Update support ticket with payload
   - Proceed with ticket submission

4. **If logs still don't appear**:
   - Check if functions are being detected (component window exposure)
   - Investigate Vite module resolution
   - Consider using Browser DevTools Network Tab as fallback

### Primary Method: Browser DevTools Network Tab ⭐

**This is the BEST and most reliable method** - no code changes needed, bypasses all module caching issues.

**See `BROWSER-DEVTOOLS-CAPTURE-GUIDE.md` for complete step-by-step instructions.**

**Quick Summary**:
1. Start test app: `cd test-app && npm run dev`
2. Navigate to: `http://localhost:5173/?test-mode=true&enable-function-calling=true&function-type=minimal&debug=true`
3. Open Browser DevTools → Network Tab → Filter "WS"
4. Send a message to establish WebSocket connection
5. Click on WebSocket connection → "Messages" tab
6. Find outgoing Settings message (green arrow)
7. Copy the full JSON payload
8. Verify structure and update support ticket

**Alternative Methods**: See `CAPTURE-WEBSOCKET-MESSAGES.md` for other approaches.

## Why This Matters

The Deepgram support advice emphasizes:
> "If functions do not appear in agent.think.functions, the issue is almost certainly in the component mapping — fix it first before filing a third-party bug."

We've verified via logs and unit tests, but we need to verify via actual WebSocket interception to be 100% certain before submitting the ticket.

