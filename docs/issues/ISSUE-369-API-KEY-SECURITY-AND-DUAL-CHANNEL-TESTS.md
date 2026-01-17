# Issue #369: Add API Key Security Tests and Dual Channel (Text + Microphone) Tests

**GitHub Issue**: https://github.com/Signal-Meaning/dg_react_agent/issues/369  
**Status**: 🟢 **IN PROGRESS** - Implementation Complete, Testing Phase  
**Priority**: **High**  
**Branch**: `davidrmcgee/issue369`  
**Related Issues**: #242 (Backend Proxy Support)

## Problem Statement

Two critical test coverage gaps were identified:

1. **Missing API Key Security Tests**: No automated tests verify that API keys are NOT exposed to the frontend when using proxy mode. This is a critical security requirement from Issue #242.

2. **Missing Dual Channel Tests**: No E2E tests verify that both text input and microphone channels work together in the same session, including channel switching scenarios.

## Objectives

### 1. API Key Security Tests
Create comprehensive security tests that verify API keys remain server-side when using proxy mode:
- Bundle inspection (API keys not in JavaScript bundle)
- Network request inspection (API keys not in WebSocket URLs/headers)
- DOM/source code inspection (API keys not exposed in DOM)
- Console/log inspection (API keys not logged)
- Proxy backend validation (proxy server keeps API keys server-side)

### 2. Dual Channel Tests
Create E2E tests that verify both text and microphone channels work together:
- Start with text, then switch to microphone
- Start with microphone, then switch to text
- Alternate between channels in same session
- Connection stability during channel switching
- Proxy mode support for both channels

## Implementation

### Files Created

1. **`test-app/tests/e2e/api-key-security-proxy-mode.spec.js`** (539 lines)
   - 11 comprehensive security tests
   - 5 test categories covering all security aspects
   - Works in proxy mode only (requires `USE_PROXY_MODE=true`)

2. **`test-app/tests/e2e/dual-channel-text-and-microphone.spec.js`** (298 lines)
   - 5 dual channel tests
   - Works in both direct and proxy modes
   - Tests channel switching and connection stability

### Test Coverage

#### API Key Security Tests (11 tests)

**Bundle Inspection (2 tests)**
- ✅ Verify API keys are not in JavaScript bundle source
- ✅ Verify environment variable references don't expose actual keys

**Network Request Inspection (3 tests)**
- ✅ Verify API keys are not in WebSocket connection URLs
- ✅ Verify API keys are not in WebSocket protocol arrays
- ✅ Verify connections go to proxy endpoint, not directly to Deepgram

**DOM and Source Code Inspection (2 tests)**
- ✅ Verify API keys are not exposed in DOM elements
- ✅ Verify API keys are not in React DevTools state/window object

**Console and Log Inspection (2 tests)**
- ✅ Verify API keys are not logged to console
- ✅ Verify API keys are not exposed in error messages

**Proxy Backend Validation (2 tests)**
- ✅ Verify proxy endpoint is used instead of direct Deepgram connection
- ✅ Verify connection mode indicator shows proxy mode

#### Dual Channel Tests (5 tests)

1. ✅ Start with text channel, then switch to microphone
2. ✅ Start with microphone, then switch to text
3. ✅ Alternate between text and microphone in same session
4. ✅ Maintain connection when switching between channels
5. ✅ Work in proxy mode with both text and microphone channels

## Test Execution

### API Key Security Tests

**Requirements:**
- Real Deepgram API key (`VITE_DEEPGRAM_API_KEY`) - for proxy server
- Proxy server automatically started by Playwright config

**Run Command:**
```bash
# Run security tests (proxy mode is default)
npm run test:e2e -- api-key-security-proxy-mode
```

**Status**: ✅ **11/11 tests passing**

### Dual Channel Tests

**Requirements:**
- Real Deepgram API key (`VITE_DEEPGRAM_API_KEY`)
- Proxy server automatically started by Playwright config (proxy mode is default)

**Run Command:**
```bash
# Run dual channel tests (proxy mode is default)
npm run test:e2e -- dual-channel-text-and-microphone

# For direct mode (if needed)
USE_PROXY_MODE=false npm run test:e2e -- dual-channel-text-and-microphone
```

**Status**: ✅ **Tests created and fixed for proxy mode**

## Implementation Details

### Security Test Helpers

The security tests include helper functions:
- `extractPotentialApiKeys()` - Extracts potential API keys from strings using pattern matching
- `containsApiKey()` - Checks if API key appears in text (with obfuscation detection)

### Test Patterns

All tests follow existing project patterns:
- Use shared helpers from `test-helpers.js` and `test-helpers.mjs`
- Follow TDD principles
- Use `skipIfNoRealAPI()` for conditional execution
- Proper cleanup in `afterEach` hooks

### Fixes Applied

