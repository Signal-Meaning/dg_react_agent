# E2E specs tracked under GitHub #556

Use this list when updating [issue #556](https://github.com/Signal-Meaning/dg_react_agent/issues/556) (Deepgram connectivity / proxy E2E stability).

## Skipped pending #556

| Spec | Notes |
|------|--------|
| `test-app/tests/e2e/deepgram-ux-protocol.spec.js` | Entire `Deepgram Protocol UX Validation` describe is **`test.describe.skip`**. CI was failing on mic activation / connection → `closed` → reconnection timeout in `microphone-helpers.js` (same class of instability as live Deepgram auth flakiness). Restore when #556 is resolved or split into a dedicated Deepgram-backend E2E job with stable keys and timing. |

## Removed from CI (contract elsewhere)

- **`test-app/tests/e2e/lazy-initialization-e2e.spec.js`** — **removed** (2026-03-28). Issue #206 lazy-init behavior is asserted in **`tests/lazy-initialization.test.js`** (Jest + mocks). The Playwright file duplicated that contract with brittle log/DOM timing and real-network flakiness without a unique requirement.

## Related (opt-in Jest, not Playwright)

- `tests/integration/websocket-connectivity.test.js` — runs only when `RUN_DEEPGRAM_CONNECTIVITY_TESTS=1` (see #556 / ISSUE-554 TRACKING).
