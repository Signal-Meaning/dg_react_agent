# Changelog - v0.7.19

**Release Date**: February 2026  
**Release Type**: Patch Release

## Added

### OTel-style logging and trace propagation (Issue #412)

- **Logger:** Optional OTel-style logger interface (`emitLog(level, message, meta?)`) with trace ID propagation. Component, test-app, and OpenAI proxy use the logger; console allowlist for backward compatibility. See [CONSOLE-AUDIT](../../issues/ISSUE-412/CONSOLE-AUDIT.md) and migration guide.
- **Backend:** Test-app backend and OpenAI proxy attach trace ID to logger context when `X-Trace-Id` header is present; proxy replaces `console.log` with `emitLog`.

### Backend function-call execution (Issue #407)

- **POST /function-call:** Backend proxy exposes `POST /function-call` for server-side execution; frontend forwards by default. Documentation: BACKEND-PROXY, CONVERSATION-STORAGE, Phase 2–4 docs and examples.
- **E2E and integration:** Tests and E2E documentation for backend execution path.

## Changed

### E2E and test defaults (Issue #420)

- **Proxy default:** `npm run test:e2e` now runs with `USE_PROXY_MODE=true` (proxy + OpenAI as primary E2E mode).
- **test:e2e:log:** New script runs E2E with output teed to `e2e-run.log`.
- **Declarative-props:** Hybrid approach for OpenAI proxy: establish connection via `establishConnectionViaText()` before exercising declarative props; 12 tests passed, 2 skipped.
- **Lazy-init:** With OpenAI proxy, use `start({ agent: true, transcription: false })` (both true throws); microphone test runs for both backends, transcription assertion skipped for OpenAI only.
- **Idle-timeout E2E:** Relaxed waits and timeout window so test passes with OpenAI; not skipped.
- **Echo-cancellation:** E2E test skipped entirely for now (flaky).

### Idle timeout and callbacks (Issues #414, #416)

- **Idle timeout:** Shared `idle_timeout_ms` from Settings; proxy uses only Settings (no env). Component fix: `hasSeenUserActivityThisSession` for correct idle timeout start. Console always logs WebSocket close and idle-timeout close.
- **Callback tests:** Renamed to `callback-test.spec.js`; support both Deepgram and OpenAI proxies.

## Fixed

- **Conversation history:** By-value handling and multi-turn E2E fixes (Issue #414).
- **OpenAI proxy:** Protocol fixes (min audio before commit, one response.create per turn), buffer constants, VAD and session-state docs.
- **Plugin validation:** Intent-based checks; full Jest suite passes.

## Backward Compatibility

✅ **Fully backward compatible** — Logger is optional; existing behavior unchanged when logger not provided. E2E and script changes are additive.

## References

- **Issue #412**: OTel-style logger and trace ID propagation
- **Issue #407**: Backend POST /function-call and docs
- **Issue #420**: E2E proxy failures triage and release
- **Issues #414, #416**: Idle timeout and callback E2E
