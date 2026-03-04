# Issue #489: E2E Failures to Resolve (Proxy Mode)

**Context:** Run `USE_PROXY_MODE=true npm run test:e2e` from `test-app/`. Summary: **19 failed**, 23 skipped, 203 passed (7.4m).

This document tracks the failing E2E tests and resolution steps for the v0.9.8 release (Issue #489).

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
- [x] **For (b) TDD:** Regression test added in `tests/integration/unified-timeout-coordination.test.js`: “should start and fire timeout when idle with no function call (no AGENT_MESSAGE_RECEIVED needed)”. IdleTimeoutService already allows timeout to start without AGENT_MESSAGE_RECEIVED when no function call occurred. E2E (b) failures are likely because in proxy mode the **component state** (agentState, isPlaying) never reaches idle/false, so the hook never emits the events that start the timeout. **Next:** Ensure proxy or component transitions to idle when response completes (e.g. playback end or AgentAudioDone fallback); or adjust E2E/test-app to match current behavior.
- [ ] For (c): Update tests or stabilize env (timeouts, selectors, proxy).
- [ ] For (d): Address reconnection/context in separate follow-up if needed.

### Step 4: Re-run and document (after fixes)

- [ ] After applying fixes, run full E2E again; update this doc with resolved/remaining failures and notes.

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

## Notes

- **Run from:** `test-app/` with backend running if required (`npm run backend`).
- **Report (use existing run):** Open `test-app/playwright-report/index.html` in a browser, or from `test-app/` run `npx playwright show-report`. The report shows per-test failure details (assertion, received vs expected, stack). No need to re-run E2E only to get details.
- **Reference:** Release checklist in [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md); E2E in proxy mode is a pre-release requirement.
