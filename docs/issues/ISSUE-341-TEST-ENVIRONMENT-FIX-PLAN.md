# Issue #341: Test Environment Fix Plan

## Problem Statement

Tests are failing on the `davidrmcgee/issue341-v0.6.9-test` branch (based on `release/v0.6.9`), preventing verification of Issue #341 fixes. This must be resolved before proceeding with the Issue #341 fix plan.

## Current Status

**Test Failure Pattern:**
- All `text-session-flow` tests fail with connection timeout
- Tests never reach "connected" state
- Error: `page.waitForFunction: Test timeout of 30000ms exceeded`
- Waiting for: `[data-testid="connection-status"]` to show "connected"

**Verification Testing Results:**
- ✅ Commit `305e2d0` (before env var fix): Tests FAIL ❌
- ⚠️ Commit `50131d0` (with env var fix): Tests STILL FAIL ❌
- **Finding:** Environment variable fix alone is not sufficient

## Hypotheses to Test

### Hypothesis A: Test File Incompatibility (Lower Priority)
**Theory:** The failing tests (`text-session-flow.spec.js`, `issue-341-connection-immediate-close.spec.js`) were written AFTER v0.6.9 and may expect DOM elements, component behavior, or test patterns that don't exist in v0.6.9.

**Specific Tests:**
- `test-app/tests/e2e/text-session-flow.spec.js` - Cherry-picked from later branch
- `test-app/tests/e2e/issue-341-connection-immediate-close.spec.js` - Cherry-picked from later branch

**Evidence to Gather:**
- Check if `[data-testid="connection-status"]` element exists in v0.6.9 component
- Verify if component exposes connection state in DOM as tests expect
- Check if test patterns match v0.6.9 component behavior

**Note:** v0.6.9 had its own tests that passed. These new tests may simply be incompatible with v0.6.9's component structure.

### Hypothesis B: Test Helper Differences (Lower Priority)
**Theory:** While the helper functions (`establishConnectionViaText`, `waitForConnection`) exist in v0.6.9, they may behave differently or expect different DOM structure.

**Specific Helpers:**
- `establishConnectionViaText()` - Exists in v0.6.9, but may expect different behavior
- `waitForConnection()` - Exists in v0.6.9, but may check for different DOM elements
- `setupConnectionStateTracking()` - May not exist in v0.6.9

**Evidence to Gather:**
- Compare helper implementations between v0.6.9 and current
- Check if helpers query DOM elements that don't exist in v0.6.9
- Verify if connection state detection works in v0.6.9

**Note:** v0.6.9's helpers worked with v0.6.9's tests. The issue may be that new tests use helpers in ways v0.6.9 doesn't support.

### Hypothesis C: Environment Variable Loading Issues
**Theory:** Even with the env var fix, variables aren't being loaded correctly in the test environment.

**Evidence to Gather:**
- Verify API key is actually loaded in Vite dev server
- Check if `import.meta.env.VITE_DEEPGRAM_API_KEY` has value in test
- Verify Playwright is passing env vars correctly
- Check if dotenv is loading from correct path

**Instrumentation Points:**
- Log `process.env.VITE_DEEPGRAM_API_KEY` in Playwright config
- Log `import.meta.env.VITE_DEEPGRAM_API_KEY` in component
- Log API key value in WebSocketManager
- Log API key length/type at each stage

### Hypothesis D: WebSocket Connection Issues
**Theory:** WebSocket is failing to connect due to authentication or protocol issues.

**Evidence to Gather:**
- Check WebSocket URL construction
- Verify protocol array format
- Check for authentication errors
- Monitor WebSocket readyState transitions

**Instrumentation Points:**
- Log WebSocket URL and protocol array
- Log WebSocket readyState changes
- Log WebSocket error events
- Log WebSocket close events with codes
- Log authentication handshake timing

### Hypothesis E: Component Initialization Timing (Lower Priority)
**Theory:** Component isn't initializing correctly or timing out before connection can be established.

**Note:** This is less likely since v0.6.9 was released with tests passing. However, the test environment may differ from the original test setup.

**Evidence to Gather:**
- Check component mount/initialization
- Verify lazy initialization behavior
- Check if connection is being triggered correctly
- Monitor component state transitions

**Instrumentation Points:**
- Log component mount/unmount
- Log lazy initialization triggers
- Log connection attempts
- Log component state changes

## Debugging Plan

### Phase 1: Environment Variable Verification (PRIMARY FOCUS)

**Goal:** Confirm API key is being loaded correctly at each stage.

