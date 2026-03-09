# PR: Resolve issues #490, #379, #346, #333

**Branch:** `fix/issues-490-379-346-333`  
**Status:** In progress — #379, #490, #333 done; #346 proxy-mode E2E 15/15 pass; direct-mode failures documented and **deferred to #503** (backlog).

## Scope

| Issue | Title | Summary |
|-------|--------|--------|
| **#490** | Refactor: Component-owned agent context for Settings | Component owns and builds `agent.context` when sending Settings; app persists/restores only. Single source of truth, reconnect robustness. |
| **#379** | Component Team Test Suite Improvement Recommendations | Add Settings message structure verification, WebSocket capture, functions verification, improved diagnostics. |
| **#346** | Idle Timeout Test Failures (4 E2E tests) | **Proxy mode:** 15/15 pass. Direct-mode failures (4 tests) documented and **deferred to [#503](https://github.com/Signal-Meaning/dg_react_agent/issues/503)** (backlog). See [TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md](./TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md). |
| **#333** | Fix remount test: Settings not sent on new connection after remount | After remount with different `agentOptions`, new connection should send Settings with new options; currently test skipped, bug open. |

## TDD documents and ordering

Each issue has a dedicated TDD plan in this folder. **Suggested order** for implementation: **#379 → #490 → #333 → #346**. See [ORDERING.md](./ORDERING.md) for rationale and dependencies.

| Issue | TDD document |
|-------|----------------|
| #490 | [TDD-ISSUE-490-COMPONENT-OWNED-CONTEXT.md](./TDD-ISSUE-490-COMPONENT-OWNED-CONTEXT.md) |
| #379 | [TDD-ISSUE-379-TEST-SUITE-IMPROVEMENTS.md](./TDD-ISSUE-379-TEST-SUITE-IMPROVEMENTS.md) |
| #346 | [TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md](./TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md) |
| #333 | [TDD-ISSUE-333-REMOUNT-SETTINGS.md](./TDD-ISSUE-333-REMOUNT-SETTINGS.md) |


## References

- **#490** — Context ownership: `docs/issues/ISSUE-490/`, `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md`, `src/hooks/useSettingsContext.ts`
- **#379** — Settings verification, WebSocket capture, diagnostics: TDD doc and `test-app/tests/e2e/helpers/test-helpers.js`, `tests/utils/component-test-helpers.tsx`
- **#346** — Idle timeout E2E: `docs/issues/ISSUE-345/`, `test-app/tests/e2e/*idle*`, `test-app/tests/e2e/IDLE-TIMEOUT-TEST-ANALYSIS.md`; deferred to #503
- **#333** — Remount Settings: `tests/agent-options-remount-behavior.test.tsx`, `docs/issues/ISSUE-331-JEST-TEST-FIXES.md`

See [RECOMMENDED-IMPROVEMENTS.md](./RECOMMENDED-IMPROVEMENTS.md) for refactors and follow-ups.