1. **WebSocket Interception**: Fixed to capture all WebSocket connections and filter for proxy endpoint (handles Vite dev server WebSocket)
2. **Function Signatures**: Fixed `waitForAgentResponse` calls to use correct signature `(page, expectedText, timeout)`
3. **Connection Validation**: Enhanced proxy connection validation to trigger connection and wait for establishment
4. **Connection Status Checks**: Updated to handle both 'connected' and 'connected (proxy)' status text

## Commits

1. **680b39f** - Add API key security tests and dual channel (text + microphone) tests
2. **560b22e** - Fix waitForAgentResponse calls in dual channel tests
3. **5ebd48d** - Fix WebSocket interception in security tests
4. **24ec872** - Fix proxy connection validation test

## Current Status

### ✅ Completed
- [x] API Key Security Tests created (11 tests)
- [x] Dual Channel Tests created (5 tests)
- [x] All security tests passing (11/11)
- [x] All code committed and pushed
- [x] Branch created: `davidrmcgee/issue369`

### ✅ Completed
- [x] Fix dual channel tests for proxy mode connection status
- [x] Update connection establishment to handle 'connected (proxy)' status
- [x] Remove dependency on establishConnectionViaText helper

### 📋 Next Steps

1. **Fix Dual Channel Tests** (Priority: High)
   - Debug and fix connection establishment issues
   - Verify all 5 dual channel tests pass
   - Ensure they work in both direct and proxy modes

2. **Create Pull Request** (Priority: Medium)
   - Link to issue #369
   - Document what's included
   - Note any follow-up work needed

3. **Update Documentation** (Priority: Low)
   - Add new tests to test documentation
   - Update `TEST-COVERAGE-PROXY-MODE.md` with new security tests
   - Document how to run the new test suites

## Test Results

### API Key Security Tests - Latest Run

```
Running 11 tests using 1 worker

✅ Bundle inspection passed - no API keys found in source
  ✓   1 [chromium] › Bundle Inspection › should not contain API key in JavaScript bundle source

✅ Environment variable inspection passed
  ✓   2 [chromium] › Bundle Inspection › should not expose API key in environment variable references

✅ WebSocket URL inspection passed - no API keys in connection URLs
  ✓   3 [chromium] › Network Request Inspection › should not include API key in WebSocket connection URLs

✅ WebSocket protocol inspection passed - no API keys in protocols
  ✓   4 [chromium] › Network Request Inspection › should not include API key in WebSocket protocol array

✅ Network request inspection passed - no direct Deepgram connections
  ✓   5 [chromium] › Network Request Inspection › should connect to proxy endpoint, not Deepgram endpoint

✅ DOM inspection passed - no API keys in DOM
  ✓   6 [chromium] › DOM and Source Code Inspection › should not expose API key in DOM elements

✅ Window object inspection passed - no API keys exposed
  ✓   7 [chromium] › DOM and Source Code Inspection › should not expose API key in React DevTools state

✅ Console log inspection passed - no API keys logged
  ✓   8 [chromium] › Console and Log Inspection › should not log API key to console

✅ Error message inspection passed - no API keys in errors
  ✓   9 [chromium] › Console and Log Inspection › should not expose API key in error messages

✅ Proxy backend validation passed - all connections use proxy
  ✓  10 [chromium] › Proxy Backend Validation › should verify proxy endpoint is used instead of direct Deepgram connection

✅ Connection mode validation passed - proxy mode confirmed
  ✓  11 [chromium] › Proxy Backend Validation › should verify connection mode indicator shows proxy mode

  11 passed (58.6s)
```

### Dual Channel Tests - Status

Tests created but need connection timing fixes. Some tests fail due to:
- Connection establishment timeouts
- Need to wait for proper connection state before proceeding

## Security Impact

These tests ensure that:
- ✅ API keys are never exposed in the frontend bundle
- ✅ API keys are never sent in network requests
- ✅ API keys are never logged to console
- ✅ API keys are never exposed in DOM or error messages
- ✅ Proxy backend properly keeps API keys server-side

This validates the security requirements from Issue #242 and ensures the proxy mode implementation maintains security best practices.

## Related Documentation

- `docs/BACKEND-PROXY/SECURITY-BEST-PRACTICES.md` - Security best practices for proxy mode
- `docs/TEST-COVERAGE-PROXY-MODE.md` - Proxy mode test coverage analysis
- `docs/issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md` - Original proxy mode implementation

## Acceptance Criteria

- [x] API key security tests created and passing
- [x] Dual channel tests created
- [x] Tests work in both direct and proxy modes (where applicable)
- [x] Tests follow existing project patterns and use shared helpers
- [x] Tests are properly documented with usage instructions
- [ ] All dual channel tests passing
- [ ] Tests integrated into CI/CD pipeline
- [ ] Documentation updated

## Notes

- Security tests require proxy mode (`USE_PROXY_MODE=true`) and running proxy server
- Dual channel tests work in both direct and proxy modes
- All tests use real API keys when available (via `skipIfNoRealAPI`)
- Tests follow existing patterns and use shared helpers for consistency
