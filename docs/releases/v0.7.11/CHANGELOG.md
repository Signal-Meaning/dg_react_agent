# Changelog - v0.7.11

**Release Date**: February 2026  
**Release Type**: Patch Release

## Added / Improved

### OpenAI Realtime Proxy Support (Issue #381)
- **Proxy path routing**: Mock proxy server now routes WebSocket upgrade by path so `/openai?service=agent` is handled by the OpenAI server instead of being rejected with 400 by the Deepgram listener.
  - Both Deepgram and OpenAI WebSocket servers use `noServer: true`; a single `server.on('upgrade')` dispatches by pathname (`/openai` vs `/deepgram-proxy`).
  - Fixes E2E connection failure when the component connects to `ws://localhost:8080/openai?service=agent`.
- **OpenAI proxy E2E**: All 9 tests in `openai-proxy-e2e.spec.js` now pass (connection, greeting, single message, multi-turn, reconnection, basic audio, function calling, reconnection with context, error handling).

### E2E Backend Matrix and Deepgram-Only Specs
- **Skip when OpenAI proxy**: Three Deepgram-only specs skip when the run is configured for the OpenAI proxy (`skipIfOpenAIProxy`):
  - `deepgram-interim-transcript-validation.spec.js` (interim/final transcripts)
  - `deepgram-extended-silence-idle-timeout.spec.js` (VAD/speech detection and idle timeout flow)
  - Test **"Deepgram: should test minimal function definition for SettingsApplied issue"** in `function-calling-e2e.spec.js`
- **Renames for clarity**:
  - `extended-silence-idle-timeout.spec.js` → `deepgram-extended-silence-idle-timeout.spec.js`
  - Function-calling test title prefixed with **"Deepgram:"** to reflect Deepgram-only behavior
- **Full E2E run**: With `USE_PROXY_MODE=true` (OpenAI proxy default), full suite reports **210 passed, 24 skipped, 0 failures**.

## Fixed

### Mock Proxy Server (test-app)
- **WebSocket 400 on /openai**: Requests to `/openai` or `/openai?service=agent` were previously handled by the Deepgram WebSocket server (registered first), which rejected them with 400. Single upgrade handler now routes by pathname so only the matching server handles each request.

## Documentation

- **E2E README**: Full-suite outcome (210 passed, 24 skipped), Deepgram-only renames/skips, and diagnosing connection issues updated.
- **E2E-BACKEND-MATRIX**: Added `deepgram-extended-silence-idle-timeout.spec.js`, function-calling Deepgram test note; skip-when-OpenAI-proxy noted where applicable.
- **Issue #383**: E2E summary report and release checklist updated; OpenAI proxy E2E commands and 0-failures confirmation documented.

## Test Coverage

- **OpenAI proxy E2E**: 9/9 tests passing in `openai-proxy-e2e.spec.js`.
- **Full E2E**: 210 passed, 24 skipped (Deepgram-only specs skip when OpenAI proxy).
- **Unit / integration**: Unchanged; existing tests passing.
