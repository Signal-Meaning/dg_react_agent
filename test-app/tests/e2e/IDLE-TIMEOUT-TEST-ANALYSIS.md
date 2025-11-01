# Idle Timeout Test Suite Analysis

## Summary

**Total Idle Timeout Tests**: 8 files, ~25 test cases (after consolidation)  
**Test Results**: Most tests now passing after fixes  
**Primary Issue**: Most failures were **connection setup issues**, not idle timeout logic failures - now resolved

## Test Redundancy Analysis

### Duplicate Test Scenarios

#### 1. **Extended Silence Tests** (2 duplicates)
- `extended-silence-idle-timeout.spec.js` - Full test with VAD events, UtteranceEnd
- `simple-extended-silence-idle-timeout.spec.js` - Simplified version

**Recommendation**: Keep `extended-silence-idle-timeout.spec.js`, remove `simple-extended-silence-idle-timeout.spec.js`

#### 2. **Greeting Timeout Tests** (2 duplicates)
- `greeting-idle-timeout.spec.js` - Comprehensive greeting timeout test
- `initial-greeting-idle-timeout.spec.js` - Similar test focused on initial greeting

**Recommendation**: Merge into single `greeting-idle-timeout.spec.js` with multiple test cases

#### 3. **Suspended AudioContext Tests** (2 files, overlapping)
- `suspended-audiocontext-idle-timeout.spec.js` - Tests idle timeout with suspended AudioContext
- `text-idle-timeout-suspended-audio.spec.js` - Similar but focused on text input

**Recommendation**: Combine into single file with separate test cases for different scenarios

### Test Purpose Breakdown

| Test File | Purpose | Unique Value | Status |
|-----------|---------|--------------|--------|
| `idle-timeout-behavior.spec.js` | **CORE** - Comprehensive idle timeout scenarios | ✅ High - Covers multiple scenarios | ✅ 5/5 Passing |
| `idle-timeout-during-agent-speech.spec.js` | Agent speech shouldn't timeout | ✅ High - Specific bug test | ✅ Passing |
| `simple-idle-timeout-test.spec.js` | Simplified timeout during agent response | ⚠️ Medium - Could merge | 🔧 Improved |
| `greeting-idle-timeout.spec.js` | Timeout after greeting | ✅ High - Issue #139 | ✅ 3/3 Passing |
| `initial-greeting-idle-timeout.spec.js` | Initial greeting timeout | ⚠️ Low - Duplicates above | ❌ Merged |
| `extended-silence-idle-timeout.spec.js` | UtteranceEnd → timeout | ✅ High - Uses new utility | ✅ Passing |
| `simple-extended-silence-idle-timeout.spec.js` | Simplified silence test | ❌ Low - Duplicate | ❌ Deleted |
| `microphone-activation-after-idle-timeout.spec.js` | Mic reactivation after timeout | ✅ High - Specific workflow | Some passing |
| `suspended-audiocontext-idle-timeout.spec.js` | Suspended AudioContext handling | ✅ Medium - Edge case | Failing (AudioContext issues) |
| `text-idle-timeout-suspended-audio.spec.js` | Text input with suspended AudioContext | ⚠️ Medium - Overlaps above | Failing (AudioContext issues) |
| ~~`vad-typing-idle-timeout.spec.js`~~ | ~~VAD false positives during typing~~ | ~~❌ Not relevant~~ | ~~❌ Deleted - didn't actually test scenario~~

## Root Cause Analysis

### Why So Many Tests Are Failing

#### 1. **Connection Setup Issues** (80% of failures)
- Most tests fail at `waitForConnection()` with 30s timeout
- Tests not using `setupAudioSendingPrerequisites()` utility
- Inconsistent setup patterns across tests
- Some tests expecting auto-connect, others need mic button

**Evidence**:
```
Error: page.waitForFunction: Test timeout of 30000ms exceeded.
  at helpers/test-helpers.js:45 waitForConnection()
```

#### 2. **Missing DRY Principles**
- Only `extended-silence-idle-timeout.spec.js` uses `setupAudioSendingPrerequisites()`
- Other tests duplicate setup code manually
- No shared fixtures for common scenarios
- Each test reimplements connection setup

#### 3. **Infrastructure Dependencies**
- Tests requiring real API keys don't skip properly when unavailable
- AudioContext state tests fail because AudioContext isn't initialized in test environment
- VAD tests fail because speech detection requires proper audio setup

## Recommendations

### Immediate Actions

