# TDD Plan: Resolve 12 Real-API E2E Failures (Issue #489)

**Goal:** Get all 12 currently failing E2E tests to pass when running with `USE_REAL_APIS=1 npm run test:e2e` from test-app, using test-driven development (Red → Green → Refactor).

**Reference:** [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) — "E2E run WITH real APIs (latest Playwright report)" and "Current E2E failures (real API run)."

**Reproduce:** From test-app: `USE_REAL_APIS=1 npm run test:e2e` (add `E2E_USE_EXISTING_SERVER=1` if servers already running). Last report: 211 passed, **12 failed**, 25 skipped (7.8m).

**Open:** The **9a bug** (context retention between OpenAI WebSockets on reconnect — Settings on reconnect must include `agent.context`) is **not resolved**. Tests 9a and 9 (openai-proxy-e2e) still fail on the OpenAI path; they pass on the Deepgram path. Do not treat any phase as fixed without re-verification while 9a remains open.

**Playwright report:** If the browser upgrades localhost to HTTPS or port 9323 is in use, open the report as a file: `open playwright-report/index.html` from test-app, or `file:///.../test-app/playwright-report/index.html`. Per-failure artifacts: `test-app/test-results/<run-folder>/error-context.md` (paths printed in failure output).

---

## Status at a glance

**Overall**

- [ ] **All 12 E2E tests pass** with `USE_REAL_APIS=1 npm run test:e2e` from test-app

**Resolution status of each test failure**

| # | Spec | Test | Resolution status |
|---|------|------|-------------------|
| 1 | callback-test | onPlaybackStateChange | **Red.** Fail in full suite. Playback/TTS only; not yet addressed. |
| 2 | context-retention-agent-usage | retain context – agent uses context | **Green (Jest).** E2E still red on OpenAI path; same as 9a. |
| 3 | context-retention-agent-usage | Issue #490 restoredAgentContext on reconnect | **Green (Jest).** E2E still red on OpenAI path; same as 9a. |
| 4 | context-retention-with-function-calling | retain context with function calling | **Green (Jest).** E2E still red on OpenAI path; same as 9a. |
| 5 | issue-373-idle-timeout | NOT timeout during long function call | **Flaky.** Re-run 2025-03: 4 passed, 1 flaky (long-running test: 2 retries had connection closes during 12s execution; passed on 3rd). |
| 6 | openai-proxy-e2e | 3. Multi-turn – second agent response | **Red.** Proxy fallback in place; still 1 assistant msg. Backend/API may not be delivering first reply. |
| 7 | openai-proxy-e2e | 3b. Multi-turn after disconnect | **Red.** Blocked by 9a (context on reconnect). Same fix as 9a. |
| 8 | openai-proxy-e2e | 6. Simple function calling – time in response | **Red.** agent-response stays greeting; proxy fallback in place; API/backend may not send time reply. |
| 9 | openai-proxy-e2e | 6b. Function-call flow (partner) | **Red.** Same as #8. |
| 10 | openai-proxy-e2e | 9a. Settings on reconnect include context | **Red.** Open bug. Passes Deepgram; fails OpenAI. Context empty on reconnect (refs/window). Diagnostics in place. |
| 11 | openai-proxy-e2e | 9. Session retained; response not greeting | **Red.** Blocked by 9a; needs context on reconnect. |
| 12 | openai-proxy-tts-diagnostic | TTS path: binary + playback status | **Red.** Fail in full suite. Playback/TTS only; not yet addressed. |

**By phase (phase = E2E green for its tests; 2 and 6 combined in order)**

| Phase | Scope | Complete? |
|-------|--------|-----------|
| 1 | Playback / TTS (tests 1, 12) | [ ] |
| 2+6 | Context retention + context on reconnect (tests 2, 3, 4, 10, 11) | [ ] |
| 3 | Issue-373 long function call (test 5) | [~] (re-run: 4 pass, 1 flaky) |
| 4 | Multi-turn / history (tests 6, 7) | [ ] |
| 5 | Function-call reply (tests 8, 9) | [ ] |

**Acceptance (all must be checked to close)**

