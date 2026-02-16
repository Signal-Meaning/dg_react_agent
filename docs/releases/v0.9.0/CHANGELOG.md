# Changelog - v0.9.0

**Release Date**: February 2026  
**Release Type**: Minor Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Added

- **Real-API test support (Epic #455, Issue #451):** Tests can be run against real APIs using `USE_REAL_APIS=1`. Scope, run instructions, and optional release-step documentation are in `docs/development/TEST-STRATEGY.md` and issue docs. TDD phases (scope, green, document, release checklist) completed.
- **Function-call backend contract documentation (Issue #452):** Documented that the single `POST /function-call` contract is intentional; callers (e.g. voice-commerce) may customize their own backends. See `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md`.
- **Real-API and third-party scope documentation (Issues #453, #454):** Clarified that we may adopt best-practice shape for our tests/real-API needs only; voice-commerce and other third-party backends are out of scope. Third parties maintain their own backend contracts. See `docs/development/TEST-STRATEGY.md` and `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md`.
- **API evolution entry for v0.9.0** in `docs/API-REFERENCE.md` (no component API changes; release focus on tests and docs).

## Changed

- **@signal-meaning/voice-agent-backend** bumped to **0.2.0** in this release. Changes since last release: OpenAI proxy moved into the package (Issue #445), `openai.upstreamOptions` merge for Realtime 401 (Issue #441), openai-proxy `turn_detection` fix for real-API tests (Issue #451), and Epic #455 contract/docs updates in `index.js`.
- **E2E stability:** Replaced non-existent `test.describe.optional` with `test.describe` in `openai-proxy-tts-diagnostic.spec.js`. Capped IDLE_TIMEOUT_SERVICE log dumps in `idle-timeout-behavior.spec.js` to avoid terminal flood and run stalls.
- **Release checklist:** Optional real-API step and “run what CI runs” (lint + test:mock) documented; v0.9.0 checklist and issue docs added under `docs/issues/ISSUE-456/`.

## Fixed

- **OpenAI proxy (backend):** `turn_detection` set to `null` so real-API firm-audio tests pass (Issue #451 Phase 2).
- **Voice-agent-backend:** Merge of `openai.upstreamOptions` for OpenAI Realtime 401 (Issue #441).

## Backward Compatibility

✅ **Fully backward compatible** — No component API changes. Backend 0.2.0 is backward compatible; proxy and function-call contract behavior unchanged from a caller perspective.

## References

- Epic #455: Real-API tests, function-call contract, 3pp scope
- Issues #451 (real-API tests), #452 (function-call contract), #453 (real-API scope), #454 (3pp contracts)
- Release #456: Release v0.9.0 checklist
- docs/issues/ISSUE-455/, docs/issues/ISSUE-456/
- docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md
- docs/development/TEST-STRATEGY.md