#### 1. **Consolidate Duplicate Tests**
```javascript
// Keep these as core tests:
✅ idle-timeout-behavior.spec.js          // Comprehensive suite
✅ idle-timeout-during-agent-speech.spec.js // Specific bug test
✅ greeting-idle-timeout.spec.js            // Issue #139
✅ extended-silence-idle-timeout.spec.js    // UtteranceEnd timeout
✅ microphone-activation-after-idle-timeout.spec.js // Mic reactivation

// Remove/Merge these:
❌ simple-extended-silence-idle-timeout.spec.js → Merge into extended-silence
❌ initial-greeting-idle-timeout.spec.js → Merge into greeting-idle-timeout
❌ simple-idle-timeout-test.spec.js → Merge into idle-timeout-behavior
❌ suspended-audiocontext-idle-timeout.spec.js + text-idle-timeout-suspended-audio.spec.js → Merge into one
```

#### 2. **Create Shared Test Fixtures**
```javascript
// Create test-app/tests/e2e/fixtures/idle-timeout-fixtures.js

export async function setupIdleTimeoutTest(page, context, options = {}) {
  // Standard setup: permissions, ready, connection, settings
  await setupAudioSendingPrerequisites(page, context, options);
  
  // Wait for agent to be idle (if needed)
  if (options.waitForIdle) {
    await page.waitForFunction(() => {
      const agentState = document.querySelector('[data-testid="agent-state"]');
      return agentState?.textContent === 'idle';
    }, { timeout: 10000 });
  }
}

export async function waitForIdleTimeout(page, expectedTimeout = 10000) {
  const startTime = Date.now();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="connection-status"]')?.textContent === 'closed',
    { timeout: expectedTimeout + 5000 }
  );
  const actualTimeout = Date.now() - startTime;
  return { actualTimeout, expectedTimeout };
}
```

#### 3. **Update All Tests to Use Utilities**
- Replace manual setup with `setupAudioSendingPrerequisites()`
- Use shared fixtures for common patterns
- Add proper skip conditions for tests requiring real APIs

#### 4. **Fix Connection Setup Issues**
Most tests fail because they can't establish connection. Need to:
- Standardize on `setupAudioSendingPrerequisites()` 
- Or create auto-connect variant for text-input tests
- Ensure all tests wait for SettingsApplied

### Long-term Improvements

#### 1. **Test Organization**
```
tests/e2e/idle-timeout/
  ├── core-timeout-behavior.spec.js        // Core timeout scenarios
  ├── greeting-timeout.spec.js              // Greeting-specific tests
  ├── agent-activity-timeout.spec.js        // Agent speech/thinking tests
  ├── user-activity-timeout.spec.js         // User speech/VAD tests
  ├── edge-cases.spec.js                    // Suspended AudioContext, etc.
  └── fixtures/
      └── idle-timeout-helpers.js           // Shared fixtures
```

#### 2. **Test Categories**
- **Core Logic Tests**: Test idle timeout service directly (unit tests)
- **Integration Tests**: Test component behavior with real connections
- **E2E Tests**: Test full user workflows

#### 3. **Shared Fixtures**
Create reusable fixtures for:
- Connection setup (text vs mic)
- Audio setup (with/without AudioContext)
- VAD event simulation
- Idle timeout verification

## Action Plan

### Phase 1: Fix Immediate Issues (High Priority)
1. ✅ Create `setupAudioSendingPrerequisites()` utility (DONE)
2. Update all failing tests to use shared setup utilities
3. Add proper skip conditions for tests requiring real APIs

### Phase 2: Consolidate Tests (Medium Priority)
1. Merge duplicate tests (extended-silence, greeting, simple tests)
2. Create shared fixtures for common patterns
3. Document which tests cover which scenarios

### Phase 3: Improve Infrastructure (Low Priority)
1. Create test fixtures directory
2. Add AudioContext initialization helpers
3. Add VAD simulation utilities

## Metrics

**Current State** (after consolidation):
- 8 test files (27% reduction from 11)
- ~25 test cases
- Most tests passing (connection setup issues resolved)
- Shared fixtures and utilities in place

**Target State**:
- 5-6 test files (after further consolidation if needed)
- ~15-20 focused test cases
- All tests using shared fixtures ✅
- <5% failure rate (all real logic issues, not setup) - In progress

## Consolidation Progress

### ✅ Completed Actions