- [ ] All 12 tests above pass with real APIs
- [ ] No regressions (211+ passing remain)
- [ ] E2E-FAILURES-RESOLUTION.md updated when items resolve
- [ ] Refactor pass done (timeouts, remove [ISSUE-489] diagnostics)

---

## Progress (check as we go)

| Phase | Description | Red | Green | Refactor | Notes |
|-------|-------------|-----|-------|----------|--------|
| 1 | Playback / TTS (tests 1, 12) | [x] | [ ] | [ ] | **Red.** Playback/TTS only. Red in full suite. See §3. |
| 2+6 | Context retention + context on reconnect (tests 2, 3, 4, 10, 11) | [x] | [~] | [ ] | **Green (Jest):** Sync localStorage; preload; hadAgentConnectionClosedRef; always preload; per-instance ref. **9a E2E:** Still fails with OpenAI. Same fix covers 2,3,4,10,11. See §11 Next steps. |
| 3 | Issue-373 long-running (test 5) | [x] | [~] | [ ] | Re-ran with real APIs: 4 passed, 1 flaky (long-running test failed 2× with connection closes during 12s execution, passed on retry). IdleTimeoutService blocks timeout; flakiness may be proxy/upstream closing (code 1005). |
| 4 | Multi-turn / history (tests 6, 7) | [x] | [~] | [ ] | **Red.** Proxy fallback in place; 3 & 3b still fail (1 assistant). **3b depends on 9a.** |
| 5 | Function-call reply (tests 8, 9) | [x] | [ ] | [ ] | **Red.** agent-response stays greeting; proxy fallback in place; API/backend may not send time reply. |

**Acceptance criteria**

- [ ] All 12 tests pass with `USE_REAL_APIS=1 npm run test:e2e` from test-app.
- [ ] No new regressions (211+ passing remain).
- [ ] E2E-FAILURES-RESOLUTION.md updated when items resolve.
- [ ] TDD: Red → Green → Refactor for each fix.

---

## 1. Summary of the 12 failures

| # | Spec | Test | Likely cause / assertion |
|---|------|------|---------------------------|
| 1 | callback-test.spec.js | onPlaybackStateChange callback with agent response | `audio-playing-status` must go true → false; timeout on playback start (35s) or final status not `'false'`. |
| 2 | context-retention-agent-usage.spec.js | should retain context when disconnecting and reconnecting – agent uses context | Agent must use context after reconnect. |
| 3 | context-retention-agent-usage.spec.js | Issue #490: when app provides restoredAgentContext, Settings on reconnect include it | Settings on reconnect must include restored context. |
| 4 | context-retention-with-function-calling.spec.js | should retain context when disconnecting and reconnecting with function calling enabled | Context retention with function calling. |
| 5 | issue-373-idle-timeout-during-function-calls.spec.js | should NOT timeout during long-running function call execution | Connection must stay open during 12s function call. |
| 6 | openai-proxy-e2e.spec.js | 3. Multi-turn – second agent response appears | 2 user + 3 assistant; second response not as expected. |
| 7 | openai-proxy-e2e.spec.js | 3b. Multi-turn after disconnect – session history preserved | 2 user + 3 assistant after disconnect; **depends on 9a** (context on reconnect). |
| 8 | openai-proxy-e2e.spec.js | 6. Simple function calling – assert response in agent-response | Expected `/\d{1,2}:\d{2}|UTC/`. **Received:** `"Hello! How can I assist you today?"` (greeting). Spec line ~286; error-context: `test-results/openai-proxy-e2e-...-acd4e-.../error-context.md`. |
| 9 | openai-proxy-e2e.spec.js | 6b. Issue #462 / #470 – function-call flow (partner scenario) | Same as 8; greeting received. Spec line ~316; error-context: `...-dd25c-.../error-context.md`. |
| 10 | openai-proxy-e2e.spec.js | 9a. Isolation – Settings on reconnect include context | Settings must include agent.context. **Isolated to OpenAI proxy:** 9a **passes** vs Deepgram (real APIs); **fails** vs OpenAI (real APIs). OpenAI path: `fromComponent:0, fromRef:0, source:"none"`; Deepgram path: `fromComponent:4, fromRef:4, source:"display"`. See “Defect isolation (9a)” in Phase 2. |
| 11 | openai-proxy-e2e.spec.js | 9. Repro – session retained; response must not be stale or greeting | Context on reconnect; response not greeting. |
| 12 | openai-proxy-tts-diagnostic.spec.js | diagnose TTS path: binary received and playback status | Binary ≥ 1, no JSON as binary, handleAgentAudio called, playback started, PCM speech-like. |