**Steps:**
1. Add instrumentation to Playwright config to log `process.env.VITE_DEEPGRAM_API_KEY`
2. Add instrumentation to Vite dev server startup to log env vars
3. Add instrumentation to component to log `import.meta.env.VITE_DEEPGRAM_API_KEY`
4. Add instrumentation to WebSocketManager to log API key value/length
5. **Use stashed debug instrumentation** - Already has API key logging in component and WebSocketManager
6. Run test and collect logs

**Expected Outcome:** Identify where API key is lost or becomes undefined/empty.

**Stashed Changes Available:**
- Debug instrumentation in `DeepgramVoiceInteraction/index.tsx` (logs API key at component props, getConnectionOptions)
- Debug instrumentation in `WebSocketManager.ts` (logs API key during WebSocket creation)
- These can be restored and used for Phase 1

### Phase 2: WebSocket Connection Analysis (PRIMARY FOCUS)

**Goal:** Understand why WebSocket connection isn't reaching "connected" state.

**Steps:**
1. Add instrumentation to log WebSocket URL construction
2. Add instrumentation to log protocol array (check for empty string vs undefined)
3. Add instrumentation to log WebSocket events (onopen, onerror, onclose)
4. Add instrumentation to log readyState transitions
5. **Use stashed debug instrumentation** - May already have WebSocket logging
6. Run test and analyze connection lifecycle

**Expected Outcome:** Identify why connection fails or times out.

**Key Questions:**
- Is WebSocket created with `['token', '']` (empty string) or `['token', undefined]`?
- Does `onopen` fire?
- What error codes are received?
- What is the readyState progression?

### Phase 3: Component Behavior Verification (If Phases 1-2 don't resolve)

**Goal:** Verify component behaves as tests expect.

**Steps:**
1. Add instrumentation to log component initialization
2. Add instrumentation to log DOM element presence (especially `[data-testid="connection-status"]`)
3. Add instrumentation to log connection state transitions
4. Add instrumentation to log test helper interactions
5. Run test and compare with test expectations

**Expected Outcome:** Identify mismatches between test expectations and component behavior.

**Note:** Only needed if environment variables and WebSocket connection are working correctly.

### Phase 4: Test Helper Compatibility Check (If Phases 1-3 don't resolve)

**Goal:** Verify test helpers work with v0.6.9 component.

**Steps:**
1. Compare test helper code between v0.6.9 and current
2. Add instrumentation to log helper execution
3. Add instrumentation to log helper assumptions (DOM queries, timeouts)
4. Check if `[data-testid="connection-status"]` element exists in v0.6.9
5. Run test and verify helper behavior

**Expected Outcome:** Identify helper incompatibilities with v0.6.9.

**Note:** Only needed if environment variables, WebSocket connection, and component behavior are all working correctly.

## Instrumentation Strategy

### Logging Endpoints
- **Server endpoint:** `http://127.0.0.1:7244/ingest/1ac8ac92-902e-45db-8e4f-262b6d84a922`
- **Log path:** `/Users/davidmcgee/Development/dg_react_agent/.cursor/debug.log`

### Key Instrumentation Points

1. **Playwright Config (`test-app/tests/playwright.config.mjs`):**
   - Log `process.env.VITE_DEEPGRAM_API_KEY` value/length
   - Log `webServer.env` values being passed
   - Log dotenv loading results

2. **Component (`src/components/DeepgramVoiceInteraction/index.tsx`):**
   - Log `import.meta.env.VITE_DEEPGRAM_API_KEY` value/length
   - Log component initialization
   - Log connection state changes
   - Log DOM element presence

3. **WebSocketManager (`src/utils/websocket/WebSocketManager.ts`):**
   - Log API key value/length in `connect()`
   - Log WebSocket URL construction
   - Log protocol array
   - Log WebSocket events (onopen, onerror, onclose)
   - Log readyState transitions

4. **Test Helpers (`test-app/tests/e2e/helpers/test-helpers.js`):**
   - Log helper execution flow
   - Log DOM queries and results
   - Log connection state checks
   - Log timeouts and waits

## Success Criteria

Tests should pass when:
1. ✅ API key is correctly loaded at all stages
2. ✅ Component initializes correctly
3. ✅ WebSocket connects successfully
4. ✅ Connection reaches "connected" state
5. ✅ Test helpers can detect connection state
6. ✅ All `text-session-flow` tests pass

## Next Steps

1. **Start with Phase 1:** Environment variable verification
2. **Gather runtime evidence** from instrumentation
3. **Analyze logs** to identify root cause
4. **Apply fixes** based on evidence
5. **Verify** with test runs
6. **Iterate** if needed

## Notes

- Use debug mode logging (fetch to debug server)
- Clear log file before each test run
- Keep instrumentation until issue is resolved
- Document findings in this file
- Update Issue #341 documentation with test environment fixes

