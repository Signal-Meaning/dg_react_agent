# CI E2E subset (essential tests)

**Issue:** [#506](https://github.com/Signal-Meaning/dg_react_agent/issues/506)

CI runs only a small **essential** subset of E2E tests. All other E2E specs are skipped in CI (they are not run). The full suite remains runnable locally for deeper regression.

## Essential specs (run in CI)

| Spec | Purpose |
|------|--------|
| `api-key-validation.spec.js` | Fail-fast when API keys are missing or invalid; setup instructions in error banner. |
| `page-content.spec.js` | App and voice agent component render; basic page structure. |
| `deepgram-ux-protocol.spec.js` | Core protocol flow and UX states (proxy mode); currently **skipped** in-file pending [#556](https://github.com/Signal-Meaning/dg_react_agent/issues/556). |
| `protocol-validation-modes.spec.js` | Mock vs real mode; WebSocket behavior without real API key. |

**Lazy initialization (Issue #206)** is covered by **`tests/lazy-initialization.test.js`** (root Jest, mocked managers) — not duplicated in CI E2E.

These four spec **files** are listed for CI; **`deepgram-ux-protocol`** contributes only skipped tests until #556 is resolved. CI sets `USE_PROXY_MODE=true`, `E2E_USE_HTTP=1`, and a placeholder `DEEPGRAM_API_KEY` so the backend starts; tests use the test-app proxy that mocks upstream.

## How CI runs the subset

- **Workflow:** [test-and-publish.yml](../../../.github/workflows/test-and-publish.yml) → job **E2E Tests (mocks, no real APIs)**.
- **Script:** From `test-app`, run `npm run test:e2e:ci`. That script runs only the four spec files above with CI-friendly env (proxy mode, HTTP, no real keys).
- **Non-essential specs:** All other E2E spec files (60+ specs) are **not** invoked in CI; they are skipped by virtue of not being in the CI spec list.

## Running locally

- **CI subset (same as CI):**  
  From `test-app`:  
  `npm run test:e2e:ci`

- **Full E2E suite:**  
  From `test-app`:  
  `npm run test:e2e`  
  (No spec list = all specs in `tests/e2e/`. Many require real API keys or specific backends; see [README.md](./README.md) and [E2E-BACKEND-MATRIX.md](./E2E-BACKEND-MATRIX.md).)

- **Single spec or ad-hoc list:**  
  `npm run test:e2e -- path/to/spec.js [path/to/other.spec.js ...]`

## Changing the essential set

1. Edit the `test:e2e:ci` script in `test-app/package.json` to add or remove spec paths.
2. Keep specs **mock-only** (no real API keys) so CI does not need secrets.
3. Update this file’s table and any references in the workflow or README.
