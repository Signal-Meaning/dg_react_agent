# E2E Tests for Deepgram Voice Agent

## ⚠️ IMPORTANT: Real API Key Required

These E2E tests use **REAL Deepgram WebSocket connections**, not mocks. This provides authentic integration testing but requires a valid Deepgram API key.

**Backend matrix:** Some specs assume **Deepgram** only (e.g. CLIENT_MESSAGE_TIMEOUT, Deepgram proxy); others are **OpenAI-proxy-only** (Issue #381). See [E2E-BACKEND-MATRIX.md](./E2E-BACKEND-MATRIX.md) for which specs to run with which backend.

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
# Run all E2E tests (foreground, blocks terminal)
npm run test:e2e

# Run all E2E tests and capture output to a file (recommended for long runs)
# Output is printed and saved to e2e-run.log in the project root
npm run test:e2e:log

# Run all E2E tests in background (monitorable, for long test runs)
npm run test:e2e:background

# Monitor test progress (in another terminal)
npm run test:e2e:monitor

# Run specific test file
npx playwright test tests/e2e/text-only-conversation.spec.js

# Run with UI
npm run test:e2e:ui

# Run specific test categories
npx playwright test --grep "Timeout"        # All timeout-related tests
npx playwright test --grep "Idle Timeout"   # Idle timeout specific tests
npx playwright test --grep "Microphone"     # All microphone tests
```

### Using a pre-started dev server

If you already run the test-app dev server (e.g. `npm run dev` in test-app), Playwright will try to start it again by default and fail with "Port 5173 is already in use". Use a **preconfigured server** instead:

1. **Start the dev server first** (required). If you run with `E2E_USE_EXISTING_SERVER=1` but nothing is serving the app, every test will fail with `net::ERR_EMPTY_RESPONSE at http://localhost:5173`.
   ```bash
   cd test-app && npm run dev
   ```
   For proxy-mode tests, also start the proxy (in another terminal):
   ```bash
   cd test-app && npm run test:proxy:server
   ```
2. Run Playwright with `E2E_USE_EXISTING_SERVER=1` so it does not start the webServer:
   ```bash
   # From test-app:
   E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e
   ```
   Or from **project root**:
   ```bash
   E2E_USE_EXISTING_SERVER=1 npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js
   ```
   When `E2E_USE_EXISTING_SERVER=1` is set, a startup check verifies the app is reachable and exits with a clear error if not.

If the app uses **HTTPS** (e.g. `HTTPS=true` in test-app/.env), set the base URL when running Playwright:
   ```bash
   E2E_USE_EXISTING_SERVER=1 VITE_BASE_URL=https://localhost:5173 npx playwright test ...
   ```

**Note:** Safari may refuse self-signed HTTPS for localhost. For manual browsing use Chrome, or trust the self-signed cert in Keychain. Playwright runs in Chromium by default, so E2E tests are unaffected.

### Running Tests in Background (Monitorable Mode)

For comprehensive test runs (all 217 tests, takes 2-3 hours), use background mode:

```bash
cd test-app

# Start tests in background with logging (recommended - more robust)
bash -c 'mkdir -p ../test-results/e2e-runs && USE_PROXY_MODE=true npm run test:e2e > ../test-results/e2e-runs/e2e-$(date +%Y%m%d-%H%M%S).log 2>&1' &

# Alternative: Simple version (if the above doesn't work in your shell)
mkdir -p ../test-results/e2e-runs
USE_PROXY_MODE=true npm run test:e2e > ../test-results/e2e-runs/e2e-$(date +%Y%m%d-%H%M%S).log 2>&1 &

# In another terminal, monitor progress
npm run test:e2e:monitor
```

**Background Mode Features:**
- ✅ Non-blocking - terminal remains available
- ✅ Logged output - all test output saved to timestamped log file
- ✅ Monitorable - real-time progress monitoring
- ✅ Automatic log file naming - `test-results/e2e-runs/e2e-YYYYMMDD-HHMMSS.log`

**Monitoring Test Progress:**
```bash
# Monitor most recent test run
npm run test:e2e:monitor

# Monitor specific log file
../scripts/monitor-e2e-tests.sh test-results/e2e-runs/e2e-20260120-064800.log
```

The monitor displays:
- Test progress (passed/failed counts)
- Recent test activity (last 15 lines)
- Test status updates
- Updates every 5 seconds

**Note:** Tests are NOT automatically set to run in background mode. Use the background operator (`&`) explicitly when you need monitorable long-running test suites (e.g., for release validation).

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
- **`lazy-initialization-e2e.spec.js`** - Lazy initialization behavior (no auto-connect, Issue #206)

### Security & Authentication Tests
- **`deepgram-backend-proxy-authentication.spec.js`** - Backend proxy authentication and security tests (11 tests)
  - Basic authentication (Issue #242)
  - Invalid token rejection (Issue #363)
  - Token expiration handling (Issue #363)
  - CORS/security headers validation (Issue #363)
  - ⚠️ **Requires real APIs - skips in CI**
- **`api-key-security-proxy-mode.spec.js`** - API key security validation (11 tests) (Issue #369)
  - Bundle, network, DOM, console, and proxy backend security validation
  - ⚠️ **Requires real APIs - skips in CI**

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
- **`real-user-workflows.spec.js`** - Real-world user interaction workflows (includes error handling)
- **`page-content.spec.js`** - Basic component rendering validation
- **`dual-channel-text-and-microphone.spec.js`** - Dual channel (text + microphone) tests (5 tests) (Issue #369)
  - Channel switching scenarios
  - Connection stability during channel switching
  - Proxy mode support for both channels

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

**📖 See [E2E_TEST_DEVELOPMENT_GUIDE.md](./E2E_TEST_DEVELOPMENT_GUIDE.md) for comprehensive guide on:**
- Available fixtures and their usage
- Best practices and common patterns
- Common pitfalls to avoid
- Migration examples
- Test structure guidelines

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