---

## 2. TDD workflow (mandatory)

For each fix:

1. **Red:** Reproduce the failing test (or add a failing unit/integration test that encodes the desired behavior).
2. **Green:** Implement the minimal change so the test passes.
3. **Refactor:** Clean up without changing behavior; keep tests green.

---

## 3. Phase 1: Playback / TTS (tests 1, 12)

**Phase 1 is playback/TTS only.** 9a (context on reconnect) is in Phase 2 / Phase 6, not here.

**What’s up with Phase 1 (tests 1 & 12)**  
Both tests depend on the same chain:

1. **Proxy** sends TTS as **binary** WebSocket frames (PCM from `response.output_audio.delta`).
2. **Component** receives binary in `handleAgentAudio` and feeds the **AudioManager** / playback sink.
3. **AudioManager** (or sink) emits `playing` with `isPlaying: true` when playback starts, then `isPlaying: false` when it ends.
4. **Component** dispatches `PLAYBACK_STATE_CHANGE` and notifies **`onPlaybackStateChange`**; test-app shows that as **`[data-testid="audio-playing-status"]`** (true/false).

- **Test 1 (callback-test, onPlaybackStateChange):** Sends a message, waits up to 35s for `audio-playing-status` to become `'true'`, then waits for greeting, then expects `'false'`. **Fails when:** (a) playback never becomes true within 35s (no binary, or binary not routed to playback, or sink never emits start), or (b) after greeting the status is still true (sink never emits stop / component never dispatches false).
- **Test 12 (openai-proxy-tts-diagnostic):** Asserts: ≥1 binary frame, no JSON as binary, `handleAgentAudio` called, if binary then playback started, AudioContext OK, PCM speech-like. **Fails when:** proxy sends no binary, or binary not routed so status never true, or PCM not speech-like.

**Likely failure points (full suite):** (1) **Timing/order** — in a long run, TTS or playback may finish before the test checks, or 35s/8s may be too short under load. (2) **Proxy** not sending binary in that run. (3) **Component** not calling `onPlaybackStateChange` or not updating the status in time. (4) **AudioContext** suspended (browser policy) so playback never “starts” from the test’s perspective. Isolated re-runs have been reported to pass, so failures may be **flaky** (order/timing/resource contention).

**Phase 1 status:**

| Run type | Tests 1 & 12 result | Note |
|----------|---------------------|------|
| **Full suite** (`USE_REAL_APIS=1 npm run test:e2e`) | **Fail** | Red; counted among the 12 failures. |
| **Isolated run** | **Unconfirmed** | Not re-verified. |

**Tests:** callback-test “onPlaybackStateChange”, openai-proxy-tts-diagnostic “diagnose TTS path”.

**Red:** Run with real APIs; confirm tests 1 and 12 fail. Capture which assertion fails (e.g. playback never true, binary count 0, or PCM not speech-like).

**Investigation:**

- **callback-test:** Waits for `waitForAudioPlaybackStart(page, 35000)` then expects `audio-playing-status` to become `'false'` after greeting. If playback never becomes `true` within 35s, or component never sets it back to `false` after TTS ends, test fails. Check: (1) proxy sends binary TTS; (2) component calls `onPlaybackStateChange` with `isPlaying: true` then `false`; (3) test-app exposes `audio-playing-status` from that callback.
- **TTS diagnostic:** Asserts binary count ≥ 1, playback started if binary received, handleAgentAudio called, PCM speech-like. If proxy does not send PCM (e.g. wrong endpoint or upstream), or component does not route binary to playback, one of these fails. Check proxy logs and component playback path.

**Green (candidate fixes):**

