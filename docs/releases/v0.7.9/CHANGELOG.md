# Changelog - v0.7.9

**Release Date**: January 17, 2026  
**Release Type**: Patch Release

## Added

### Security Test Expansion (Issue #363)
- **Backend Proxy Authentication Tests**: Expanded from 2 to 11 comprehensive security tests
  - Invalid authentication token rejection (2 tests)
  - Malformed authentication token rejection (1 test)
  - Token expiration handling (2 tests)
  - CORS/security headers validation (5 tests)
    - Security headers in HTTP responses
    - CORS preflight requests with security headers
    - Blocked origin rejection
    - Origin validation in WebSocket connections
    - Security headers in WebSocket upgrade responses

### API Key Security Tests (Issue #369)
- **API Key Security Tests**: 11 comprehensive tests verifying API keys are NOT exposed to frontend
  - Bundle inspection (2 tests)
  - Network request inspection (3 tests)
  - DOM and source code inspection (2 tests)
  - Console and log inspection (2 tests)
  - Proxy backend validation (2 tests)

### Dual Channel Tests (Issue #369)
- **Dual Channel (Text + Microphone) Tests**: 5 tests for channel switching scenarios
  - Start with text, then switch to microphone
  - Start with microphone, then switch to text
  - Alternate between channels in same session
  - Connection stability during channel switching
  - Proxy mode support for both channels

## Fixed

- **Component Remount Tests**: Fixed failing tests in `component-remount-customer-issue769.test.tsx`
  - Increased timeout for long-running test
  - Fixed mount detection logic to properly capture mount logs
  - Both tests now passing

## Changed

- **Mock Proxy Server**: Enhanced with security features for testing
  - Added token validation (rejects invalid/expired tokens)
  - Added origin validation (CORS support)
  - Added security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS)
  - Enhanced HTTP server to handle OPTIONS requests (CORS preflight)

- **Test Documentation**: Updated to reflect new security test coverage
  - Updated `docs/TEST-COVERAGE-PROXY-MODE.md` with expanded security tests
  - Updated `docs/TESTING.md` with security test information
  - Updated `test-app/tests/e2e/README.md` with new test files

## Test Coverage

- **Total New Tests**: 25 tests added
  - 16 tests from Issue #369 (API Key Security + Dual Channel)
  - 9 tests from Issue #363 (Security Test Expansion)
- **Security Tests**: Expanded from 2 to 22 comprehensive tests
- **All Tests Passing**: ✅ 749 Jest tests, 63+ E2E tests

## Files Modified

- `test-app/tests/e2e/backend-proxy-authentication.spec.js` - Expanded from 2 to 11 tests
- `test-app/tests/e2e/api-key-security-proxy-mode.spec.js` - New file (11 tests)
- `test-app/tests/e2e/dual-channel-text-and-microphone.spec.js` - New file (5 tests)
- `test-app/scripts/mock-proxy-server.js` - Enhanced with security features
- `tests/component-remount-customer-issue769.test.tsx` - Fixed failing tests
- `docs/TEST-COVERAGE-PROXY-MODE.md` - Updated test coverage documentation
- `docs/TESTING.md` - Updated with security test information
- `test-app/tests/e2e/README.md` - Updated with new test files

## Related Issues

- Implements #363 (Expand Security Test Coverage for Proxy Mode)
- Implements #369 (API Key Security Tests and Dual Channel Tests)
- Fixes component remount test failures
