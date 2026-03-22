# TDD Plan: Eight failing E2E tests (proxy / idle timeout) — Issue #544

**Release context:** [Issue #544](https://github.com/Signal-Meaning/dg_react_agent/issues/544) (v0.10.5 / backend 0.2.10) — Epic [#542](../ISSUE-542/README.md) shipped on `main` via [#543](https://github.com/Signal-Meaning/dg_react_agent/pull/543).

**Principle:** Red → Green → Refactor. Prefer **failing tests that encode the correct product rule**, then minimal implementation. Do not weaken security assertions or idle semantics to go green without an explicit decision.

**Integration baseline (separate from E2E):** Real-API Jest for the OpenAI proxy **passes** (20 ran, 64 skipped):

```bash
USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts
```

That qualifies proxy↔API behavior in Jest; **full release qualification** for Issue #544 still requires **proxy-mode E2E green** (or a documented, time-bounded exception on Issue #544).

---

## Checkbox legend

- `[ ]` — Not done.
- `[x]` — Done (implemented and verified; update this doc when complete).

---

## Reproduce (from `test-app`)

Per [.cursorrules](../../../.cursorrules), run E2E from **test-app** with backend available:

```bash
cd test-app
npm run backend   # separate terminal, user-started
USE_PROXY_MODE=true npm run test:e2e
```

**Focused retries** (faster iteration):

```bash
USE_PROXY_MODE=true npm run test:e2e -- idle-timeout-behavior.spec.js deepgram-greeting-idle-timeout.spec.js
USE_PROXY_MODE=true npm run test:e2e -- api-key-security-proxy-mode.spec.js callback-test.spec.js
USE_PROXY_MODE=true npm run test:e2e -- deepgram-backend-proxy-authentication.spec.js deepgram-client-message-timeout.spec.js
```

See [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md).

---

## Failure inventory (8 tests)

Observed in a full proxy E2E run: **207 passed**, **8 failed**, 37 skipped (~4.7m).

| # | Spec | Test (short) | Likely theme |
|---|------|----------------|--------------|
| 1 | `api-key-security-proxy-mode.spec.js` | `should not log API key to console` | Console / logging hygiene (new log lines may embed key material or substrings) |
| 2 | `callback-test.spec.js` | `onPlaybackStateChange` with agent response | Playback / idle / timing vs assistant turn completion |
| 3 | `deepgram-backend-proxy-authentication.spec.js` | Token expiration during session | Connection lifecycle + proxy |
| 4 | `deepgram-client-message-timeout.spec.js` | `CLIENT_MESSAGE_TIMEOUT` from server idle | Idle disconnect messaging / timing |
| 5 | `deepgram-greeting-idle-timeout.spec.js` | Timeout after greeting completes (Issue #139) | Greeting-complete → idle countdown |
| 6 | `deepgram-greeting-idle-timeout.spec.js` | Timeout after initial greeting on page load | Same |
| 7 | `idle-timeout-behavior.spec.js` | `startAudioCapture()` resets idle timeout (Issue #222) | Timeout start/stop vs mic |
| 8 | `idle-timeout-behavior.spec.js` | Restart after `USER_STOPPED_SPEAKING` when agent idle (#262/#430) | Expects console log `Started idle timeout` — see §3 |

---

## Hypothesis cluster A — `IdleTimeoutService` / “first user activity” gate

**Code:** [`src/utils/IdleTimeoutService.ts`](../../../src/utils/IdleTimeoutService.ts)

**`canStartTimeout()`** requires **`hasSeenUserActivityThisSession`** plus agent idle, no playback, no user speaking, not disabled, no active function calls, and not `waitingForNextAgentMessageAfterFunctionResult` (see ~399–406).

**`hasSeenUserActivityThisSession` is set** on `USER_STARTED_SPEAKING`, `USER_STOPPED_SPEAKING` / `UTTERANCE_END`, and `MEANINGFUL_USER_ACTIVITY` (~240–303). It is **not** set on `AGENT_MESSAGE_RECEIVED` alone (~362–369).

**Symptom match:** Playwright logs show `updateTimeoutBehavior() - conditions not met for starting timeout` with idle agent and `waitingForNextAgentMessage=false` but **no** `Started idle timeout` — consistent with **`hasSeenUserActivityThisSession === false`** (the “conditions not met” log does **not** print that flag; consider improving the log in a small REFACTOR for debuggability).

**Product question (must resolve before GREEN):**

1. **Strict:** Idle disconnect countdown may start only after **real user activity** (voice or explicit “meaningful” text/send). Then E2E that expect timeout **immediately after greeting only** must be **updated** to perform a user action that emits `MEANINGFUL_USER_ACTIVITY` (or VAD) before asserting timeout — **tests change, not the gate**.
2. **Relaxed for greeting/mic connect:** Certain flows (e.g. mic connect, or post-greeting) should count as “session started” for idle purposes. Then implementation should **set** the latch in a **single, documented** place (e.g. after successful connect or after greeting completion) — **implementation + tests** stay aligned with docs/issues for #139 / #222 / #262.

**TDD steps (Cluster A)**

### A.1 RED — Pin the rule in tests

- [ ] **Unit:** Add `IdleTimeoutService` tests that assert when `hasSeenUserActivityThisSession` is false, **no** timeout starts even if agent is idle and not playing; when true under the same snapshot, timeout may start. File: `tests/` (existing IdleTimeoutService suite if present, or new).
- [ ] **E2E (optional tightening):** Where a test currently assumes timeout after greeting only, add an assertion or comment that fails until either (1) user activity step is added or (2) product latch is implemented — avoid flaky waits on log substrings alone.

### A.2 GREEN

- [ ] Choose (1) or (2) above with **one sentence** in the relevant issue doc (e.g. [#139 notes](../ISSUE-139-SPEECH-FINAL-HANDLING.md)) or idle-timeout doc if behavior changes.
- [ ] Implement minimal change: either **emit** `MEANINGFUL_USER_ACTIVITY` from the component on the flows E2E use (text connect, mic connect, greeting complete — only where product agrees), or **update E2E** to send user text/audio that satisfies the existing gate.
- [ ] Re-run the **six** tests in rows 5–8 and any other idle-dependent tests in the same run.

### A.3 REFACTOR

- [ ] Extend the “conditions not met” log to include `hasSeenUserActivityThisSession` (and optionally `isDisabled`) so the next E2E failure is self-explanatory.
- [ ] Keep [`useIdleTimeoutManager`](../../../src/hooks/useIdleTimeoutManager.ts) / component event sources consistent with [`IdleTimeoutService`](../../../src/utils/IdleTimeoutService.ts) comments (~434–447) on late assistant/playback signals.

---

## Hypothesis cluster B — Console string `Started idle timeout`

**Code:** `IdleTimeoutService` logs `Started idle timeout (${this.config.timeoutMs}ms)` at ~682 via `this.log()` (level depends on service `debug` flag).

**Symptom:** `idle-timeout-behavior.spec.js` (~975–977) finds a console line containing **`Started idle timeout`**. If the browser only receives **debug**-level messages when `debug: false`, or the prefix differs (`[IDLE_TIMEOUT_SERVICE] debug ...`), the **substring match fails**.

**TDD steps (Cluster B)**

### B.1 RED

- [ ] Add a **unit** test or a **small Playwright smoke** that documents the **exact** console substring the app guarantees in test builds (or switch E2E to assert on `window` diagnostic used elsewhere, e.g. `__idleTimeoutFired__` / existing helpers in [idle-timeout-helpers.js](../../../test-app/tests/e2e/fixtures/idle-timeout-helpers.js)).

### B.2 GREEN

- [ ] Either ensure `Started idle timeout` appears at **info** when `VITE_*` / test-app enables idle timeout debug for E2E, or **change the test** to match the stable contract (prefer one canonical signal).

---

## Hypothesis cluster C — API key in console (`api-key-security-proxy-mode`)

**Symptom:** `should not log API key to console` fails — full key, middle portion, or `extractPotentialApiKeys` heuristic hits new proxy/component logs.

**TDD steps (Cluster C)**

### C.1 RED

- [ ] Reproduce with `USE_PROXY_MODE=true` and capture **one** failing console dump (redact when pasting into issues). Identify which **new log** introduced the leak (Epic #542 touched proxy logging).

### C.2 GREEN

- [ ] **Scrub logs:** never log raw API keys or env values; use length-only or masked prefixes (existing patterns elsewhere in repo).
- [ ] Re-run `api-key-security-proxy-mode.spec.js` in full.

---

## Hypothesis cluster D — Callback, backend auth, `CLIENT_MESSAGE_TIMEOUT` (rows 2–4)

These may be **independent** regressions or **downstream** of the same idle/playback completion ordering (Issue #527 / AgentAudioDone / proxy deferral).

**TDD steps (Cluster D)**

### D.1 RED

- [ ] Run each spec **alone** with `--grep` to confirm failure is deterministic.
- [ ] Read failure **error-context** / screenshots under `test-app/test-results/`.

### D.2 GREEN

- [ ] **callback-test:** Align `onPlaybackStateChange` expectations with **when** the component considers playback complete vs wire-complete (see v0.10.4 changelog / Issue #527).
- [ ] **backend-proxy-authentication:** Verify token-expiry simulation still matches backend responses in proxy mode.
- [ ] **client-message-timeout:** Assert the same user-visible error path; adjust timing if idle disconnect now fires later.

---

## Exit criteria (Issue #544 release doc)

- [ ] `USE_PROXY_MODE=true npm run test:e2e` — **0 failures** (or documented exception on Issue #544 with owner/date).
- [ ] `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — still green.
- [ ] Update [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) and [TRACKING.md](./TRACKING.md) with E2E command, date, and result.

---

## References

- [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) — Issue #544 release steps.
- [ISSUE-489 idle-timeout / function-call TDD](../ISSUE-489/TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md) — related latch semantics.
- [ISSUE-527 / v0.10.4 CHANGELOG](../../releases/v0.10.4/CHANGELOG.md) — receipt vs playback, `AgentAudioDone` ordering.
- [`IdleTimeoutService.ts`](../../../src/utils/IdleTimeoutService.ts) — `canStartTimeout`, `AGENT_MESSAGE_RECEIVED`, `MEANINGFUL_USER_ACTIVITY`.