- If playback never starts: ensure component dispatches playback state when it starts/stops playing (e.g. on first binary / on AgentAudioDone or stream end). Add unit test that playback state is set true then false when agent audio is played.
- If proxy does not send binary: fix proxy or document that TTS diagnostic requires a proxy that sends PCM; optionally skip when no binary in env.
- If timing: extend wait in callback-test or make assertion more resilient (e.g. allow “playback finished before we read” path).

**Refactor:** Keep test timeouts and assertions minimal; add comments where env-dependent.

---

## 4. Phase 2+6: Context / session retention and context on reconnect (tests 2, 3, 4, 10, 11)

**Combined in order:** Context retention (2, 3, 4) and context on reconnect (10, 11) share the same fix — Settings must include `agent.context` on reconnect; 9a/9 are the OpenAI-path manifestation.

**Tests:** context-retention-agent-usage (2), context-retention-with-function-calling (1), openai-proxy-e2e 9a (Settings on reconnect include context), 9 (session retained; response not greeting).

**Red:** [x] 9a still fails: `__lastGetAgentOptionsDebug` source "none", fromComponent/fromRef/fromStorage 0 at last getAgentOptions call (app’s getAgentOptions; component’s getContextForSend still sees empty history).

**Green (applied):**
- Sync `localStorage.setItem(CONVERSATION_STORAGE_KEY, …)` when appending ConversationText (so storage has history before any close).
- On agent connection **closed**, preload `lastPersistedHistoryForReconnectRef` from localStorage (keys: lastUsed, dg_voice_conversation, dg_conversation).
- On agent **connected** when **reconnection**, preload from localStorage into `lastPersistedHistoryForReconnectRef` **before** `sendAgentSettings()` (avoids race where new WS opens before old WS ‘closed’).
- **Component (root-cause fixes):** (1) **Reconnection detection:** `hadAgentConnectionClosedRef` — set `true` on `'closed'`; on next `'connected'` use `isReconnection = event.isReconnection ?? hadAgentConnectionClosedRef.current` so a new WebSocketManager (which reports `isReconnection: false`) is still treated as reconnection. (2) **Always preload:** Before every `sendAgentSettings()` when WebSocket is OPEN, preload from localStorage into `lastPersistedHistoryForReconnectRef` (not only when `isReconnectionRef.current`). (3) **Per-instance ref:** `lastPersistedHistoryForReconnectRef` is now a component `useRef` (not module-level), so each instance and each test has correct isolation; remount gets a fresh ref that is then filled by the preload. (4) **App:** `getAgentOptions` type fix for `fromWindowApp` (ternary so type is array, not `false | array`).
- **Jest:** All 12 tests in `useSettingsContext.test.tsx` and `reconnect-settings-context-isolation.test.tsx` **pass**. 9a E2E still fails with OpenAI (see below).

**Defect isolation (9a):** The same 9a test was run against **Deepgram** and **OpenAI** with real APIs (E2E backend-agnostic; see test-app E2E-BACKEND-MATRIX.md).

| Backend | Result | Diagnostic (getAgentOptions / Settings context) |
|--------|--------|--------------------------------------------------|
| **Deepgram** (`E2E_BACKEND=deepgram USE_PROXY_MODE=true USE_REAL_APIS=1`) | **Pass** | `fromComponent: 4`, `fromRef: 4`, `contextMsgCount: 4`, `source: "display"`; last Settings has context. |
| **OpenAI** (`USE_PROXY_MODE=true USE_REAL_APIS=1`, default backend) | **Fail** | `fromComponent: 0`, `fromRef: 0`, `source: "none"`; last Settings has no context. |

**Conclusion:** The defect is **isolated to the OpenAI proxy path**. With Deepgram, the component’s refs and the app’s conversation/context remain available on reconnect and Settings include context. With OpenAI, by the time `getContextForSend` / `getAgentOptions` run on reconnect, refs and app context are empty. Likely causes when using the OpenAI proxy: (1) **Component remount** or different lifecycle so the same instance’s refs are not used on reconnect. (2) **Connection/WebSocket handling** (e.g. OpenAI proxy or test-app) triggering a remount or a new component instance when the socket reconnects. (3) **Timing/ordering** specific to the OpenAI path (e.g. connection-open handler runs before refs or app state are restored). Fix should target the OpenAI proxy flow (test-app + component behavior when `proxyEndpoint` includes `/openai`), not the general context-retention logic (which works for Deepgram and in Jest).

