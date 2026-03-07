# TDD Plan: Resolve 12 Real-API E2E Failures (Issue #489)

**Goal:** Get all 12 currently failing E2E tests to pass when running with `USE_REAL_APIS=1 npm run test:e2e` from test-app, using test-driven development (Red → Green → Refactor).

**Reference:** [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) — "E2E run WITH real APIs (latest Playwright report)" and "Current E2E failures (real API run)."

**Reproduce:** From test-app: `USE_REAL_APIS=1 npm run test:e2e` (add `E2E_USE_EXISTING_SERVER=1` if servers already running). Last report: 211 passed, **12 failed**, 25 skipped (7.8m).

**Playwright report:** If the browser upgrades localhost to HTTPS or port 9323 is in use, open the report as a file: `open playwright-report/index.html` from test-app, or `file:///.../test-app/playwright-report/index.html`. Per-failure artifacts: `test-app/test-results/<run-folder>/error-context.md` (paths printed in failure output).

---

## Progress (check as we go)

| Phase | Description | Red | Green | Refactor | Notes |
|-------|-------------|-----|-------|----------|--------|
| 1 | Playback / TTS (tests 1, 12) | [x] | [~] | [ ] | **Flaky.** Full run with real APIs: both failed. Isolated re-run: both passed. Often pass without real APIs (proxy/mock path). Treat as flaky; do not block on Phase 1. |
| 2 | Context retention (tests 2, 3, 4) | [ ] | [ ] | [ ] | **Next:** Phase 2 — context on reconnect (app/component supply agent.context in Settings). |
| 3 | Issue-373 long-running (test 5) | [ ] | [ ] | [ ] | |
| 4 | Multi-turn / history (tests 6, 7) | [ ] | [ ] | [ ] | |
| 5 | Function-call reply (tests 8, 9) | [ ] | [ ] | [ ] | |
| 6 | Context on reconnect (tests 10, 11) | [ ] | [ ] | [ ] | Same fix as Phase 2. |

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
| 7 | openai-proxy-e2e.spec.js | 3b. Multi-turn after disconnect – session history preserved | 2 user + 3 assistant after disconnect; count/content differs. |
| 8 | openai-proxy-e2e.spec.js | 6. Simple function calling – assert response in agent-response | Expected `/\d{1,2}:\d{2}|UTC/`. **Received:** `"Hello! How can I assist you today?"` (greeting). Spec line ~286; error-context: `test-results/openai-proxy-e2e-...-acd4e-.../error-context.md`. |
| 9 | openai-proxy-e2e.spec.js | 6b. Issue #462 / #470 – function-call flow (partner scenario) | Same as 8; greeting received. Spec line ~316; error-context: `...-dd25c-.../error-context.md`. |
| 10 | openai-proxy-e2e.spec.js | 9a. Isolation – Settings on reconnect include context | Settings must include agent.context. **Diagnostic:** `__lastGetAgentOptionsDebug` = `fromComponent:0, fromRef:0, fromStorage:0, conversationForDisplay:0, contextMsgCount:0, source:"none"`; WebSocket sent types: `Settings, Settings, InjectUserMessage×4, ping×2`; last Settings has context false. Spec line ~490; error-context: `...-50f9d-.../error-context.md`. |
| 11 | openai-proxy-e2e.spec.js | 9. Repro – session retained; response must not be stale or greeting | Context on reconnect; response not greeting. |
| 12 | openai-proxy-tts-diagnostic.spec.js | diagnose TTS path: binary received and playback status | Binary ≥ 1, no JSON as binary, handleAgentAudio called, playback started, PCM speech-like. |

---

## 2. TDD workflow (mandatory)

For each fix:

1. **Red:** Reproduce the failing test (or add a failing unit/integration test that encodes the desired behavior).
2. **Green:** Implement the minimal change so the test passes.
3. **Refactor:** Clean up without changing behavior; keep tests green.

---

## 3. Phase 1: Playback / TTS (tests 1, 12) — **flaky**

**Status:** Marked **flaky**. Both pass in isolation with real APIs; they failed in the full 12-failure run (order/timing). Not blocking; proceed to Phase 2.

**Tests:** callback-test “onPlaybackStateChange”, openai-proxy-tts-diagnostic “diagnose TTS path”.

