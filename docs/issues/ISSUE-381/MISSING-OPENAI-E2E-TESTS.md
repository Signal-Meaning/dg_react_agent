# Missing OpenAI E2E Tests (Issue #381)

This document lists **OpenAI proxy E2E tests** that are either (1) representative of Deepgram coverage we don’t yet have for OpenAI, or (2) compelled by the OpenAI Realtime API and proxy behavior. It informs what to add to the OpenAI suite (e.g. `openai-proxy-e2e.spec.js`) or run as “Both (expandable)” specs against the OpenAI proxy.

**Reference:** Priority OpenAI suite = tests 1–13 in [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md). Deepgram-only specs and “Why Deepgram-only” are in the Remaining E2E table there.

---

## Already covered by tests 1–13

| Deepgram analogue | OpenAI coverage | Notes |
|-------------------|-----------------|--------|
| deepgram-text-session-flow | 1–5 (Connection, Greeting, Single message, Multi-turn, Reconnection) | Session flow covered by core suite. |
| deepgram-backend-proxy-mode | 1 (Connection) | Proxy endpoint connection. |
| deepgram-greeting-idle-timeout | 2 (Greeting) | Greeting injection; idle/close semantics differ. |
| deepgram-ux-protocol | 1, 2 | Connection + settings; message ordering implied. |
| deepgram-callback-test (audio path) | 6 (Basic audio) | Audio in; transcript/VAD not applicable. |

No additional OpenAI-only test is required for these; run the Corresponding Test when using the OpenAI proxy.

---

## Missing OpenAI tests (candidates)

### 1. Instructions / session instructions (recommended)

- **Deepgram analogue:** deepgram-instructions-file (file-based instructions).
- **Gap:** OpenAI uses session instructions (text in `session.update`), not file upload. We don’t have an E2E that asserts instructions are applied (e.g. agent response reflects instructions).
- **Proposed test:** In `openai-proxy-e2e.spec.js` (or small dedicated spec): connect with `agent.instructions` (or equivalent) in Settings; send a prompt that should reflect those instructions; assert agent response content reflects them (e.g. keyword or phrasing). Proxy already forwards Settings → `session.update`; add assertion on response content.
- **Status:** **Recommended.** Compelled by OpenAI API (session instructions are first-class). TDD: add failing E2E first, then ensure proxy/app pass.

### 2. No API key in browser (proxy mode) (covered by assortment)

- **Deepgram analogue:** deepgram-backend-proxy-authentication, api-key-security-proxy-mode.
- **Gap:** “No direct API key in proxy mode” is a Both (expandable) spec: `api-key-security-proxy-mode.spec.js`. Run it against the OpenAI proxy (in the Suggested assortment).
- **Status:** **Covered by running assortment.** If the spec assumes Deepgram-only checks, extend it to allow OpenAI proxy (no key in browser, key only at proxy).

### 3. Server-side connection close / reconnect (optional)

- **Deepgram analogue:** deepgram-client-message-timeout (CLIENT_MESSAGE_TIMEOUT ~60s).
- **Gap:** OpenAI doesn’t send CLIENT_MESSAGE_TIMEOUT; it may close the WebSocket (e.g. idle or upstream close). We have Reconnection (5) and Error handling (9) but not a dedicated “server closed the connection → UI shows closed → user can reconnect” flow.
- **Proposed test:** After connection, simulate or wait for upstream close (or use a proxy that closes after N seconds); assert connection status becomes closed/error and that sending again triggers reconnect and response.
- **Status:** **Optional.** Partially covered by existing reconnection and error tests. Add if we see flaky or unclear behavior on server close.

### 4. SettingsApplied / message ordering (optional)

- **Deepgram analogue:** deepgram-ux-protocol (message shapes and ordering).
- **Gap:** We don’t explicitly assert that the client receives SettingsApplied (or equivalent) after Settings.
- **Proposed test:** In openai-proxy-e2e or integration: after sending Settings, assert SettingsApplied (or DOM/callback indicating “ready”) before sending user message. May already be implied by Connection (1) and Greeting (2).
- **Status:** **Optional.** Prefer integration test; add E2E only if we need to lock browser-visible ordering.

### 5. Idle timeout after greeting (deferred)

- **Deepgram analogue:** deepgram-greeting-idle-timeout (deepgramRef, connection close after idle).
- **Gap:** OpenAI session idle/close semantics are not identical; no documented “idle timeout after greeting” event.
- **Status:** **Deferred.** Rely on test 2 (Greeting) and test 5 (Reconnection). Revisit if OpenAI documents idle-after-greeting behavior.

### 6. Transcript callbacks absent (negative) (deferred)

- **Deepgram analogue:** deepgram-callback-test (onTranscriptUpdate, onUserStartedSpeaking, onUserStoppedSpeaking).
- **Gap:** OpenAI doesn’t send equivalent transcript/VAD events. We could add a negative test: register transcript callbacks, connect via OpenAI proxy, send message, assert no crash and agent response still appears (basic path works without transcript events).
- **Status:** **Deferred.** Low value unless we see regressions when callbacks are present but never fired.

---

## Summary

| Candidate | Priority | Action |
|-----------|----------|--------|
| Instructions / session instructions | Recommended | Add E2E (TDD: fail first, then implement). |
| No API key in browser | — | Run api-key-security-proxy-mode in assortment; extend if Deepgram-only. |
| Server-side close / reconnect | Optional | Add only if needed for flakiness or clarity. |
| SettingsApplied / ordering | Optional | Prefer integration test. |
| Idle after greeting | Deferred | Rely on tests 2 and 5. |
| Transcript callbacks absent | Deferred | Add only if regressions appear. |

**Next steps:** Implement “Instructions / session instructions” E2E per TDD; run the [Suggested assortment](./E2E-PRIORITY-RUN-LIST.md#assortment-run-both-expandable-specs-against-openai-peace-of-mind) and update the Remaining E2E table Result column.