**Next:** Resolve 9a using **[TDD-PLAN-9A-CONTEXT-ON-RECONNECT.md](./TDD-PLAN-9A-CONTEXT-ON-RECONNECT.md)**. Do not proceed to other phases until 9a is fixed; then see §11.

**Attempted fixes (Phase 2/6, 2025-03):** (1) **App:** `lastKnownConversationRef` plus `window.__appLastKnownConversation`; `getAgentOptions` uses `fromLastKnown` and `fromWindowApp`; type fix for `fromWindowApp`. (2) **Component hook:** `useSettingsContext` reads `window.__e2eRestoredAgentContext` and `window.__appLastKnownConversation` (and `window.top`). (3) **E2E test:** Set context on `window` and `window.top`, and **before** disconnect. (4) **Component:** `hadAgentConnectionClosedRef`, always preload from localStorage before sendAgentSettings, and per-instance `lastPersistedHistoryForReconnectRef`. Despite (1)–(4), 9a still fails with OpenAI: last `getAgentOptions` reports all zeros and last Settings has no context. **Open:** The code path that runs on reconnect (OpenAI) may execute in a different context (e.g. closure over a different instance), or the second Settings may be built/sent from a path that does not see the preloaded ref or window.

**Tests that validate the integration path (Jest):** In `tests/reconnect-settings-context-isolation.test.tsx` we added integration tests that would expose defects in the component’s use of context:
- *Settings with agent.context from localStorage when refs are empty on first connection* — ensures `getHistoryForSettings` → `getItem` is used and context is sent when refs are empty.
- *Settings with agent.context from window fallback when getAgentOptions returns empty context* — ensures the component uses `effectiveContext` from `getContextForSend()` (including window fallback) rather than only `getAgentOptions().context`.
- *Settings with agent.context from window.__e2eRestoredAgentContext when refs and storage are empty* — ensures the E2E fallback is used in the full component flow.

These tests **pass** in Jest, so the defect is not reproduced in the unit/integration environment. The 9a E2E failure is **reproduced only with the OpenAI proxy**; with the Deepgram proxy the same test passes.

**Investigation:**

- On reconnect, the component (or test-app) must supply context to the next Settings (e.g. from `getConversationHistory()` or `restoredAgentContext`). If the app does not pass `restoredAgentContext` or the component does not include `agent.context` in Settings when reconnecting, proxy receives Settings without context and upstream may return greeting.
- Test-app and component: where is `getAgentOptions` / `agentOptions` built on reconnect? Ensure conversation history (or restored context) is included in `agent.context.messages` for the Settings sent on reconnect.

**Green (candidate fixes):**

- **App:** On reconnect, pass `restoredAgentContext` from current conversation history (or ref) so the component sends it in the next Settings. Add unit or integration test that when reconnecting with a non-empty history, the next Settings payload includes `agent.context.messages` with that history.
- **Component:** If the component builds agent context internally, ensure it uses conversation history (or `restoredAgentContext` prop) when building Settings for reconnect. Document in E2E-FAILURES-RESOLUTION.md.

**Refactor:** Centralize “context for reconnect” logic; add tests that assert Settings payload shape.

---

## 5. Phase 3: Issue-373 long-running function call (test 5)

**Test:** issue-373 “should NOT timeout during long-running function call execution”.

**Red:** Run with real APIs; confirm test 5 fails (connection closes or assertion fails during 12s function call).

**Status (2025-03 re-run):** Ran `issue-373-idle-timeout-during-function-calls.spec.js` with real APIs: **4 passed, 1 flaky.** The test "should NOT timeout during long-running function call execution" failed on first two attempts (2 connection closes during the 12s execution; code 1005) and passed on the third. IdleTimeoutService correctly blocks idle timeout during function calls; the flakiness may be the proxy or upstream closing the WebSocket during the 12s window. Mark Phase 3 as [~] (green when no closes; flaky when closes occur).

