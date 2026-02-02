# Release Notes - v0.7.11

**Release Date**: February 2026  
**Release Type**: Patch Release

## Overview

v0.7.11 is a patch release that fixes OpenAI Realtime proxy support in the test-app mock proxy server and E2E suite. WebSocket upgrade requests to `/openai?service=agent` are now routed correctly, and all OpenAI proxy E2E tests pass. Deepgram-only specs skip when running in OpenAI proxy mode so the full suite reports 210 passed, 24 skipped, 0 failures.

## 🎯 Release Highlights

### OpenAI Realtime Proxy Support (Issue #381)

**Problem**: E2E tests connecting to the OpenAI proxy at `ws://localhost:8080/openai?service=agent` failed with "Unexpected response code: 400" because the mock proxy server's Deepgram WebSocket listener was handling the upgrade first and rejecting `/openai` requests.

**Solution**:
- Mock proxy server uses `noServer: true` for both Deepgram and OpenAI WebSocket servers
- A single `server.on('upgrade')` handler dispatches by pathname: `/openai` → OpenAI server, `/deepgram-proxy` → Deepgram server
- All 9 tests in `openai-proxy-e2e.spec.js` now pass (connection, greeting, single message, multi-turn, reconnection, basic audio, function calling, reconnection with context, error handling)

**Impact**:
- ✅ OpenAI proxy E2E tests pass end-to-end
- ✅ Full E2E run with `USE_PROXY_MODE=true`: 210 passed, 24 skipped, 0 failures
- ✅ Deepgram-only specs skip when configured for OpenAI proxy via `skipIfOpenAIProxy`

## 🐛 Fixed

### Mock Proxy Server (test-app)
- **Issue**: Requests to `/openai` or `/openai?service=agent` were handled by the Deepgram WebSocket server (registered first), which rejected them with 400
- **Solution**: Single upgrade handler routes by pathname so only the matching server handles each request
- **File**: `test-app/scripts/mock-proxy-server.js`

## ✨ Added / Improved

### E2E Backend Matrix and Deepgram-Only Specs
- **Skip when OpenAI proxy**: Three Deepgram-only specs skip when the run is configured for the OpenAI proxy (`skipIfOpenAIProxy`):
  - `deepgram-interim-transcript-validation.spec.js`
  - `deepgram-extended-silence-idle-timeout.spec.js`
  - Test **"Deepgram: should test minimal function definition for SettingsApplied issue"** in `function-calling-e2e.spec.js`
- **Renames for clarity**:
  - `extended-silence-idle-timeout.spec.js` → `deepgram-extended-silence-idle-timeout.spec.js`
  - Function-calling test title prefixed with **"Deepgram:"**

### Documentation
- **E2E README**: Full-suite outcome (210 passed, 24 skipped), Deepgram-only renames/skips, and diagnosing connection issues
- **E2E-BACKEND-MATRIX**: Deepgram-only specs and skip-when-OpenAI-proxy noted
- **Issue #383**: E2E summary report and release checklist; OpenAI proxy E2E commands and 0-failures confirmation

## 📊 Test Coverage

- **OpenAI proxy E2E**: 9/9 tests passing in `openai-proxy-e2e.spec.js`
- **Full E2E**: 210 passed, 24 skipped (Deepgram-only specs skip when OpenAI proxy)
- **Unit / integration**: Unchanged; existing tests passing

## 🔄 Backward Compatibility

✅ **Fully backward compatible** - No breaking changes
- Changes are limited to test-app mock proxy and E2E test organization
- No API or component behavior changes
- Production package (`dist/`, component, types) unchanged

## ⚠️ Important Notes

### Test-App and E2E Only
- Fixes and improvements in this release apply to the **test-app** mock proxy and E2E suite
- Consumers using the published component are unaffected; no migration needed

### Running E2E with OpenAI Proxy
- Start mock proxy: `USE_PROXY_MODE=true node test-app/scripts/mock-proxy-server.js`
- Run OpenAI proxy E2E: `USE_PROXY_MODE=true npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js`
- Full suite (210 passed, 24 skipped): `USE_PROXY_MODE=true npx playwright test`

## 🔗 Related Issues

- Issue #381 (OpenAI Realtime proxy support) ✅ **FIXED**
- Issue #383 (E2E summary and release checklist) ✅ **DOCUMENTED**

## 📝 Migration Guide

**No migration required** - This is a patch release affecting only the test-app and E2E infrastructure.

### What Changed
- **Before**: Mock proxy rejected `/openai` with 400; OpenAI proxy E2E tests failed
- **After**: Mock proxy routes `/openai` to the OpenAI WebSocket server; all OpenAI proxy E2E tests pass

### No Action Required for Component Users
- No API changes
- No prop or callback changes
- Use the component as in v0.7.10