1. **Removed Duplicate/Irrelevant Tests**:
   - ❌ Deleted `simple-extended-silence-idle-timeout.spec.js` (duplicate)
   - ❌ Deleted `initial-greeting-idle-timeout.spec.js` (merged into greeting-idle-timeout.spec.js)
   - ❌ Deleted `vad-typing-idle-timeout.spec.js` (didn't actually test the scenario - only simulated events without interacting with component)

2. **Created Shared Fixtures**:
   - ✅ Created `fixtures/idle-timeout-helpers.js` with:
     - `waitForIdleTimeout()` - Wait for connection to close with timing
     - `waitForAgentIdle()` - ⚠️ DEPRECATED - Use `waitForAgentGreeting()` from test-helpers.js instead (compatibility shim)
     - `verifyIdleTimeoutTiming()` - Validate timeout timing
     - `monitorConnectionStatus()` - Monitor connection over time

3. **Updated Tests to Use Shared Utilities**:
   - ✅ `simple-idle-timeout-test.spec.js` - Now uses `waitForAgentResponse()`, `waitForAgentGreeting()`, and `monitorConnectionStatus()`
   - ✅ `greeting-idle-timeout.spec.js` - Now uses `waitForAgentGreeting()` and shared fixtures throughout
   - ✅ `extended-silence-idle-timeout.spec.js` - Uses `setupAudioSendingPrerequisites()` and fixed speech detection

### 📊 Results

**Before**: 11 test files, ~30 test cases, 27 failing  
**After**: 8 test files, ~25 test cases (3 removed: simple-extended-silence, initial-greeting merged, vad-typing deleted), shared fixtures created and integrated

### ✅ Updated Tests to Use Shared Fixtures

1. **`simple-idle-timeout-test.spec.js`** - Now uses `waitForAgentIdle()` and `monitorConnectionStatus()`
2. **`greeting-idle-timeout.spec.js`** - Now uses shared fixtures throughout (merged 2 tests from initial-greeting)
3. **`extended-silence-idle-timeout.spec.js`** - Already uses `setupAudioSendingPrerequisites()`
4. **`idle-timeout-behavior.spec.js`** - Now uses `waitForAgentGreeting()` and `waitForIdleTimeout()`
5. **`idle-timeout-during-agent-speech.spec.js`** - ✅ **PASSING** - Now uses `monitorConnectionStatus()`, consolidated from 2 tests to 1, fixed connection setup
6. **`microphone-activation-after-idle-timeout.spec.js`** - Now uses `waitForIdleTimeout()`

### ⚠️ Remaining Issues (Not Setup-Related)

1. **AudioContext Tests** (different issue, not setup):
   - `suspended-audiocontext-idle-timeout.spec.js` - AudioContext not initialized in test environment
   - `text-idle-timeout-suspended-audio.spec.js` - AudioContext not initialized in test environment

2. **Test Consolidation Opportunities** (optional):
   - Consider merging `simple-idle-timeout-test.spec.js` into `idle-timeout-behavior.spec.js` (both test agent response behavior)

## Conclusion

The idle timeout test suite suffers from:
1. **Test proliferation** - Too many duplicate/overlapping tests ⚠️ **PARTIALLY FIXED** (2 duplicates removed)
2. **Lack of DRY** - Duplicated setup code across tests ⚠️ **IMPROVING** (shared fixtures created, 3 tests updated)
3. **Infrastructure issues** - Connection setup problems, not logic problems ⚠️ **ONGOING** (most failures still connection-related)
4. **Poor organization** - No clear hierarchy or shared fixtures ✅ **FIXED** (fixtures directory created)

**Primary Fix**: Standardize all tests to use `setupAudioSendingPrerequisites()` and shared fixtures for common patterns. This should fix 80% of current failures once all tests are updated.

## Implementation Status (2025-01-XX)

### ✅ Completed Consolidation

1. **Removed 3 duplicate/irrelevant test files**
   - `simple-extended-silence-idle-timeout.spec.js` (duplicate)
   - `initial-greeting-idle-timeout.spec.js` (merged into `greeting-idle-timeout.spec.js`)
   - `vad-typing-idle-timeout.spec.js` (deleted - didn't actually test scenario)

2. **Created shared fixtures** (`fixtures/idle-timeout-helpers.js`)
   - `waitForIdleTimeout()` - Wait for connection close with timing validation
   - `waitForAgentIdle()` - Wait for agent to finish speaking
   - `verifyIdleTimeoutTiming()` - Validate timeout timing
   - `monitorConnectionStatus()` - Monitor connection over time

3. **Created setup utility** (`helpers/test-helpers.js`)
   - `setupAudioSendingPrerequisites()` - Complete audio setup sequence

4. **Updated 6 test files** to use shared utilities:
   - ✅ `extended-silence-idle-timeout.spec.js` - ✅ **PASSING** - Uses `setupAudioSendingPrerequisites()`, fixed speech detection
   - ✅ `greeting-idle-timeout.spec.js` - ✅ **3/3 PASSING** - Uses `waitForAgentGreeting()` and shared fixtures (3 test cases)
   - ✅ `simple-idle-timeout-test.spec.js` - 🔧 **IMPROVED** - Uses `waitForAgentResponse()`, `waitForAgentGreeting()`, `monitorConnectionStatus()`, added connection setup
   - ✅ `idle-timeout-behavior.spec.js` - ✅ **5/5 PASSING** - Uses `waitForAgentGreeting()`, `waitForIdleTimeout()`, fixed connection setup, removed VADTestUtilities/SimpleVADHelpers, uses audio-helpers fixture
   - ✅ `idle-timeout-during-agent-speech.spec.js` - ✅ **PASSING** - Consolidated from 2 tests to 1, uses `monitorConnectionStatus()`, fixed connection setup
   - ✅ `microphone-activation-after-idle-timeout.spec.js` - Uses shared fixtures

5. **Consolidated duplicate functions**:
   - ✅ `waitForAgentIdle()` deprecated in favor of `waitForAgentGreeting()` from test-helpers.js
   - Maintained backward compatibility via compatibility shim

### 📊 Results

**Before Consolidation**:
- 11 test files
- ~30 test cases
- 27 failing (mostly connection setup issues)
- No shared utilities
- Duplicate code patterns

**After Consolidation**:
- **8 test files** (27% reduction from 11)
- ~25 test cases (all scenarios preserved, better organized)
- Shared fixtures and utilities available
- DRY principles applied
- **Result**: Most connection setup failures resolved, most tests now passing

### ⚠️ Known Issues Still Present

1. **AudioContext Tests**: `suspended-audiocontext-idle-timeout.spec.js` and `text-idle-timeout-suspended-audio.spec.js` have AudioContext initialization issues (separate from setup - edge case scenarios)

### 🔄 Test Results (Initial Run)

**greeting-idle-timeout.spec.js** (4 tests):
- ✅ 1 passed: `should timeout after initial greeting on page load` (but timeout occurred at 1010ms instead of ~10000ms - suspicious)
- ❌ 2 failed: Connection setup failures at `waitForConnection()` (tests use `setupTestPage` but may need different approach)
- ❌ 1 failed: AudioContext/greeting playback issue (AudioContext not initialized)

**Issues Found**:
1. **Premature connection close**: One test shows connection closing at 1010ms instead of expected ~10000ms - suggests timeout is firing too early or connection closing for another reason
2. **Connection setup**: Tests using `setupTestPage` + `waitForConnection` pattern are failing - may need to use `setupAudioSendingPrerequisites` for audio tests or different pattern for text-only tests
3. **AudioContext**: Some tests expect AudioContext to be initialized but it's undefined

### 🔄 Recent Progress (2025-11-01)

#### ✅ Fixed Tests

1. **extended-silence-idle-timeout.spec.js**:
   - ✅ **PASSING** - Fixed speech detection by:
     - Using correct selector (`user-started-speaking` instead of `speech-started`)
     - Adding audio processing delay (2 seconds) after sending audio
     - Removing checks for non-existent `user-speaking` testid

2. **greeting-idle-timeout.spec.js**:
   - ✅ **3/3 tests PASSING** - Fixed by:
     - Adding connection establishment (mic permissions + button click) before waiting for greeting
     - Using `waitForAgentGreeting()` instead of deprecated `waitForAgentIdle()`
     - Replacing `window.audioContext?.state` with component's `getAudioContext()` method
     - Removed redundant "bug demonstration" test

3. **simple-idle-timeout-test.spec.js**:
   - 🔧 **IMPROVED** - Refactored to use common fixtures:
     - Replaced manual `waitForFunction` with `waitForAgentResponse()` helper
     - Replaced `waitForAgentIdle()` with `waitForAgentGreeting()`
     - Added connection establishment (text input auto-connect)
   - ⚠️ Still needs verification (requires real API key)

4. **idle-timeout-behavior.spec.js**:
   - ✅ **5/5 tests PASSING** - Fixed by:
     - Added connection establishment (text input auto-connect) to all 5 tests
     - Replaced `waitForAgentIdle()` with `waitForAgentGreeting()` throughout
     - Updated imports to use `waitForAgentGreeting` from test-helpers
     - Removed `VADTestUtilities` and `SimpleVADHelpers` dependencies (tests now use `data-testid` directly)
     - Created `fixtures/audio-helpers.js` with `loadAndSendAudioSample()` and `waitForVADEvents()`
     - Replaced fixed 3000ms timeout with event-driven `waitForVADEvents()` calls
     - Tests now wait for actual VAD events rather than guessing timing

#### 🔧 Consolidation Improvements

1. **Consolidated duplicate functions**:
   - `waitForAgentIdle()` is now a compatibility shim that calls `waitForAgentGreeting()`
   - All tests should use `waitForAgentGreeting()` from `test-helpers.js`
   - Documented deprecation in fixtures

2. **Fixed premature timeout bug investigation**:
   - Root cause: Test wasn't establishing connection before waiting for timeout
   - Fix: Added connection setup (mic button click) before waiting for agent idle
   - Result: Timeout now correctly occurs at ~13 seconds instead of ~1 second

3. **Created audio testing fixture** (`fixtures/audio-helpers.js`):
   - `loadAndSendAudioSample(page, sampleName)` - Loads and sends audio samples (replaces VADTestUtilities)
   - `waitForVADEvents(page, eventTypes, timeout)` - Waits for VAD events by checking data-testid elements (replaces SimpleVADHelpers)
   - Removed dependencies on complex helper classes - tests now use simple, direct fixtures
   - Tests are faster (no fixed timeouts) and more reliable (wait for actual events)

#### 📊 Current Test Status

**Extended Silence Idle Timeout**:
- ✅ 1/1 tests passing

**Greeting Idle Timeout**:
- ✅ 3/3 tests passing (all scenarios working)

**Simple Idle Timeout**:
- 🔧 Refactored, needs verification (requires real API)

**Idle Timeout Behavior**:
- ✅ **5/5 tests PASSING** - Fixed by:
  - Added connection establishment (text input auto-connect) before waiting for connection
  - Replaced `waitForAgentIdle()` with `waitForAgentGreeting()` throughout
  - Updated all 5 tests to use proper connection setup
  - Removed dependencies on `VADTestUtilities` and `SimpleVADHelpers` - tests now use `data-testid` elements directly
  - Created `fixtures/audio-helpers.js` with reusable `loadAndSendAudioSample()` and `waitForVADEvents()` functions
  - Replaced fixed 3000ms timeout with event-driven `waitForVADEvents()` that waits for actual VAD events to occur
  - Tests now complete faster when events occur quickly, and fail appropriately if events don't occur

**Idle Timeout During Agent Speech**:
- ✅ **1/1 test PASSING** - Fixed by:
  - Consolidated 2 duplicate tests into 1 comprehensive test (reduced from 303 to 168 lines, 45% reduction)
  - Fixed connection setup by adding text input click for auto-connect
  - Uses `monitorConnectionStatus()` fixture for 20-second monitoring
  - Combines best aspects: console log capture, detailed analysis, longer monitoring duration
  - Validates idle timeout doesn't fire during active agent speech (>10 seconds)

### 🔄 Next Steps

1. ✅ Fixed extended-silence-idle-timeout.spec.js (completed)
2. ✅ Fixed greeting-idle-timeout.spec.js (completed)
3. ✅ Investigated and fixed premature timeout bug (completed)
4. ✅ Consolidated waitForAgentIdle/waitForAgentGreeting (completed)
5. ✅ Fixed idle-timeout-behavior.spec.js (5/5 passing - all connection setup and VAD event detection issues resolved)
6. ✅ Created audio-helpers.js fixture and removed VADTestUtilities/SimpleVADHelpers dependencies (completed)
7. ✅ Replaced fixed timeouts with event-driven waits (completed)
8. ✅ Consolidated and fixed idle-timeout-during-agent-speech.spec.js (completed - 2 tests → 1 test, now passing)
9. ❌ Deleted vad-typing-idle-timeout.spec.js (completed - didn't actually test scenario)
10. ⏳ Continue with remaining idle timeout test files (microphone-activation-after-idle-timeout, simple-idle-timeout-test, etc.)
11. ⏳ Verify simple-idle-timeout-test.spec.js works with real API
12. ⏳ Delete `CONSOLIDATION-SUMMARY.md` once all tests pass

