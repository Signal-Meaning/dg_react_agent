# Issue #489: E2E Failures to Resolve (Proxy Mode)

**Context:** Run `USE_PROXY_MODE=true npm run test:e2e` from `test-app/`. Original run: **19 failed**, 23 skipped, 203 passed (7.4m).

This document tracks the failing E2E tests and resolution steps for the v0.9.8 release (Issue #489).

---

## Latest E2E run (partial, after Issue #482/#489 fix)

**Run:** Partial run (suite cut short). **6 failed**, 5 interrupted, 64 passed (~2m).

| Result | Count |
|--------|--------|
| Failed | 6 |
| Interrupted | 5 |
| Passed | 64 |
| Skipped / did not run | 155+ |

**The 6 failures in this run:**

| # | Spec / test | Error (summary) | In original 19? |
|---|-------------|------------------|------------------|
| 1 | context-retention-agent-usage › should retain context when disconnecting and reconnecting - agent uses context | `waitForFunction` 30s exceeded (disconnectComponent: wait for status `'closed'`) | Yes — (d) |
| 2 | context-retention-agent-usage › should verify context format in Settings message | Same: wait for `'closed'` 30s | Yes — (d) |
| 3 | deepgram-greeting-idle-timeout › should timeout after greeting completes (Issue #139) | `expect(timeoutResult.closed).toBe(true)` — received false | Yes — (b) |
| 4 | deepgram-greeting-idle-timeout › should timeout after initial greeting on page load | Same: timeoutResult.closed false | Yes — (b) |
| 5 | deepgram-manual-vad-workflow › should handle complete manual workflow: speak → silence → timeout | `waitForFunction` 10s (assertConnectionState) exceeded | Yes — (b) |
| 6 | deepgram-text-session-flow › should auto-connect and re-establish connection when WebSocket is closed | `waitForFunction` 30s exceeded (disconnectComponent: wait for `'closed'`) | Yes — (d) |

All 6 are in our original triage list. So no new failure modes appeared; the same tests still fail.

### Why these 6 still appear unaddressed

- **Issue #482/#489 fix in place:** We fixed (1) proxy to send `AgentAudioDone` on `response.done` (and on `output_text.done` / `output_audio.done`) and (2) component to transition to idle when it receives `AgentAudioDone` in speaking state. That addresses **conversation response** flows where the upstream sends a full response lifecycle. Logs from this run show `AgentAudioDone` is received and IdleTimeoutService is triggered in at least one test (e.g. WebSocket timing test completed successfully with “triggered by: AgentAudioDone”).

- **Why (b) greeting tests (3, 4) still fail:** The fix applies to **response** completion (user message → model response → `response.output_text.done` / `response.output_audio.done` / `response.done`). The **greeting** in proxy mode is sent as **ConversationText only** (injected to client; no upstream “response” for the greeting text). So the proxy typically does **not** send `AgentAudioDone` after the greeting. The component never transitions to idle after “greeting completes,” so the idle timeout never starts and the connection never closes. **Greeting is a different code path** and was not in scope for the Issue #482 proxy fix. To fix 3 and 4 we need either: proxy sends `AgentAudioDone` (or equivalent) after injecting the greeting ConversationText, or tests/expectations are adjusted for “no timeout after greeting” in proxy mode.

- **Why (d) reconnection/context tests (1, 2, 6) still fail:** These tests call `disconnectComponent()` and wait for connection status `'closed'` (e.g. 30s). They are **(d) reconnection/context**: the test expects to disconnect (simulate idle timeout or close) and then see `'closed'` so it can continue (e.g. re-establish). Our fix only ensures **idle timeout can start** after agent response (and greeting path is separate). It does **not** change how or how quickly the component reaches `'closed'` when the test triggers a disconnect, or how reconnection is signaled. So if the test’s “disconnect” step doesn’t actually close the connection in proxy mode, or the UI doesn’t show `'closed'` in time, the test still times out. Addressing these requires proxy/test work on **reconnection and when status becomes 'closed'**, not the AgentAudioDone/response-completion path.

- **Why (b) manual VAD (5) still fails:** The test does: speak (“wait one moment”) → stay silent (expect UtteranceEnd) → wait for connection to close. In the run, “UtteranceEnd status: Not detected” appeared, so the “silence → timeout” flow may not complete as the test expects (e.g. no UtteranceEnd in proxy/VAD path, or timing). Even with AgentAudioDone in place for the **agent** response, if the test never gets to “agent finished” (e.g. no agent reply, or no AgentAudioDone for that reply), or if the disconnect/close expectation is strict, the test can still fail. So (5) can remain (b)-like (idle timeout not firing) or (c) (test/env: UtteranceEnd or close timing).

**Summary:** The 6 failures in this run are the **same categories** as in the original triage. The Issue #482/#489 fix targets **conversation response → AgentAudioDone → idle → timeout** and does not yet cover **greeting injection** (3, 4), **reconnection/closed** behavior (1, 2, 6), or the **manual VAD** flow (5) which may also depend on greeting or reconnection/close behavior.

### Failure details from Playwright report

Source: `test-app/test-results/results.json` and `test-app/test-results/*/error-context.md` (page snapshot at failure).

| # | Spec / test | Error (exact) | Location | Page state at failure |
|---|-------------|----------------|----------|------------------------|
| 1 | context-retention-agent-usage › should retain context when disconnecting and reconnecting - agent uses context | `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.` | `test-helpers.js:969` (disconnectComponent) → `context-retention-agent-usage.spec.js:103` | Agent Connection: **connected**; agentState: idle; Timeout Active: false. Status never became `'closed'`. |
| 2 | context-retention-agent-usage › should verify context format in Settings message | Same: `Timeout 30000ms exceeded` at disconnectComponent | `test-helpers.js:969` → `context-retention-agent-usage.spec.js:362` | Agent Connection: **connected** (OpenAI proxy); agentState: idle. Wait for `'closed'` never satisfied. |
| 3 | deepgram-greeting-idle-timeout › should timeout after greeting completes (Issue #139) | `Error: expect(received).toBe(expected) // Object.is equality` — Expected: **true**, Received: **false** | `deepgram-greeting-idle-timeout.spec.js:79` — `expect(timeoutResult.closed).toBe(true)` | Agent Connection: **connected**; agentState: idle; Timeout Active: false. Greeting shown ("Hello! How can I assist you today?"). Connection never closed within poll window. |
| 4 | deepgram-greeting-idle-timeout › should timeout after initial greeting on page load | Same: `expect(timeoutResult.closed).toBe(true)` — received false | `deepgram-greeting-idle-timeout.spec.js:168` | Same: connected, idle, Timeout Active: false; greeting in Conversation History. |
| 5 | deepgram-manual-vad-workflow › should handle complete manual workflow: speak → silence → timeout | `TimeoutError: page.waitForFunction: Timeout 10000ms exceeded.` | `test-helpers.js:945` (assertConnectionState) → `deepgram-manual-vad-workflow.spec.js:84` | User Started Speaking: 20:44:10, User Stopped Speaking: 20:44:11, **Utterance End: Not detected**. Agent responded ("What's your project about..."). Test expected connection state (e.g. `'closed'`) within 10s; not reached. |
| 6 | deepgram-text-session-flow › should auto-connect and re-establish connection when WebSocket is closed | `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.` | `test-helpers.js:969` (disconnectComponent) → `deepgram-text-session-flow.spec.js:42` | After first message sent and agent responded, test calls disconnectComponent and waits for `'closed'`; status stayed connected. |

**Helper involved:** `disconnectComponent()` in `test-app/tests/e2e/helpers/test-helpers.js` (lines 967–972) waits for `[data-testid="connection-status"]` text to equal `'closed'`. All (d) failures and (6) time out there because the UI never shows `'closed'` within the timeout.

---

### Why the same 19?
**Why 19 still fail:** Of the 19 failures, 6 are **(d) reconnection/context** (context-retention, text-session-flow, openai-proxy-e2e)—unrelated to idle timeout. The remaining **(b)** idle-timeout failures are because the component never transitions to idle: it only does so when the audio manager reports playback stopped (`isPlaying: false`). **The proxy (and translators) that this project promotes for other teams to use are our responsibility.** If that proxy does not send `AgentAudioDone` when the upstream response completes, we need to fix it (Issue #482). Until the proxy we promote sends `AgentAudioDone` correctly, the (b) failures will persist.

---

## Bigger picture: defect and test inadequacy

### Reported defect (Issue #487 / voice-commerce #1058)

The component was closing the connection on idle timeout **while the agent was still busy**: after the app sent a function result and before the model sent the next message (e.g. next function call in a chained flow). We fixed this by treating “waiting for next agent message after function result” as busy: idle timeout does not start until `AGENT_MESSAGE_RECEIVED` is emitted.

### Why E2E failures suggest the defect may still be present or regressed

1. **Same surface area:** Many of the 19 failures are idle-timeout or reconnection scenarios. If the fix is wrong or incomplete, E2E would show it (e.g. connection closing when it shouldn’t, or never closing when it should).
2. **Proxy vs unit world:** Unit and integration tests run `IdleTimeoutService` with synthetic events. They do **not** run the full component with a real or proxy WebSocket, so they never exercise the path: real `FunctionCallRequest` → app sends `FunctionCallResponse` → no next message for 10s → connection must stay open. So we could have fixed the service in isolation but still have a bug in how the component wires events in proxy mode (e.g. `handleNextAgentMessageReceived` not called, or proxy message shape different).
3. **Regression risk:** The fix introduces a new state (“waiting for next agent message”). If that state is set when it shouldn’t be, or never cleared in some flows, the connection might **never** close (timeout never starts). Several E2E tests assert that the connection **does** close after ~10s of inactivity; if those fail with “connection never closed,” that points to a regression from the fix rather than the original defect.

### Test inadequacy

- **Unit (IdleTimeoutService):** We have “should NOT timeout after function result until next agent message” and “should track closure and idle timeout with a few functions in parallel.” These validate the **service** only. They do not validate that the **component** emits `FUNCTION_CALL_STARTED` / `FUNCTION_CALL_COMPLETED` / `AGENT_MESSAGE_RECEIVED` in the right order when driven by real or mock WebSocket messages.
- **Integration:** We have no test that mounts the component (or a thin wrapper), injects a `FunctionCallRequest`, simulates the app sending `FunctionCallResponse`, then waits ~9s with no further messages and asserts the connection is still open. That’s the exact scenario from the defect report; without it, we can’t claim the fix works end-to-end at the component level.
- **E2E:** The failing E2E tests are the first place we see the full stack (test-app + component + proxy). Triage is required to separate: (a) defect still present (connection closes too early), (b) regression (connection never closes), (c) outdated or flaky test expectations, (d) unrelated proxy/reconnection issues.

### Intended direction

1. **Add an integration test** that reproduces the voice-commerce scenario at the component level: connect, receive a function call, send function result, no further messages for &lt; idle_timeout, assert connection still open. That closes the gap between “IdleTimeoutService behaves correctly” and “component behaves correctly in the scenario that was reported.”
2. **Triage E2E failures** using the **existing** Playwright report: open `test-app/playwright-report/index.html` (or run `npx playwright show-report` from `test-app/` to open it). For each failure the report shows the assertion that failed and the received vs expected values. No need to re-run the suite to get details—use the report from the last run.
3. **Fix or adjust** product or tests based on triage, then re-run E2E to confirm.

---

## Failure List (by spec file)

### context-retention-agent-usage.spec.js (Issue #362)
| # | Test |
|---|------|
| 1 | Context Retention - Agent Usage › should retain context when disconnecting and reconnecting - agent uses context |
| 2 | Context Retention - Agent Usage › should verify context format in Settings message |

### deepgram-greeting-idle-timeout.spec.js (Issue #139)
| # | Test |
|---|------|
| 3 | Greeting Idle Timeout › should timeout after greeting completes (Issue #139) |
| 4 | Greeting Idle Timeout › should timeout after initial greeting on page load |

### deepgram-manual-vad-workflow.spec.js
| # | Test |
|---|------|
| 5 | Manual VAD Workflow Tests › should handle complete manual workflow: speak → silence → timeout |

### deepgram-text-session-flow.spec.js
| # | Test |
|---|------|
| 6 | Text Session Flow › should auto-connect and re-establish connection when WebSocket is closed |

### idle-timeout-behavior.spec.js
| # | Test |
|---|------|
| 7 | Idle Timeout Behavior › should handle microphone activation after idle timeout |
| 8 | Idle Timeout Behavior › should handle idle timeout correctly - connection closes after 10 seconds of inactivity |
| 9 | Idle Timeout Behavior › should start idle timeout countdown after agent finishes - reproduces voice-commerce issue |
| 10 | Idle Timeout Behavior › should restart timeout after USER_STOPPED_SPEAKING when agent is idle - reproduces Issue #262/#430 |

### issue-351-function-call-proxy-mode.spec.js
| # | Test |
|---|------|
| 11 | Issue #351: FunctionCallRequest Callback in Proxy Mode › should invoke onFunctionCallRequest callback in proxy mode |

### microphone-activation-after-idle-timeout.spec.js
| # | Test |
|---|------|
| 12 | Microphone Activation After Idle Timeout › should handle microphone activation after idle timeout |
| 13 | Microphone Activation After Idle Timeout › should show loading state during reconnection attempt |

### microphone-functionality-fixed.spec.js
| # | Test |
|---|------|
| 14 | Fixed Microphone Functionality Tests › should handle microphone activation after idle timeout (FIXED) |

### openai-proxy-e2e.spec.js (Issue #381)
| # | Test |
|---|------|
| 15 | OpenAI Proxy E2E › 4. Reconnection – disconnect then send, app reconnects and user receives response |
| 16 | OpenAI Proxy E2E › 7. Reconnection with context – disconnect, reconnect; proxy sends context via conversation.item.create |
| 17 | OpenAI Proxy E2E › 9. Repro – after disconnect and reconnect (same page), session retained; response must not be stale or greeting |

### suspended-audiocontext-idle-timeout.spec.js (Issue #139)
| # | Test |
|---|------|
| 18 | Suspended AudioContext Idle Timeout › should timeout even with suspended AudioContext |

### text-idle-timeout-suspended-audio.spec.js
| # | Test |
|---|------|
| 19 | Text Input Idle Timeout with Suspended AudioContext › should timeout after text interaction even with suspended AudioContext |

---

## Plan for addressing the 19 failures

| Priority | Category | Tests | Action |
|----------|----------|-------|--------|
| 1 | **(b) Idle timeout (12)** | 3, 4, 5?, 7, 8, 9, 10, 12, 13?, 14, 18, 19 | Fix the proxy we promote so it sends `AgentAudioDone` when the upstream response completes (Issue #482). Component transitions to idle only when playback stops or when it receives `AgentAudioDone`; without it, idle timeout never starts. |
| 2 | **(d) Reconnection/context (6)** | 1, 2, 6, 15, 16, 17 | Verify proxy reconnection and context retention; fix proxy or align test expectations (e.g. when connection reaches `'closed'` after disconnect). |
| 3 | **(c) Test/env (1)** | 11 | Verify `onFunctionCallRequest` in proxy mode; fix proxy or test (timeout/selector). |
| 4 | **Re-run and document** | All | Run `USE_PROXY_MODE=true npm run test:e2e` from `test-app/`; update this doc with resolved/remaining failures and notes. |

**Order of work:** Address (b) first so idle-timeout E2E can pass; then (d) and (c); then full re-run and doc update.

**Note (partial run after #482/#489 fix):** A partial E2E run still showed 6 failures (same tests as above). See [Latest E2E run (partial)](#latest-e2e-run-partial-after-issue-482489-fix) and [Why these 6 still appear unaddressed](#why-these-6-still-appear-unaddressed) for why greeting (3, 4), reconnection/closed (1, 2, 6), and manual VAD (5) are not yet fixed by the response-lifecycle AgentAudioDone change.

---

## Action plan and progress

### Step 1: Strengthen test pyramid (Issue #487 scenario at component level)

- [x] **Add integration test:** Component (or wrapper) receives `FunctionCallRequest`, app sends `FunctionCallResponse`, no further messages for &lt; idle_timeout → assert connection still open. This mirrors the voice-commerce scenario and validates the fix at the component layer, not just IdleTimeoutService.
- **Progress:** Implemented in `tests/integration/issue-487-idle-timeout-after-function-result-component.test.tsx`. Test passes: after injecting FunctionCallRequest and handler sending response, advancing time 9.5s does not call `close()` on the agent manager.

### Step 2: Triage E2E failures (use existing report)

- **Open the report:** From `test-app/` run `npx playwright show-report`, or open `test-app/playwright-report/index.html` in a browser. Failure details (assertion, received vs expected) are in the report; no need to re-run the suite.
- **Alternative:** Parse `test-app/test-results/results.json` for each spec’s `results[].error.message`. Triage table below was filled from that.
- [x] Classify each failure: (a) original defect still present, (b) regression from #487 fix, (c) test expectation or environment, (d) unrelated (reconnection, context).
- **Progress:** Completed; see table below with Classification column.

### Step 3: Fix or adjust

- [ ] For (a): Fix component/proxy wiring so idle timeout does not fire until next agent message after function result.
- [x] **For (b) TDD:** Regression test in `unified-timeout-coordination.test.js` (see above). **Fix required in our proxy:** The proxy (and translators) that this project promotes for other teams to use are our responsibility. That proxy must send `AgentAudioDone` when the upstream response completes (Issue #482) so the component can transition to idle and the idle timeout can start. Until we fix the proxy we promote, the (b) idle-timeout failures will persist.
- [ ] For (c): Update tests or stabilize env (timeouts, selectors, proxy).
- [ ] For (d): Address reconnection/context in separate follow-up if needed.

### Step 4: Re-run and document (after fixes)

- [x] **Partial re-run (after #482/#489 fix):** Run cut short; 6 failed, 5 interrupted, 64 passed. Same 6 tests as in triage (1–6 in table above). Documented in [Latest E2E run (partial)](#latest-e2e-run-partial-after-issue-482489-fix) and [Why these 6 still appear unaddressed](#why-these-6-still-appear-unaddressed).
- [ ] After addressing greeting path, reconnection/closed, and any test env: run full E2E again; update this doc with resolved/remaining failures and notes.

---

## Triage from Playwright report (results.json)

Failure details were taken from the **existing** run’s `test-app/test-results/results.json` (no re-run). **Classification:** (a) original defect still present, (b) regression from #487 fix, (c) test expectation or environment, (d) unrelated (reconnection, context).

| # | Spec / test | Error (summary) | Classification |
|---|-------------|------------------|-----------------|
| 1 | context-retention-agent-usage › should retain context when disconnecting and reconnecting - agent uses context | `waitForFunction` 30s exceeded (wait for status `'closed'` in disconnectComponent) | **(d)** Unrelated: reconnection/context; connection never reached `'closed'` after disconnect in proxy. |
| 2 | context-retention-agent-usage › should verify context format in Settings message | Same: `waitForFunction` 30s (wait for `'closed'`) | **(d)** Unrelated: reconnection/context. |
| 3 | deepgram-greeting-idle-timeout › should timeout after greeting completes (Issue #139) | `expect(received).toBe(expected)` — Expected true, Received false (timeoutResult.closed) | **(b)** Regression: connection did not close after greeting. |
| 4 | deepgram-greeting-idle-timeout › should timeout after initial greeting on page load | Same: timeoutResult.closed expected true, received false | **(b)** Regression: idle timeout not firing. |
| 5 | deepgram-manual-vad-workflow › should handle complete manual workflow: speak → silence → timeout | `waitForFunction` 10s exceeded (assertConnectionState) | **(b)** or **(c)**: expected state (e.g. `'closed'`) not reached; likely idle timeout not firing. |
| 6 | deepgram-text-session-flow › should auto-connect and re-establish connection when WebSocket is closed | `waitForFunction` 30s exceeded | **(d)** Unrelated: reconnection flow / state not met. |
| 7 | idle-timeout-behavior › should handle microphone activation after idle timeout | timeoutResult.closed / statusAfterTimeout expected true, received false | **(b)** Regression: connection never closed. |
| 8 | idle-timeout-behavior › should handle idle timeout correctly - connection closes after 10 seconds of inactivity | Same: timeoutResult.closed expected true, received false | **(b)** Regression: idle timeout not firing. |
| 9 | idle-timeout-behavior › should start idle timeout countdown after agent finishes - reproduces voice-commerce issue | `expect(actualTimeout).toBeLessThanOrEqual(15000)` — Received 30088 | **(b)** Regression: connection never closed within 15s; timeout did not fire. |
| 10 | idle-timeout-behavior › should restart timeout after USER_STOPPED_SPEAKING when agent is idle (Issue #262/#430) | timeoutResult.closed expected true, received false | **(b)** Regression: timeout not firing after user stopped speaking. |
| 11 | issue-351-function-call-proxy-mode › should invoke onFunctionCallRequest callback in proxy mode | `waitForFunction` 30s exceeded | **(c)** or **(d)**: callback/response condition not met in proxy; test or proxy behavior. |
| 12 | microphone-activation-after-idle-timeout › should handle microphone activation after idle timeout | timeoutResult.closed or status expected true, received false | **(b)** Regression: connection never closed before mic activation step. |
| 13 | microphone-activation-after-idle-timeout › should show loading state during reconnection attempt | expect(received).toBe(expected) — Expected true, Received false | **(b)** or **(c)**: assertion on loading/state; may depend on timeout closing first. |
| 14 | microphone-functionality-fixed › should handle microphone activation after idle timeout (FIXED) | timeoutResult.closed expected true, received false | **(b)** Regression: connection never closed. |
| 15 | openai-proxy-e2e › 4. Reconnection – disconnect then send, app reconnects and user receives response | `waitForFunction` 30s exceeded | **(d)** Unrelated: reconnection. |
| 16 | openai-proxy-e2e › 7. Reconnection with context | Same | **(d)** Unrelated: reconnection/context. |
| 17 | openai-proxy-e2e › 9. Repro – after disconnect and reconnect (same page), session retained | Same | **(d)** Unrelated: reconnection/session. |
| 18 | suspended-audiocontext-idle-timeout › should timeout even with suspended AudioContext | timeoutResult.closed expected true, received false | **(b)** Regression: idle timeout not firing with suspended AudioContext. |
| 19 | text-idle-timeout-suspended-audio › should timeout after text interaction even with suspended AudioContext | Same | **(b)** Regression: idle timeout not firing. |

**Summary**

- **(b) Regression (12 tests):** 3, 4, 5?, 7, 8, 9, 10, 12, 13?, 14, 18, 19. Connection does not close after ~10s of inactivity; `timeoutResult.closed` stays false or status never becomes `'closed'`. Root cause to investigate: in proxy mode, is “waiting for next agent message” set when it shouldn’t be (or never cleared), so idle timeout never starts or never fires in normal/greeting/VAD/text flows?
- **(d) Unrelated (6 tests):** 1, 2, 6, 15, 16, 17. Reconnection or context flow; connection never reaches `'closed'` where the test expects it (e.g. after disconnectComponent). Address in follow-up (proxy reconnection/context behavior or test expectations).
- **(c) Test/env (1 test):** 11. Function-call callback in proxy mode; condition not met in 30s. May need proxy or test adjustment.

---

## Resolution checklist (original)

- [ ] **Reproduce:** Run `USE_PROXY_MODE=true npm run test:e2e` from `test-app/` and capture latest HTML report (`npx playwright show-report`) if needed.
- [ ] **Triage:** For each failure, determine: environment (proxy vs Deepgram), timing/async, idle timeout behavior change (Issue #487), or test expectation outdated.
- [ ] **Idle-timeout-related (7–10, 12–14, 18–19):** Confirm whether Issue #487 (waiting for next agent message after function result) or default idle timeout (10s) affects these; update tests or product behavior as needed.
- [ ] **Reconnection/context (1–2, 6, 15–17):** Verify proxy reconnection and context retention; align tests with current reconnection behavior.
- [ ] **Greeting/VAD/text flow (3–5):** Verify greeting and manual VAD/text flows against current component and proxy behavior.
- [ ] **Function call proxy (11):** Verify onFunctionCallRequest in proxy mode; fix test or implementation.
- [ ] **Re-run:** After fixes, run full E2E suite again and update this doc (mark resolved, add notes).

---

## Regression and proxy testing

There is concern that **basic invariants for idle timeout behavior** have a serious regression that was not present in a recent prior release. The likely cause is a **flaw in our proxy implementation lacking sufficient testing**: the proxy (and its contract with the component) was not covered by tests that enforce “response complete → AgentAudioDone → idle → timeout can start” and “greeting complete → idle timeout can start.” Going forward we should add **proxy- and integration-level tests** that encode these invariants so regressions are caught before E2E.

---

## Proposed next steps

1. **Greeting path (tests 3, 4)**  
   Have the proxy send `AgentAudioDone` (or a synthetic “greeting complete” signal) after sending the greeting `ConversationText` to the client, so the component can transition to idle and the idle timeout can start. Implement in the backend that serves the test-app (e.g. Deepgram proxy or shared proxy in `packages/voice-agent-backend` if it serves greeting). Document in BACKEND-PROXY that greeting injection should be followed by AgentAudioDone (or equivalent) when the app relies on idle timeout after greeting.

2. **Reconnection / `disconnectComponent` (tests 1, 2, 6)**  
   The tests **explicitly disconnect** by clicking the Stop button, then wait for connection status to become `'closed'`. They do **not** rely on idle timeout to close first.  
   - **What the test does:**  
     - **context-retention (1):** Send first message → agent responds → **disconnectComponent(page)** → wait → reconnect by sending another message → assert context in Settings.  
     - **context-retention (2):** Same flow with OpenAI proxy; after reconnect, assert context format in Settings.  
     - **text-session-flow (6):** Establish connection → send first message → agent responds → **disconnectComponent(page)** (“Disconnect to simulate idle timeout”) → send second message to trigger auto-connect → assert response.  
   - **Helper** (`test-app/tests/e2e/helpers/test-helpers.js`): `disconnectComponent(page)` clicks `[data-testid="stop-button"]` if visible (1s), then waits for `[data-testid="connection-status"]` text to equal `'closed'` (helper uses 5s; test timeout may be 30s).  
   - **Failure:** After clicking Stop, status never becomes `'closed'` within the wait. So either (a) the stop button is not visible/clicked in proxy mode, or (b) the component does not update connection-status to `'closed'` when the agent WebSocket closes in proxy mode.  
   - **If the spec or test flow is unclear,** ask or surface the full test (e.g. `context-retention-agent-usage.spec.js` lines 85–104 and 349–366, `deepgram-text-session-flow.spec.js` lines 26–52). Then fix: ensure Stop actually closes the agent connection and the component reflects `'closed'`; verify reconnection and context flow.

3. **Manual VAD (test 5)**  
   Proceed as planned: investigate why UtteranceEnd is not detected (proxy VAD mapping / test audio); ensure agent response gets AgentAudioDone so idle timeout can start; confirm test timeout/polling.

4. **Full E2E re-run and release**  
   - **Prerequisite:** Unit and integration tests must be **fully passing** before running full E2E (e.g. `npm run lint` then `npm run test:mock` or `npm test` as per release checklist).  
   - After implementing greeting (and reconnection/VAD) fixes, run full `USE_PROXY_MODE=true npm run test:e2e` from `test-app/`.  
   - Update this doc: mark resolved tests, add any new failures to the triage table, and refresh “Proposed next steps” if needed.  
   - Per release checklist: E2E in proxy mode must pass before publishing.

---

## Notes

- **Run from:** `test-app/` with backend running if required (`npm run backend`).
- **Report (use existing run):** Open `test-app/playwright-report/index.html` in a browser, or from `test-app/` run `npx playwright show-report`. The report shows per-test failure details (assertion, received vs expected, stack). No need to re-run E2E only to get details.
- **Failure artifacts (traces/screenshots):** Off by default. To collect them for a run, set `PW_ARTIFACTS_ON_FAILURE=1` (e.g. `PW_ARTIFACTS_ON_FAILURE=1 npm run test:e2e` from `test-app/`).
- **Reference:** Release checklist in [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md); E2E in proxy mode is a pre-release requirement.
