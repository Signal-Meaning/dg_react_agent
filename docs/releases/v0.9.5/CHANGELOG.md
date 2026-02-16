# Changelog - v0.9.5

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #462 (process/test):** Function-call flow qualification no longer uses an in-test hardcoded `FunctionCallResponse`. The real-API integration test now performs a **real HTTP POST to a backend** (in-process minimal server) when it receives `FunctionCallRequest`, then sends the backend response. This matches the partner scenario (real app → backend HTTP → response) and prevents false qualification. See `docs/issues/ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md`.

## Added

- **Process guards:** `.cursorrules` and `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md` now require that any test used to qualify the function-call path (FunctionCallRequest → FunctionCallResponse → response) must obtain the response via a real HTTP request to a backend — never an in-test-only hardcoded payload. Release checklist template (`.github/ISSUE_TEMPLATE/release-checklist.md`) updated with a function-call path sub-bullet.
- **Integration test:** `createMinimalFunctionCallBackend()` in `tests/integration/openai-proxy-integration.test.ts` — in-process HTTP server for POST /function-call; real-API function-call test uses it so the path is client → proxy → real API → FunctionCallRequest → **HTTP POST to backend** → FunctionCallResponse → proxy → API.
- **Docs:** `docs/issues/ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md` (acknowledgment that voice-commerce's report was correct; what we did and what we should still do); ISSUE-462 README and release checklist (v0.9.5 prep).

## Backward Compatibility

✅ **Fully backward compatible** — No component or backend API changes. Test and process improvements only; no proxy code change in this release.

## References

- Issue #462: conversation_already_has_active_response (reopened); function-call qualification and process guards
- docs/issues/ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md
- docs/issues/ISSUE-462/RELEASE-CHECKLIST-v0.9.5.md
