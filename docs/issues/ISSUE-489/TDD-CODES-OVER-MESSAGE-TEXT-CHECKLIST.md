# TDD Checklist: Codes Over Message Text (Error Handling)

**Goal:** Implement protocol requirement **Error handling (use structured codes; avoid message text)** using TDD and keep the implementation DRY. See [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](../ISSUE-470/PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md) requirement 9, [COMPONENT-PROXY-CONTRACT.md](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) "Codes over message text."

**Scope:** OpenAI proxy — map upstream `error` to component `Error` using API structured codes (`event.error?.code`) first; use protocol-defined codes for proxy→client; avoid message-text-based control flow where possible.

---

## Phase 1 — RED: Write failing tests first

- [x] **1.1** Add unit tests for error-code mapping (translator)
  - [x] Test: when `event.error.code === 'idle_timeout'`, `mapErrorToComponentError` returns `code: 'idle_timeout'` (no message-text check).
  - [x] Test: when `event.error.code === 'session_max_duration'`, `mapErrorToComponentError` returns `code: 'session_max_duration'`.
  - [x] Test: when `event.error.code === 'rate_limit_exceeded'` (or other API code), component Error gets that code (pass-through).
  - [x] Test: when `event.error.code` is absent, fallback behavior is documented and tests assert legacy path (or skip if we remove fallback).
  - [x] Test: prefers `event.error.code` over message (code wins when both present; e.g. code `rate_limit_exceeded` + idle message → `rate_limit_exceeded`).
- [x] **1.2** Add/update integration tests (openai-proxy-integration.test.ts)
  - [x] Test: when mock sends upstream `error` with `error.code: 'idle_timeout'`, client receives `Error` with `code: 'idle_timeout'`.
  - [x] Test: when mock sends upstream `error` with `error.code: 'session_max_duration'`, client receives `Error` with `code: 'session_max_duration'`.
  - [x] Existing test "when upstream sends error after session.updated, client receives Error" (unchanged; asserts Error received; code is forwarded via mapErrorToComponentError).
- [x] **1.3** Run tests and confirm they fail (RED) where we expect (e.g. current implementation uses message text for idle_timeout / session_max_duration).

---

## Phase 2 — GREEN: Implement to make tests pass

- [x] **2.1** Add single source of truth: API code → component code
  - [x] In `translator.ts`: define mapping (e.g. `API_ERROR_CODE_TO_COMPONENT` or `mapApiErrorCodeToComponentCode(apiCode)`). Include `idle_timeout`, `session_max_duration`; pass through unknown API codes.
  - [x] `mapErrorToComponentError`: use `event.error?.code` first; if present, map via the single function; else use legacy message fallback (if we keep it).
- [x] **2.2** Replace message-text detection with code-based detection
  - [x] `isIdleTimeoutClosure` and `isSessionMaxDurationError`: derive from mapped component code (or remove and use single `getComponentErrorCode(event)` that returns the code; server then checks `code === 'idle_timeout'` etc.).
  - [x] Prefer one function that returns component code from event; server uses that for both logging and sending to client (DRY).
- [x] **2.3** Update server.ts
  - [x] Use the single mapping path for `closureCode` and for `componentError`; remove duplicate logic that infers from message text.
  - [x] `isExpectedClosure`: derive from component code in `['idle_timeout', 'session_max_duration']`.
- [x] **2.4** Run tests and confirm they pass (GREEN).

---

## Phase 3 — REFACTOR: DRY and align

- [x] **3.1** Remove or narrow legacy message-text fallback
  - [x] If API can send errors without `error.code`, document the fallback and limit it to a single helper (e.g. `legacyInferCodeFromMessage(event)` used only when `!event.error?.code`).
  - [x] Ensure no duplicate message-string checks elsewhere.
- [x] **3.2** JSDoc and comments
  - [x] Translator: document "codes over message text"; API code → component code mapping; legacy fallback (if any).
  - [x] Server: reference translator for error mapping; no inline message parsing.
- [x] **3.3** Protocol docs
  - [x] PROTOCOL-AND-MESSAGE-ORDERING §3.9: note that implementation uses `event.error?.code` and the named mapping; legacy fallback only when code absent.
- [x] **3.4** Run full openai-proxy integration test suite (mock and, if available, real-API) and confirm no regressions. Mock run: 48 passed, 12 skipped (real-API). Issue #482 mock updated to send `error.code: 'idle_timeout'` (proxy does not map `server_error` → `idle_timeout`).

---

## Progress summary

| Phase | Status    | Notes |
|-------|-----------|--------|
| 1 RED | Done      | Unit tests added; one test (prefer code over message) failed until fix. Integration tests for `error.code` idle_timeout/session_max_duration added. |
| 2 GREEN | Done     | `getComponentErrorCode`, `mapApiErrorCodeToComponentCode`, `legacyInferCodeFromMessage` in translator; server uses `mapErrorToComponentError` result for logging and buffering. |
| 3 REFACTOR | Done | Legacy fallback single helper; JSDoc and §3.3 done. Full mock run: 48 passed. Issue #482 mock sends structured `idle_timeout` (no server_error→idle_timeout mapping). |

**Last updated:** Phase 1–3.4 complete. Mock integration suite green (48 passed). Real-API tests remain skipped unless USE_REAL_APIS=1.
