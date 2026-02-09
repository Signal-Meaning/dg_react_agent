# Issue #414: Passing vs failing real-API tests — comparison and theory

**Purpose:** Compare the real-API tests that pass (no "server had an error") with those that fail or are flaky, and propose a theory for why the failure occurs in some flows and not others.

**See also:** [RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md) (5s defect, idle-timeout hypothesis), [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7 (idle_timeout_ms behavior when null).

---

## 1. Summary

| Outcome   | Tests / scenarios | Evidence |
|----------|--------------------|----------|
| **Pass** | Firm audio (silence + speech-like) integration tests | 5/5 runs with `USE_REAL_OPENAI=1`; no Error within 12s. [firm-audio-5run-results.txt](./firm-audio-5run-results.txt). |
| **Fail / flaky** | Greeting-flow integration test; E2E (e.g. greeting-playback-validation, openai-proxy-e2e 5b) | Real API can return "server had an error" during greeting or connect-and-wait flows; E2E fails when error is present. |

---

## 2. What the passing tests do (firm audio)

**Tests:**  
`Issue #414 real-API: firm audio connection — no Error from upstream within 12s after sending audio`  
`Issue #414 real-API: firm audio (speech-like audio) — no Error from upstream within 12s`  
**Location:** [tests/integration/openai-proxy-integration.test.ts](../../tests/integration/openai-proxy-integration.test.ts) (lines 797, 845).

**Flow:**

1. Client connects to proxy; proxy connects to OpenAI upstream.
2. Client sends **Settings** with a minimal prompt (e.g. `prompt: 'Hi'`). **No greeting.**
3. Proxy sends `session.update`; upstream sends `session.created` then `session.updated`.
4. Proxy sends **SettingsApplied** to client.
5. **Immediately** on SettingsApplied, client sends **100ms of audio** (4800 bytes): either silence (`Buffer.alloc(4800, 0)`) or speech-like PCM from fixtures.
6. Proxy: has already received `session.updated`, so it sends `input_audio_buffer.append` (base64) to upstream. After **400ms** debounce from last chunk, proxy sends `input_audio_buffer.commit` + `response.create`.
7. Upstream therefore receives **append** within a short time of session.updated, then **commit** and **response.create** within ~400ms. The model starts a **response** (no TTS in the test, but the response lifecycle starts).
8. Test waits **12s**. It passes if no `Error` is received in that window.

**Key point:** Within roughly **500ms** of `session.updated`, the upstream has received appended audio, commit, and `response.create`, so there is an **active response** (or at least recent audio activity). The connection is not idle from the server’s perspective.

---

## 3. What the failing / flaky tests do (greeting flow, E2E)

### 3.1 Greeting-flow integration test

**Test:**  
`Issue #414 real-API: greeting flow must not produce error (USE_REAL_OPENAI=1)`  
**Location:** [tests/integration/openai-proxy-integration.test.ts](../../tests/integration/openai-proxy-integration.test.ts) (lines 1684–1738).

**Flow:**

1. Client connects; proxy connects to upstream.
2. Client sends **Settings** with **greeting** (e.g. `greeting: 'Hello! How can I assist you today?'`).
3. Proxy sends `session.update`; upstream sends `session.updated`.
4. Proxy sends **SettingsApplied** and **ConversationText** (greeting) to the **client only**. The proxy does **not** send the greeting to upstream (no `conversation.item.create` for assistant, no `response.create` for greeting — see below).
5. **No audio is sent.** The test just waits **10 seconds** and then checks that no `Error` was received and that greeting text was received.

**Key point:** After `session.updated`, the upstream receives **no** `input_audio_buffer.append`, **no** `input_audio_buffer.commit`, and **no** `response.create`. From the server’s point of view, the session is **idle**: no user audio committed, no response in progress. The connection sits idle for the full 10s (or until the server sends an error).

#### Why the proxy does not send the greeting to upstream (not a bug)

This is **intentional**, not a bug. The **OpenAI Realtime API rejects client-created assistant items.** If the proxy sent the greeting as `conversation.item.create` (role assistant) and then `response.create`, the upstream would return an error (e.g. "The server had an error" or a rejection of the item). So the Issue #414 fix was: send the greeting **only to the client** as `ConversationText` so the UI can show it; do **not** send it to upstream. See [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](./RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md), [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md), and [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §2.3.

**Under the circumstances**, the downside is that the greeting-only flow produces **no upstream activity** (no append, commit, or response.create). That leaves the session idle and may trigger the server’s undocumented ~5s idle/timeout behavior. So the “bug” is not “we don’t send the greeting” — that’s required by the API — but rather that **idle sessions** appear to hit a server-side timeout; the greeting flow is one of the flows that stays idle.

### 3.2 E2E (e.g. connect-only or send-message-later)

**Examples:**  
- Greeting playback validation: connect, wait for SettingsApplied, possibly no user message or audio sent immediately.  
- openai-proxy-e2e 5b: connect, send audio after a delay; or connect and wait.

**Key point:** Any scenario where we **connect and then wait** (or send a message/audio only after a delay) leaves the upstream with **no commit and no response** for some period. If that period is on the order of **~5 seconds**, the server may send "server had an error" before the client has triggered any response.

---

## 4. Comparison table

| Dimension | Passing (firm audio) | Failing / flaky (greeting, E2E) |
|-----------|----------------------|----------------------------------|
| **Greeting in Settings** | No | Yes (greeting flow) or N/A (E2E) |
| **Audio sent after SettingsApplied** | Yes, **immediately** (100ms) | No (greeting test) or later / conditional (E2E) |
| **Upstream receives append** | Yes, shortly after session.updated | No (greeting) or delayed |
| **Upstream receives commit + response.create** | Yes, ~400ms after last append | No (greeting) or delayed |
| **Server has “activity” (audio + response)** | Within ~500ms of session.updated | No; connection **idle** for seconds |
| **Observed outcome** | No error within 12s (5/5 runs) | Error can appear (~5s); tests fail when it does |

---

## 5. Proposed theory: idle timeout when no activity

**Hypothesis:** The "server had an error" that appears after ~5 seconds is triggered by a **server-side idle timeout** when the session has **no committed audio and no active response** for that period.

- **Passing tests:** They send audio immediately after SettingsApplied. The proxy sends append, then (after 400ms debounce) commit + response.create. So within ~500ms the server has received audio and has started (or is about to start) a response. The server does **not** see the session as idle; the timeout does not fire (or is reset by the activity).
- **Failing tests:** They do **not** send audio (greeting test) or send it later (some E2E). The server sees no append, no commit, no response.create. After ~5s of no activity, the server applies an undocumented idle/timeout behavior and sends "server had an error" (and may close the connection).

This is consistent with:

- The **~5s** timing of the error.
- The **idle_timeout_ms** hypothesis in RESOLUTION-PLAN.md §4 (documented example default `null`; behavior when null not specified; we cannot use Server VAD to test without re-introducing "buffer too small").
- The observation that the error is **flaky** in E2E (depends on timing: if the user sends audio or a message quickly, we get activity and may not hit the timeout; if we wait, we do).

**Implication:** To avoid the error in flows that do not send audio immediately (e.g. greeting-only or connect-and-wait), we would need either: (a) the API to document and optionally disable or extend this timeout when `turn_detection: null`, or (b) the client/proxy to send some minimal “keep-alive” or to trigger a response quickly (e.g. send a minimal audio chunk or a no-op that the server treats as activity). Option (b) is speculative without API guidance.

---

## 6. Definitive statement about 5s or idle disconnect?

**Answer: No.** We have not found an official OpenAI statement or a clear community statement that **text messages from the user** or **idle with no activity** will close the socket (or send "server had an error") after 5 seconds. The Realtime API reference and VAD guide do not document a 5s idle timeout. Community posts mention WebSocket disconnects and "server had an error" but do not specify a 5s rule. So the ~5s timing is **observed**, not **documented**. If you find a definitive source, add it here and to [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7.

---

## 7. Experiment: set idle_timeout_ms to extend the limit (e.g. 10 seconds)

**Idea:** If the 5s error is caused by an undocumented default idle timeout, sending **`idle_timeout_ms`** (e.g. 10000 ms) when we enable Server VAD might move or remove the timeout. We cannot set `idle_timeout_ms` without enabling Server VAD (it's part of `turn_detection: { type: 'server_vad', idle_timeout_ms, create_response: false }`). Enabling Server VAD in the **firm audio** test re-introduces the "buffer too small" dual-control race (we send commit, server also commits). In the **greeting** test we send **no audio**, so we never send `input_audio_buffer.commit`; the only risk is the server firing `timeout_triggered` after `idle_timeout_ms` and committing an empty buffer itself. So the greeting test is a better candidate for this experiment.

**How to run:**

1. Use default **Settings.agent.idleTimeoutMs** (10s) or set **agentOptions.idleTimeoutMs** (e.g. 30000) so the component sends it in Settings; the proxy uses it in session.update.
2. Run the **greeting** real-API test:
   ```bash
   cd /path/to/repo && USE_REAL_OPENAI=1 npx jest tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #414 real-API: greeting flow" --forceExit
   ```
3. With **10000**: the server timeout (if it exists and is controlled by this param) would fire at 10s; the test might pass or fail depending on whether the error arrives before or after the 10s assertion. With **30000**: the timeout would not fire during the 10s test, so if the 5s error was that timeout, the test should **pass**.

**Interpretation:**

- If the greeting test **passes** with default Settings (idleTimeoutMs 10s) and **fails** when the proxy does not send idle_timeout_ms, that supports the theory that the 5s error is an idle timeout and that sending `idle_timeout_ms` from Settings extends it.
- If the greeting test **fails with "buffer too small"** when Server VAD is enabled (even with no audio sent), the server may still commit on `timeout_triggered` (empty buffer) and error; then we cannot use this experiment for the greeting flow without a different approach.
- If there is **no change** (same pass/fail with or without the env var), the 5s error may not be controlled by `idle_timeout_ms`, or the greeting test may be hitting a different code path.

**Wild guess (as requested):** We have no definitive proof that `idle_timeout_ms` controls this limit; it is a **plausible hypothesis** from the Developer notes (idle timeout feature exists) and the ~5s timing. Running the experiment above is the next step to see if the greeting test passes with `idle_timeout_ms=10000` or `30000`.

#### Experiment result (greeting flow, 10s idle timeout)

- **Command:** `USE_REAL_OPENAI=1 npx jest tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #414 real-API: greeting flow" --forceExit`
- **Result:** **Passed** (~10.4s). No error from upstream during the 10s window.
- **Conclusion:** With `idle_timeout_ms=10000`, the greeting flow test passes. This supports the theory that the ~5s "server had an error" is an idle timeout and that `idle_timeout_ms` extends it.

#### Other tests with same env (10s idle + real API)

- **Integration (all three real-API tests):**  
  `USE_REAL_OPENAI=1 npx jest tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #414 real-API" --forceExit`  
  - **Greeting flow:** passed.  
  - **Firm audio (silence + speech-like):** failed with "buffer too small" (expected ≥100ms, got 0.00ms). So in this run the proxy used by Jest likely has Server VAD on or sends commit before enough audio; that is the separate, already-documented buffer-too-small behavior, not the 5s idle error.
- **E2E (greeting-playback-validation + openai-proxy-e2e):**  
  `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai USE_REAL_APIS=1 npx playwright test tests/e2e/greeting-playback-validation.spec.js tests/e2e/openai-proxy-e2e.spec.js --config=tests/playwright.config.mjs`  
  - Backend (and proxy) started with 10s idle; 16 tests ran (no skip).  
  - Partial run: greeting playback and multi-turn passed; some tests failed or timed out; full run hit 5-minute timeout before completion.  
  - For a full E2E run, use a longer timeout or run specs separately.

---

## 8. References

- **Resolution plan and idle-timeout:** [RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md) §4, §4.1, §5.
- **Protocol and idle_timeout_ms:** [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7.
- **Firm audio 5-run results:** [firm-audio-5run-results.txt](./firm-audio-5run-results.txt).
- **Why greeting is not sent to upstream:** [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](./RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md), [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md), [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §2.3.
- **Integration tests:** [tests/integration/openai-proxy-integration.test.ts](../../tests/integration/openai-proxy-integration.test.ts) — firm audio (797, 845), greeting flow (1684).
- **Translator (idle_timeout from Settings):** [scripts/openai-proxy/translator.ts](../../scripts/openai-proxy/translator.ts) — **Settings.agent.idleTimeoutMs** → `turn_detection: { type: 'server_vad', idle_timeout_ms, create_response: false }`. No env var; shared with component.