**Investigation:**

- Test uses an in-browser function that sleeps 12s. Idle timeout (e.g. 10s) might fire before the function returns, or upstream might close the connection. IdleTimeoutService should not start the idle timeout while a function call is in progress (`hasActiveFunctionCalls` or `waitingForNextAgentMessageAfterFunctionResult`).
- Check: (1) FUNCTION_CALL_STARTED / FUNCTION_CALL_COMPLETED (or equivalent) so service knows a function is in progress; (2) idle timeout is not started until after AgentAudioDone (or completion) after the function result; (3) test timeout (60s) is sufficient.

**Green (candidate fixes):**

- If idle timeout fires during the 12s: ensure IdleTimeoutService does not start (or resets) idle timeout while `hasActiveFunctionCalls()` or `waitingForNextAgentMessageAfterFunctionResult` is true. Add unit test: during 12s function call, advance timers past idle timeout; assert onTimeout is not called (or connection not closed in E2E).
- If upstream closes: document or relax assertion; or increase idle_timeout in test so it is longer than 12s for this test only.

**Refactor:** Reuse existing issue-373 unit tests; ensure long-running path is covered.

---

## 6. Phase 4: OpenAI proxy – multi-turn and history (tests 6, 7)

**Tests:** openai-proxy-e2e 3 (Multi-turn), 3b (Multi-turn after disconnect).

**Red:** Run with real APIs; confirm tests 6 and 7 fail (second agent response not as expected, or assistant count ≠ 3).

**Status (2025-03):** **Red confirmed.** Both tests 3 and 3b fail: `expect(…locator('[data-role="assistant"]')).toHaveCount(2)` — expected 2 assistant messages (greeting + first reply), received 1. Root cause: when the real API does not send `conversation.item.added` for a response, the proxy was not sending any ConversationText (assistant) for that reply (design was “assistant content only from conversation.item.added”). Assistant content comes from `conversation.item.added` only (protocol); `response.output_text.done` is control only, not ConversationText. **3b depends on 9a** (context on reconnect).

**Investigation:**

- **Test 3:** Expects 2 user + 3 assistant messages; second agent reply must appear. If real API or proxy returns fewer or different messages, or ordering is wrong, test fails. Check proxy logs: how many ConversationText (assistant) are sent; ensure no duplicate or missing.
- **Test 3b:** After disconnect, expects 2 user + 3 assistant. If on reconnect the API or proxy sends more items (e.g. duplicate greeting, extra conversation.item.added), count becomes 4–5. Fix: proxy should not map control events (e.g. output_text.done) to ConversationText; only protocol-defined source (e.g. conversation.item.added) should add assistant content. See E2E-FAILURES-RESOLUTION.md §2.

**Green (candidate fixes):**

- Proxy: Audit mapping of upstream events to ConversationText; remove any that use control signals (output_text.done, etc.) as content. Add integration test that counts ConversationText (assistant) for a known flow and expects exact count.
- Component/test-app: If component merges session history with live messages and double-counts, deduplicate or single source of truth for history display.

**Refactor:** Document expected ConversationText count per flow in proxy; add integration tests for multi-turn and reconnect.

---

## 7. Phase 5: OpenAI proxy – function-call reply (tests 8, 9)

**Tests:** openai-proxy-e2e 6 (Simple function calling), 6b (Partner scenario).

**Red:** Run with real APIs; confirm agent-response stays greeting (`"Hello! How can I assist you today?"`) and never shows time/UTC (locator resolves 18× to that string within 45s).

**Status (re-run):** **Still Red.** agent-response remains greeting; model reply (time) is not delivered to the UI. The proxy fallback (send `response.output_text.done` as ConversationText when no assistant text for that response) is in place; if the real API never sends that event with the time string after the function result, the gap is upstream or backend. Backend /function-call must return time and the API must send the model’s reply (e.g. output_text.done or conversation.item.added) for the proxy to forward.

**Investigation:**

