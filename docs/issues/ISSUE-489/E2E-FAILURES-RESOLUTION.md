# Issue #489: E2E Failures to Resolve (Proxy Mode)

**Context:** Run `USE_PROXY_MODE=true npm run test:e2e` from `test-app/`. Summary: **19 failed**, 23 skipped, 203 passed (7.4m).

This document tracks the failing E2E tests and resolution steps for the v0.9.8 release (Issue #489).

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

## Resolution checklist

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
- **Report:** `npx playwright show-report` (from `test-app/`) to inspect failure details.
- **Reference:** Release checklist in [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md); E2E in proxy mode is a pre-release requirement.
