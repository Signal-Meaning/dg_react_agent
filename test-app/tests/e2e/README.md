# E2E Tests for Deepgram Voice Agent

## ⚠️ IMPORTANT: Real API Key Required

These E2E tests use **REAL Deepgram WebSocket connections**, not mocks. This provides authentic integration testing but requires a valid Deepgram API key.

## Setup

### 1. Get a Deepgram API Key
- Sign up at [https://deepgram.com](https://deepgram.com)
- Get a free API key (includes free credits for testing)

### 2. Configure Environment Variables
Create or update `test-app/.env` with your real API credentials:

```bash
# Required for E2E tests
VITE_DEEPGRAM_API_KEY=your-real-deepgram-api-key-here
VITE_DEEPGRAM_PROJECT_ID=your-real-project-id-here

# Optional configuration
VITE_DEEPGRAM_MODEL=nova-2
VITE_DEEPGRAM_LANGUAGE=en-US
VITE_DEEPGRAM_VOICE=aura-asteria-en
```

### 3. Run Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/auto-connect-dual-mode.spec.js

# Run with UI
npm run test:e2e:ui

# Run specific test categories
npx playwright test --grep "Timeout"        # All timeout-related tests
npx playwright test --grep "Idle Timeout"   # Idle timeout specific tests
npx playwright test --grep "Microphone"     # All microphone tests
```

## Why Real API Key Instead of Mocks?

| Real API Key | Mocked API |
|--------------|------------|
| ✅ Authentic integration testing | ❌ Mock behavior may drift from real |
| ✅ Catches real connection issues | ❌ Misses integration problems |
| ✅ Tests actual WebSocket protocols | ❌ Complex mock maintenance |
| ✅ Zero mock development time | ❌ 13-19 hours of mock development |
| ✅ Always up-to-date with API changes | ❌ Mocks need constant updates |

## Test Files

### Protocol & Connection Tests
- **`deepgram-ux-protocol.spec.js`** - UX-focused protocol validation tests (3 tests)
- **`protocol-validation-modes.spec.js`** - Real API + Mock mode validation (2 tests)
- **`api-key-validation.spec.js`** - API key validation and error handling
- **`auto-connect-dual-mode.spec.js`** - Auto-connect behavior and dual mode functionality
- **`auto-connect-behavior.spec.js`** - Auto-connect property behavior validation
- **`auto-connect-prop-behavior.spec.js`** - Auto-connect prop edge cases

### Timeout & Reconnection Tests
- **`websocket-timeout-context-preservation.spec.js`** - Context preservation across timeout with TEXT input (accelerated time)
- **`idle-timeout-behavior.spec.js`** - Idle timeout behavior in various scenarios (reconnection, active conversation)
- **`microphone-reliability.spec.js`** - Microphone state reliability with manual timeout trigger

### Microphone & Audio Tests
- **`microphone-control.spec.js`** - Microphone enable/disable and state management  
- **`microphone-functionality.spec.js`** - Microphone feature validation
- **`simple-mic-test.spec.js`** - Simple microphone state tests
- **`greeting-audio-timing.spec.js`** - Audio greeting timing and AudioContext initialization

### Conversation & Interaction Tests
- **`text-only-conversation.spec.js`** - Text-only conversation without audio
- **`real-user-workflows.spec.js`** - Real-world user interaction workflows

### VAD (Voice Activity Detection) Tests
- **`vad-websocket-events.spec.js`** - VAD event WebSocket validation
- **`vad-realistic-audio.spec.js`** - Realistic TTS audio simulation for VAD testing ⚠️ **CI SKIPPED**
- **`vad-advanced-simulation.spec.js`** - Advanced VAD audio simulation patterns ⚠️ **CI SKIPPED**
- **`manual-vad-workflow.spec.js`** - Manual VAD workflow testing ⚠️ **CI SKIPPED**
- **`diagnostic-vad.spec.js`** - VAD diagnostic tests

### Configuration & Setup Tests
- **`deepgram-instructions-file.spec.js`** - Custom instructions file loading

### Diagnostic & Error Tests
- **`manual-diagnostic.spec.js`** - Manual testing diagnostics
- **`js-error-test.spec.js`** - JavaScript error detection
- **`react-error-test.spec.js`** - React error boundary testing
- **`page-content.spec.js`** - Basic page content validation

### Test Utilities
- **`helpers/test-helpers.js`** - Shared test utilities (see below)
- **`helpers/audio-mocks.js`** - Audio API mocking utilities

## Writing New Tests

### Using Test Helpers

All tests should use the shared helpers in `helpers/test-helpers.js` for consistency:

```javascript
const {
  SELECTORS,                    // Centralized UI selectors
  setupTestPage,                // Navigate and wait for component load
  waitForConnection,            // Wait for protocol handshake
  waitForAgentGreeting,         // Wait for agent greeting
  sendTextMessage,              // Send text via UI
  installWebSocketCapture,      // Capture WebSocket messages
  installMockWebSocket,         // Mock WebSocket for tests
  assertConnectionHealthy,      // Verify connection state
} = require('./helpers/test-helpers');

test('my new test', async ({ page }) => {
  // Setup
  await setupTestPage(page);
  await waitForConnection(page);
  
  // Action
  await sendTextMessage(page, 'Hello');
  
  // Assert
  await assertConnectionHealthy(page, expect);
});
```

### Benefits of Using Helpers

- ✅ **DRY**: No duplicated setup/assertion code
- ✅ **Consistent**: All tests follow same patterns
- ✅ **Maintainable**: Change once, affects all tests
- ✅ **Readable**: High-level actions instead of low-level Playwright calls

## Notable Test Scenarios

### Idle Timeout Behavior

**File:** `idle-timeout-behavior.spec.js`

**Purpose:** Comprehensive test suite for idle timeout behavior in realistic conversation scenarios.

**Test Cases:**

#### 1. Microphone Activation After Idle Timeout (Issue #58)
Validates that users can reactivate the microphone after connection times out.

**Scenario:**
1. Component auto-connects successfully
2. No user activity for 12 seconds (triggers 10s idle timeout)
3. User clicks microphone button to start voice input
4. Expected: Connection re-establishes and microphone enables

**Status:** ✅ PASSING (Issue #58 fixed)

#### 2. Active Conversation Continuity
Validates that connection stays alive during active conversation with natural pauses.

**Scenario:**
1. User speaks (triggers UtteranceEnd after brief pause)
2. User continues speaking after pause
3. Expected: Connection stays alive, doesn't timeout mid-conversation
4. Tests that idle timeout resets on any activity (user OR agent)

**Status:** ✅ PASSING (validates fix for premature timeout bug)

**Why These Tests are Important:**
- **Real-world scenarios**: Tests natural conversation flows with pauses
- **Different from `websocket-timeout-context-preservation.spec.js`**: That test uses TEXT input with accelerated time (15 min keepalive timeout)
- **Different from `microphone-reliability.spec.js`**: That test uses manual "Trigger Timeout" button

**Run:**
```bash
npx playwright test tests/e2e/idle-timeout-behavior.spec.js
```

### VAD Test Status

**File:** `vad-realistic-audio.spec.js`, `vad-advanced-simulation.spec.js`, `manual-vad-workflow.spec.js`

**Purpose:** Test Voice Activity Detection (VAD) events with realistic audio simulation.

**Current Status:**
- ✅ **Audio Simulation**: Working (121,600 bytes generated and transmitted)
- ✅ **Agent Service**: Connected successfully  
- ✅ **Microphone**: Enabled properly
- ❌ **Transcription Service**: Not connecting (required for VAD events)
- ❌ **VAD Events**: Not triggered (depends on transcription service)

**CI Behavior:**
- **Local Development**: Tests run but fail due to transcription service issue
- **CI Environment**: Tests are properly skipped with message: *"VAD tests require real Deepgram API connections - skipped in CI"*

**Related Issues:**
- [Issue #95](https://github.com/Signal-Meaning/dg_react_agent/issues/95): VAD Events Not Triggered by Simulated Audio in Tests
- [Issue #99](https://github.com/Signal-Meaning/dg_react_agent/issues/99): Add Mock Feature Extensions for CI Testing

**Run:**
```bash
# Run VAD tests locally (will fail due to transcription service issue)
npx playwright test tests/e2e/vad-realistic-audio.spec.js

# Verify CI skip behavior
CI=true npx playwright test tests/e2e/vad-realistic-audio.spec.js
```

## Troubleshooting

### Tests Fail with "Connection Closed"
- Check that `VITE_DEEPGRAM_API_KEY` is set in `test-app/.env`
- Verify the API key is valid and has credits
- Ensure the API key is not a placeholder value

### Tests Fail with "API Key Required"
- The test app will show a red error banner if the API key is missing
- Follow the instructions in the error banner to set up your `.env` file

### Component Not Ready / Microphone Button Disabled
- This usually means the component couldn't connect to Deepgram
- Check your API key and network connection
- Look for console errors in the browser

## Alternative Testing

If you need to run tests without a real API key:

1. **Use Jest Unit Tests**: `npm test` (uses mocks)
2. **Use Component Tests**: `npm run test:components` (isolated testing)
3. **Set up Test Account**: Get a free Deepgram account for testing

## Cost Considerations

- Deepgram offers free credits for new accounts
- E2E tests use minimal API calls (just connection + greeting)
- Estimated cost: < $1/month for regular testing
- Much cheaper than 13-19 hours of mock development time
