# Direct-mode run results (Issue #346)

Run results and isolation notes for the four idle-timeout E2E specs in **direct mode** (Deepgram, no proxy). See [TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md](./TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md) for phases and requirements.

---

## Run result: proxy mode (2026-03-08)

A full run of the four specs with **proxy mode** (default `USE_PROXY_MODE=true`) from test-app completed successfully:

| Result | Detail |
|--------|--------|
| **Outcome** | **15 passed** (exit code 0) |
| **Duration** | ~3.9 minutes |
| **Specs** | `deepgram-greeting-idle-timeout.spec.js`, `idle-timeout-behavior.spec.js`, `idle-timeout-during-agent-speech.spec.js`, `text-idle-timeout-suspended-audio.spec.js` |

**Per-spec highlights:**

- **deepgram-greeting-idle-timeout:** Idle timeout after greeting (Issue #139) passed; connection closed within tolerance of `__idleTimeoutMs`; reconnect-after-timeout and second timeout after agent response passed.
- **idle-timeout-behavior:** Microphone activation after timeout, active conversation continuity, VAD/USER_STOPPED_SPEAKING restart, startAudioCapture() reset, and IdleTimeoutService behavior tests passed.
- **idle-timeout-during-agent-speech:** Connection remained active during 20s agent response; "BUG NOT REPRODUCED" (connection did not drop during agent speech).
- **text-idle-timeout-suspended-audio:** Idle timeout after text interaction and AudioContext resumption on focus passed.

---

## Run result: direct mode (2026-03-09)

Direct mode run completed: **11 passed, 4 failed** (6.4m), exit code 1. Logs show: `baseURL: ...?connectionMode=direct`, `proxy endpoints: none (direct mode)`, `E2E direct mode: USE_PROXY_MODE=false → connectionMode=direct`.

**4 failures (direct mode only):**

| # | Spec | Test | Exact error |
|---|------|------|-------------|
| 1 | idle-timeout-behavior.spec.js:276 | should not timeout during active conversation after UtteranceEnd | `expect(eventsDetected).toBeGreaterThan(0)` — Expected > 0, Received 0. Test waits for VAD events (`UserStartedSpeaking`, `UtteranceEnd`) via `waitForVADEvents`; in direct mode none were detected. |
| 2 | idle-timeout-behavior.spec.js:374 | should handle conversation with realistic timing and padding | Same: `expect(eventsDetected).toBeGreaterThan(0)` — Expected > 0, Received 0. `waitForVADEvents` returned 0. |
| 3 | idle-timeout-behavior.spec.js:981 | should restart timeout after USER_STOPPED_SPEAKING when agent is idle (Issue #262/#430) | Same: `expect(eventsDetected).toBeGreaterThan(0)` — Expected > 0, Received 0. `waitForVADEvents(page, ['UserStartedSpeaking'], 10000)` returned 0. |
| 4 | idle-timeout-during-agent-speech.spec.js:94 | @flaky should NOT timeout while agent is actively speaking | **TimeoutError:** `page.waitForFunction` 30000ms exceeded. Condition: `[data-testid="agent-response"]` text length > 100. |

**Why the exact errors weren’t in the doc before:** They were present in the terminal run log; the TDD update only referred to "see run log for stack" instead of copying them. They are now extracted and recorded above.

---

## Isolation — which idle-timeout tests pass vs fail (direct mode)

| Spec | Pass | Fail | What's different about the failures |
|------|------|------|-------------------------------------|
| deepgram-greeting-idle-timeout | 3/3 | 0 | — |
| idle-timeout-behavior | 5–6 of 9 (1 flaky) | 3 | The **3 that fail** are the only ones that send **audio** and then assert **VAD DOM** (`waitForVADEvents` → `expect(eventsDetected).toBeGreaterThan(0)`). The passing tests use text input, mic button, or timeout polling and do not depend on the app showing UserStartedSpeaking/UtteranceEnd. One other test ("agent state transitions to idle") is flaky in direct mode. |
| idle-timeout-during-agent-speech | 0 | 1 | Waits for agent response text length >100 within 30s; in direct mode that condition is never met (no or late response). |
| text-idle-timeout-suspended-audio | 2/2 | 0 | — |

**Conclusion:** In direct mode, **VAD-related UI is not updated** when the user speaks via audio (or not in time for the test). So the component or test-app does not expose/render the same VAD state in direct mode as in proxy mode. The single agent-speech failure is a separate issue (agent response never reaches >100 chars in 30s). Fix: ensure component exposes same VAD callbacks/state in direct mode and/or test-app renders them the same way (see TDD doc Requirement).

**Note (2026-03):** A direct-mode run via `USE_PROXY_MODE=false npx playwright test ...` failed with **Playwright browser executable not found** (`chromium_headless_shell` missing at `.playwright-browsers/...`), not due to network or app. Ensure browsers are installed: `npm run playwright:install-browsers`. Then run the direct-mode command from your machine.
