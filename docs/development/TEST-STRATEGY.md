# Test strategy

This document describes the intended run order for tests and when to use mocks vs real upstream.

## Run order

**Real APIs first, then mocks.** When API keys are available, run integration and E2E against the real upstream first; then run with mocks. **CI always runs mocks** (no real API keys in CI; keep runs fast and deterministic).

1. **Integration tests (real upstream when requested)** — Run first with real APIs when `USE_REAL_OPENAI=1` and `OPENAI_API_KEY` are set. Location: `tests/integration/` (e.g. `openai-proxy-integration.test.ts`).

2. **Integration / E2E with mocks** — Run the same or full suite with mock upstream (no API keys required).

3. **E2E tests** — Run test-app E2E with real backend/APIs when configured; then extended E2E as needed.

Summary: **real APIs first (when available) → mocks**. **CI: mocks only.**

## Mocks vs real upstream

- **CI:** Always run **mocks** only. No real API keys; fast and deterministic.
- **Local / when keys available:** Run **real APIs first**, then mocks.

- **When real APIs are requested:** Set **`USE_REAL_OPENAI=1`** and **`OPENAI_API_KEY`** (in `.env`, `test-app/.env`, or env), then run e.g. `USE_REAL_OPENAI=1 npm test -- tests/integration/openai-proxy-integration.test.ts`. Mock-only tests are skipped; the rest run against the live OpenAI Realtime API. Optional: `OPENAI_REALTIME_URL` to override the upstream URL.

## Document references

- **Integration tests (mock upstream):** `docs/issues/ISSUE-381/INTEGRATION-TEST-PLAN.md`, `tests/integration/openai-proxy-integration.test.ts`
- **E2E tests:** `test-app/tests/e2e/`, `docs/development/TESTING-QUICK-START.md`
- **Cursor/testing rules:** `.cursorrules` (Testing Guidelines, Test run order)