- After "What time is it?" and function call, the model’s natural-language reply (with time) must reach the UI. Today only the transcript ("Function call: get_current_time({})") or greeting is shown. Assistant content must come from conversation.item.added (or equivalent), not from control events. See E2E-FAILURES-RESOLUTION.md “Resolved: Simple function calling” and “Proxy bug: output_text.done must not generate ConversationText”.

**Green (candidate fixes):**

- Proxy: Ensure the model’s reply (time) is sent as ConversationText (assistant) from the correct upstream event (e.g. conversation.item.added). Do not use response.output_text.done as content. If the real API does not send that event, document and optionally relax test to accept fallback message or skip when no time in reply.
- Backend: For tests 6/6b the backend /function-call returns time; ensure proxy forwards the subsequent assistant message to the client.

**Refactor:** Integration test that after FunctionCallResponse, client receives a second ConversationText (assistant) with time-like content when API provides it.

---

## 8. Order of attack and dependencies

Phase 2+6 is combined (see §4). Run test 5 first with real APIs to re-verify Phase 3.

| Phase | Tests | Depends on | Suggested order |
|-------|--------|------------|------------------|
| 1 | 1, 12 | Playback path, proxy TTS | First (isolated; unblocks confidence in audio) |
| 2+6 | 2, 3, 4, 10, 11 | App/component context on reconnect (same fix) | Second |
| 3 | 5 | IdleTimeoutService during function call | **Run first** (re-verify with real APIs), then third |
| 4 | 6, 7 | Proxy multi-turn / history count | Fourth |
| 5 | 8, 9 | Proxy function-call reply content | Fifth |

Phase 2+6 is one combined phase (context on reconnect). Phases 4 and 5 are proxy/API behavior and may require backend or proxy changes.

---

## 9. Acceptance criteria (closure)

- [ ] All 12 tests pass when run with `USE_REAL_APIS=1 npm run test:e2e` from test-app.
- [ ] No new regressions: 211+ passing tests remain passing.
- [ ] E2E-FAILURES-RESOLUTION.md updated: move resolved items to “Resolved” or remove from failure list; update counts.
- [ ] TDD: each fix preceded by Red (failing test) and followed by Green + Refactor.

---

## 10. References

- E2E specs: `test-app/tests/e2e/` — callback-test.spec.js, context-retention-agent-usage.spec.js, context-retention-with-function-calling.spec.js, issue-373-idle-timeout-during-function-calls.spec.js, openai-proxy-e2e.spec.js, openai-proxy-tts-diagnostic.spec.js.
- Resolution doc: [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md).
- Idle timeout (resolved): [TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md](./TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md).
- Proxy protocol: `scripts/openai-proxy/`, test-app backend; OPENAI-PROTOCOL-E2E.md, PROTOCOL-AND-MESSAGE-ORDERING.md.

---

## 11. Next steps (proposed)

**Focus: resolve 9a before other phases.** Priority 1 (9a — context retention on reconnect with the OpenAI proxy) is **unresolved**. We ran Phase 3 (test 5) and touched Phases 4/5 without fixing 9a; that was getting ahead. Until 9a is fixed, Phases 2+6 (tests 2, 3, 4, 10, 11), Phase 4 (3b), and Phase 5 remain blocked or incomplete.

**Use the dedicated 9a plan:** All work to resolve the context-retention bug in WebSocket handling is in **[TDD-PLAN-9A-CONTEXT-ON-RECONNECT.md](./TDD-PLAN-9A-CONTEXT-ON-RECONNECT.md)**. That document is the single place to track repro, diagnostics, and fixes for 9a. Do not spread 9a steps across this plan. **Status:** 9a Green fix is implemented (sync load from storage in `sendAgentSettings()` when refs empty); **E2E verification pending** (run 9a with OpenAI to confirm).

**After 9a is resolved:** Return to this document. Then: (1) Remove `[ISSUE-489]` diagnostics and refs (see TDD-PLAN-9A §Refactor). (2) Re-run Phase 2+6 and 9a/9 E2E to confirm green. (3) Proceed with Phase 1 (playback/TTS), Phase 3 (flakiness if needed), Phase 4, Phase 5. (4) Update [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) as failures resolve.
