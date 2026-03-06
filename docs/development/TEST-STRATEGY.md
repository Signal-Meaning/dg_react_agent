# Test strategy

This document describes the intended run order for tests and when to use mocks vs real upstream.

## Third-party backends and scope (Epic #455)

- **Third-party backends are out of scope.** Voice-commerce and any other third-party backend are not supported or tested by this repo. Our integration and E2E tests use this repo’s proxy and mock (or real OpenAI) only.
- **Shape adoption is for our tests only.** If we adopt a given request/response shape (e.g. from community or best practice), it is only to meet our own real-API and mock-upstream testing needs (e.g. Issue #451). We do not adopt shapes to support or mandate third-party backends.

## Run order

**Real APIs first, then mocks.** When API keys are available, run integration and E2E against the real upstream first; then run with mocks. **CI always runs mocks** (no real API keys in CI; keep runs fast and deterministic).

1. **Integration tests (real upstream when requested)** — Run first with real APIs when `USE_REAL_APIS=1` and `OPENAI_API_KEY` are set. Location: `tests/integration/` (e.g. `openai-proxy-integration.test.ts`). **Scope for “must pass with real API” (Issue #451):** see `docs/issues/ISSUE-451/SCOPE.md`.

2. **Integration / E2E with mocks** — Run the same or full suite with mock upstream (no API keys required).

3. **E2E tests** — Run test-app E2E with real backend/APIs when configured; then extended E2E as needed.

Summary: **real APIs first (when available) → mocks**. **CI: mocks only.**

## Mocks vs real upstream

- **CI:** Always run **mocks** only. No real API keys; fast and deterministic.
- **Local / when keys available:** Run **real APIs first**, then mocks.

- **When real APIs are requested:** Set **`USE_REAL_APIS=1`** and **`OPENAI_API_KEY`** (in `.env`, `test-app/.env`, or env), then run e.g. `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`. Mock-only tests are skipped; the rest run against the live OpenAI Realtime API. Optional: `OPENAI_REALTIME_URL` to override the upstream URL.

- **Filtering by name does not enable real APIs.** Using **`--testNamePattern=real-API`** (or similar) only selects which tests run; it does **not** set `USE_REAL_APIS=1`. To run tests against the real API you must set the env var. Without it, real-API tests are skipped (they use `(useRealAPIs ? it : it.skip)`). So a run with `--testNamePattern=real-API` but without `USE_REAL_APIS=1` will skip those tests, not run them against the live API.

- **Do not fix real-API test failures by increasing timeouts.** If a real-API test fails due to timeout (e.g. "did not receive SettingsApplied within 10s" or "Timeout waiting for assistant response"), the root cause is likely incorrect observation of events, proxy/API misalignment with the OpenAI Realtime API spec, or test assumptions that don't match the API contract. Focus on aligning tests and proxy with the spec and on correctly observing events; do not relax or increase test timeouts as a fix. See `docs/issues/ISSUE-489/REAL-API-TEST-FAILURES.md` when investigating failures.

## Transcript / VAD and backends

- **Deepgram:** Transcript and VAD (UserStartedSpeaking, UtteranceEnd) come from the Deepgram agent/transcription streams. E2E specs that rely on these (e.g. `callback-test.spec.js`, `deepgram-vad-events-core.spec.js`) run against Deepgram only; many skip when `VITE_OPENAI_PROXY_ENDPOINT` is set (see `test-app/tests/e2e/E2E-BACKEND-MATRIX.md`).
- **OpenAI proxy (Issue #414):** The proxy maps OpenAI Realtime `input_audio_buffer.speech_started` / `speech_stopped` to the same component contract (`UserStartedSpeaking`, `UtteranceEnd`). E2E that assert VAD when using the OpenAI proxy: `openai-proxy-e2e.spec.js` test **"5b. VAD (Issue #414)"**. Contract and TDD plan: `docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md`.

## Backend / proxy defects and partner-reported defects

- **Backend/proxy defects must engage real APIs.** Fixes for proxy/API behavior (e.g. message ordering, session.update) must be validated against the **real** upstream (e.g. OpenAI), not only mocks. See `.cursorrules` (Backend / Proxy Defects, Release Qualification).
- **Partner-reported defects require coverage of the reported scenario.** When a defect is reported by a partner (e.g. voice-commerce), we **must** add E2E or equivalent real-API coverage that exercises the **partner’s scenario** (same flow, e.g. function calls, backend HTTP) before considering the defect resolved. A minimal real-API probe (e.g. Settings → InjectUserMessage → Settings) is **not** sufficient by itself. See `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md`.

## Document references

- **Real-API test failures (do not fix by increasing timeouts):** `docs/issues/ISSUE-489/REAL-API-TEST-FAILURES.md` — investigation, alignment with OpenAI Realtime API, and open questions on spec clarity and test coverage.
- **Integration tests (mock upstream):** `docs/issues/ISSUE-381/INTEGRATION-TEST-PLAN.md`, `tests/integration/openai-proxy-integration.test.ts`
- **E2E tests:** `test-app/tests/e2e/`, `docs/development/TESTING-QUICK-START.md`
- **Transcript/VAD contract (Issue #414):** `docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md`
- **Backend/proxy and partner-reported defects:** `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md`
- **Cursor/testing rules:** `.cursorrules` (Testing Guidelines, Backend / Proxy Defects, Test run order)
