# Backend / Proxy Defects: Real API and Partner-Reported Requirements

## Rule

**Defects that involve the backend or proxy must actually engage with the real APIs presented by the provider.** We may not add E2E variants for every case we develop, but **when a defect is presented by a partner we must** add coverage that exercises the **reported scenario** before considering the defect resolved and the release qualified.

## Why

- **Real API vs mock:** The real provider API’s event order and timing can differ from mocks (e.g. `output_audio.done` before `output_text.done`, function-call flows). Fixes validated only against mocks can still fail in production.
- **Partner-reported defects:** A partner’s scenario (e.g. function calls, backend HTTP, specific message order) may not be covered by a minimal integration test. If we only add a narrow real-API test (e.g. Settings → InjectUserMessage → Settings) and do **not** add E2E or equivalent for the partner’s flow, we risk shipping a release that passes our tests but still fails for the partner.

## Requirements

1. **Backend/proxy defects:** Validation must include running the relevant tests **against the real API** (e.g. `USE_REAL_APIS=1` for openai-proxy-integration tests). Mock-only success is not sufficient for release qualification. See `.cursorrules` (Release Qualification) and `.github/ISSUE_TEMPLATE/release-checklist.md`.

2. **Partner-reported defects:** In addition to the above, we **must** have coverage that exercises the **partner’s scenario**:
   - **E2E:** Add or extend an E2E test in `test-app/tests/e2e/` that runs the partner’s flow (e.g. connect → Settings → user message → function call → backend HTTP → response) in proxy mode with real backend/API, and assert the defect is fixed (e.g. no `conversation_already_has_active_response`).
   - **Or integration against real API:** An integration test that reproduces the same message/timing path as the partner’s scenario against the real API (not a reduced path).
   - Document the scenario and how the new test covers it (e.g. in the issue’s docs or TRACKING.md).

3. **Do not rely on a minimal probe alone for partner-reported defects.** A minimal real-API test (e.g. Settings → InjectUserMessage → second Settings) can prove one path is fixed but does **not** substitute for coverage of the partner’s actual flow (e.g. function calls, backend, UI). Add E2E or equivalent for the reported scenario.

## Reference

- **Issue #462 / voice-commerce:** Partner reported `conversation_already_has_active_response` in their E2E (function-call flow). We fixed the proxy and added a real-API integration test that only probed Settings → InjectUserMessage → second Settings. We did **not** add E2E (or equivalent) for the partner’s function-call scenario. That was insufficient. See `docs/issues/ISSUE-462/`, `.cursorrules` (Backend / Proxy Defects).

## See also

- `docs/development/TEST-STRATEGY.md` — Run order, real API vs mocks
- `docs/issues/ISSUE-451/SCOPE.md` — In-scope tests for real API
- `.cursorrules` — Backend / Proxy Defects, Release Qualification (Real API)
