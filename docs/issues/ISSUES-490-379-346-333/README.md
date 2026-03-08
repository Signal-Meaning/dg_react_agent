# PR: Resolve issues #490, #379, #346, #333

**Branch:** `fix/issues-490-379-346-333`  
**Status:** Work in progress

## Scope

| Issue | Title | Summary |
|-------|--------|--------|
| **#490** | Refactor: Component-owned agent context for Settings | Component owns and builds `agent.context` when sending Settings; app persists/restores only. Single source of truth, reconnect robustness. |
| **#379** | Component Team Test Suite Improvement Recommendations | Add Settings message structure verification, WebSocket capture, functions verification, improved diagnostics. |
| **#346** | Idle Timeout Test Failures (4 E2E tests) | Fix 4 failing E2E tests in direct mode: greeting-idle-timeout, idle-timeout-behavior, idle-timeout-during-agent-speech, text-idle-timeout-suspended-audio. |
| **#333** | Fix remount test: Settings not sent on new connection after remount | After remount with different `agentOptions`, new connection should send Settings with new options; currently test skipped, bug open. |

## References

- #490: `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md`, `src/hooks/useSettingsContext.ts`
- #379: Voice-commerce recommendations (Settings verification, WebSocket capture, functions in Settings)
- #346: `docs/issues/ISSUE-345/`, `test-app/tests/e2e/*idle*`, `test-app/tests/e2e/*greeting*`
- #333: `tests/agent-options-remount-behavior.test.tsx` (skipped test), `docs/issues/ISSUE-331-JEST-TEST-FIXES.md`