**Status:** Red confirmed in full `USE_REAL_APIS=1 npm run test:e2e` (both failed). Isolated re-run (2025-03-06): `callback-test.spec.js --grep "onPlaybackStateChange"` and `openai-proxy-tts-diagnostic.spec.js` **passed** (binary received, playback started, PCM speech-like). Treat as flaky until full suite run is green.

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

## 4. Phase 2: Context / session retention (tests 2, 3, 4)

**Tests:** context-retention-agent-usage (2 tests), context-retention-with-function-calling (1 test).

**Red:** Run with real APIs; confirm tests 2, 3, 4 fail. Diagnostics: getAgentOptions/source "none", Settings on reconnect without context.

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

**Investigation:**

- After "What time is it?" and function call, the model’s natural-language reply (with time) must reach the UI. Today only the transcript ("Function call: get_current_time({})") or greeting is shown. Assistant content must come from conversation.item.added (or equivalent), not from control events. See E2E-FAILURES-RESOLUTION.md “Resolved: Simple function calling” and “Proxy bug: output_text.done must not generate ConversationText”.

**Green (candidate fixes):**

- Proxy: Ensure the model’s reply (time) is sent as ConversationText (assistant) from the correct upstream event (e.g. conversation.item.added). Do not use response.output_text.done as content. If the real API does not send that event, document and optionally relax test to accept fallback message or skip when no time in reply.
- Backend: For tests 6/6b the backend /function-call returns time; ensure proxy forwards the subsequent assistant message to the client.

**Refactor:** Integration test that after FunctionCallResponse, client receives a second ConversationText (assistant) with time-like content when API provides it.

---

## 8. Phase 6: OpenAI proxy – context on reconnect (tests 10, 11)

**Tests:** openai-proxy-e2e 9a (Isolation – Settings on reconnect include context), 9 (Repro – session retained; response not stale or greeting).

**Red:** Run with real APIs; confirm getAgentOptions source `"none"`, last has context false (historyBeforeDisconnect=3, historyAfterDisconnect=3, Settings count=2), and response to "What famous people lived there?" is greeting.

**Investigation:**

- Same root as Phase 2: app/component must send context in Settings on reconnect. 9a asserts Settings include agent.context; 9 asserts the agent reply is not the greeting. If context is missing, upstream treats it as new session and returns greeting.

**Green (candidate fixes):**

- Same as Phase 2: ensure test-app and component supply conversation history (or restoredAgentContext) when building Settings for reconnect. 9a and 9 should pass once context is present in Settings (and upstream returns non-greeting when context is sent).

**Refactor:** Single fix for “context on reconnect” covers tests 2, 3, 4, 10, 11; validate all in one run.

---

## 9. Order of attack and dependencies

| Phase | Tests | Depends on | Suggested order |
|-------|--------|------------|------------------|
| 1 | 1, 12 | Playback path, proxy TTS | First (isolated; unblocks confidence in audio) |
| 2 | 2, 3, 4 | App/component context on reconnect | Second |
| 6 | 10, 11 | Same as Phase 2 (context on reconnect) | With Phase 2 |
| 3 | 5 | IdleTimeoutService during function call | Third |
| 4 | 6, 7 | Proxy multi-turn / history count | Fourth |
| 5 | 8, 9 | Proxy function-call reply content | Fifth |

Phases 2 and 6 can be done together (context on reconnect). Phases 4 and 5 are proxy/API behavior and may require backend or proxy changes.

---

## 10. Acceptance criteria

- [ ] All 12 tests pass when run with `USE_REAL_APIS=1 npm run test:e2e` from test-app.
- [ ] No new regressions: 211+ passing tests remain passing.
- [ ] E2E-FAILURES-RESOLUTION.md updated: move resolved items to “Resolved” or remove from failure list; update counts.
- [ ] TDD: each fix preceded by Red (failing test) and followed by Green + Refactor.

---

## 11. References

- E2E specs: `test-app/tests/e2e/` — callback-test.spec.js, context-retention-agent-usage.spec.js, context-retention-with-function-calling.spec.js, issue-373-idle-timeout-during-function-calls.spec.js, openai-proxy-e2e.spec.js, openai-proxy-tts-diagnostic.spec.js.
- Resolution doc: [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md).
- Idle timeout (resolved): [TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md](./TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md).
- Proxy protocol: `scripts/openai-proxy/`, test-app backend; OPENAI-PROTOCOL-E2E.md, PROTOCOL-AND-MESSAGE-ORDERING.md.
