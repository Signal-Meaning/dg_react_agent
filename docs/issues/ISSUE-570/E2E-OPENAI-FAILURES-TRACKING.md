# Issue #570 — OpenAI proxy E2E: three failures → resolution

**Purpose:** Track the **three** failing tests from the **`npm run test:e2e:openai`** slice (**2026-04-09** run with `E2E_USE_EXISTING_SERVER=1`, real APIs) until they pass or are explicitly waived with rationale.

**GitHub:** [#570](https://github.com/Signal-Meaning/dg_react_agent/issues/570)

**Related:** [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) (Progress + E2E section), [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md)

---

## Preconditions

1. **Vite:** `cd test-app && npm run dev` (app reachable, default `http://localhost:5173` or match `VITE_BASE_URL`).
2. **Backend:** e.g. `cd packages/voice-agent-backend && npm run backend` (or `npm run backend` from `test-app` per your workflow) — **8080** OpenAI proxy path, **`OPENAI_API_KEY`** valid in backend `.env`.
3. **Slice command** (from **`test-app`** directory):

```bash
E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npm run test:e2e:openai
```

**Retry only the three tests:**

```bash
cd test-app
E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npx playwright test \
  tests/e2e/callback-test.spec.js tests/e2e/openai-proxy-e2e.spec.js \
  --grep "onPlaybackStateChange callback with agent response|all callbacks integration with comprehensive workflow|3b\\. Multi-turn" \
  --config=tests/playwright.config.mjs
```

**Debug / trace (optional):** add `--headed` or `PW_ARTIFACTS_ON_FAILURE=1` per [README § OpenAI proxy](../../../test-app/tests/e2e/README.md).

---

## Failure register

| # | Spec | Test title (approx.) | Observed error (2026-04-09) | Status | Resolution / notes |
|---|------|------------------------|-------------------------------|--------|-------------------|
| 1 | `test-app/tests/e2e/callback-test.spec.js` | `should test onPlaybackStateChange callback with agent response` | `Target page, context or browser has been closed` after mic path; helper: connection failed to re-establish after mic click | [ ] Open | |
| 2 | `test-app/tests/e2e/callback-test.spec.js` | `should test all callbacks integration with comprehensive workflow` | Same as #1 | [ ] Open | |
| 3 | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | `3b. Multi-turn after disconnect – session history preserved (disconnect WS between 3 & 4)` | `expect(locator).toHaveText` failed (assistant / history assertion) | [ ] Open | |

**Exit criteria for this doc:** all three **Status** → **Resolved** (test green or replaced coverage + waiver documented here and on #570).

---

## Investigation log

_Use reverse-chronological bullets as you work._

-

---

## Hypotheses (optional)

- **#1 / #2:** Flake from **page closure** during long mic/connection sequence; possible race with **idle timeout**, **StrictMode** remount, or **worker** contention — `playwright.config.mjs` may use a single worker for `USE_REAL_APIS`; confirm.
- **#3:** **Multi-turn + disconnect** sensitive to **OpenAI** timing or **proxy** session ordering; compare with passing **3a** / other multi-turn tests in same file.

---

## References

- `test-app/tests/e2e/callback-test.spec.js` (lines ~177, ~214)
- `test-app/tests/e2e/openai-proxy-e2e.spec.js` (line ~154, test **3b**)
- Helpers: `test-app/tests/e2e/helpers/test-helpers.js` (mic reconnect / `establishConnectionViaText`)
