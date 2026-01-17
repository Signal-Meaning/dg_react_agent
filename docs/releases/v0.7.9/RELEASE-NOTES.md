# Release Notes - v0.7.9

**Release Date**: January 17, 2026  
**Release Type**: Patch Release

## Overview

v0.7.9 is a patch release that significantly expands security test coverage and adds comprehensive API key security validation. This release includes 25 new tests covering security, authentication, and dual channel functionality, bringing the total E2E test suite to 63+ tests.

## 🎯 Release Highlights

### Security Test Expansion (Issue #363)
- **Comprehensive Security Tests**: Expanded backend proxy authentication tests from 2 to 11 tests
  - Invalid token rejection (2 tests)
  - Malformed token rejection (1 test)
  - Token expiration handling (2 tests)
  - CORS/security headers validation (5 tests)
- **Mock Proxy Server Enhancements**: Added token validation, origin validation, and security headers

### API Key Security Tests (Issue #369)
- **API Key Security Validation**: 11 comprehensive tests ensuring API keys are NOT exposed to frontend
  - Bundle inspection (2 tests)
  - Network request inspection (3 tests)
  - DOM and source code inspection (2 tests)
  - Console and log inspection (2 tests)
  - Proxy backend validation (2 tests)

### Dual Channel Tests (Issue #369)
- **Dual Channel Support**: 5 tests for text + microphone channel switching
  - Channel switching scenarios
  - Connection stability during switching
  - Proxy mode support for both channels

## 🐛 Fixed

### Component Remount Tests
- **Issue**: Tests in `component-remount-customer-issue769.test.tsx` were failing
  - Timeout issues for long-running test
  - Mount detection logic not capturing mount logs properly
- **Solution**: 
  - Increased timeout for long-running test
  - Fixed mount detection to properly capture mount logs from console
  - Both tests now passing

## 📦 What's Included

### New Test Files

1. **`test-app/tests/e2e/api-key-security-proxy-mode.spec.js`** (11 tests)
   - Comprehensive API key security validation
   - Verifies API keys remain server-side in proxy mode

2. **`test-app/tests/e2e/dual-channel-text-and-microphone.spec.js`** (5 tests)
   - Dual channel (text + microphone) functionality
   - Channel switching and connection stability

### Enhanced Test Files

1. **`test-app/tests/e2e/backend-proxy-authentication.spec.js`** (expanded from 2 to 11 tests)
   - Basic authentication (2 tests) - Issue #242
   - Invalid token rejection (2 tests) - Issue #363
   - Token expiration handling (2 tests) - Issue #363
   - CORS/security headers validation (5 tests) - Issue #363

### Enhanced Mock Proxy Server

**`test-app/scripts/mock-proxy-server.js`**:
- Token validation (rejects invalid/expired tokens)
- Origin validation (CORS support)
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS)
- CORS preflight handling (OPTIONS requests)

### Documentation Updates

- `docs/TEST-COVERAGE-PROXY-MODE.md` - Updated with expanded security test coverage
- `docs/TESTING.md` - Added security test information
- `test-app/tests/e2e/README.md` - Added new test files
- `docs/issues/ISSUE-371-V0.7.9-RELEASE.md` - Release tracking document

## 🔒 Security Improvements

### Token Validation
- Invalid tokens are rejected at connection time
- Malformed tokens are rejected gracefully
- Expired tokens are handled appropriately
- Component handles authentication failures gracefully

### CORS Protection
- Origin validation prevents unauthorized connections
- Blocked origins are rejected (403)
- Security headers protect against common attacks
- CORS preflight requests handled correctly

### API Key Security
- API keys verified NOT in JavaScript bundle
- API keys verified NOT in network requests
- API keys verified NOT in DOM or source code
- API keys verified NOT in console logs
- Proxy backend keeps API keys server-side

## 📊 Test Coverage

### Before v0.7.9
- Security Tests: 2 basic authentication tests
- Total E2E Tests: 47+ tests

### After v0.7.9
- Security Tests: 22 comprehensive security tests
- Total E2E Tests: 63+ tests
- **New Tests Added**: 25 tests (16 from Issue #369, 9 from Issue #363)

### Test Status
- ✅ **Jest Unit Tests**: 749 passing, 21 skipped
- ✅ **E2E Tests**: All new tests passing
  - Backend Proxy Authentication: 11/11 passing
  - API Key Security: 11/11 passing
  - Dual Channel: 5/5 passing

## 🔄 Backward Compatibility

✅ **Fully backward compatible** - No breaking changes
- All new tests are additive
- No API changes
- No behavior changes
- Existing functionality preserved

## ⚠️ Important Notes

### Security Tests Require Real APIs
- Security tests skip automatically in CI environments
- Must be run locally with real Deepgram API key
- Tests verify actual security behavior, not mocked responses

### Running Security Tests
```bash
# Run security tests locally (requires real API key)
cd test-app
unset CI && USE_PROXY_MODE=true npm run test:e2e -- backend-proxy-authentication
unset CI && USE_PROXY_MODE=true npm run test:e2e -- api-key-security-proxy-mode
```

## 🔗 Related Issues

- Implements #363 (Expand Security Test Coverage for Proxy Mode)
- Implements #369 (API Key Security Tests and Dual Channel Tests)
- Fixes component remount test failures

## 📝 Migration Guide

**No migration required** - This is a patch release with no breaking changes.

All changes are additive (new tests) and do not affect the component API or behavior. The component continues to work exactly as before.

## 🙏 Acknowledgments

- Issue #363: Security test expansion requirements
- Issue #369: API key security and dual channel test requirements
- All tests implemented and verified
