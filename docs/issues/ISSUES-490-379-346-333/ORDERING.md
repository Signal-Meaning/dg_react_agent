# Suggested ordering for issues #490, #379, #346, #333

This document recommends an order in which to tackle the four issues in this PR so that dependencies and reuse are maximized and rework is minimized.

**Status (this PR):** #379, #490, #333 done. #346 direct-mode fix deferred to [#503](https://github.com/Signal-Meaning/dg_react_agent/issues/503) (backlog).

---

## Recommended order

| Order | Issue | TDD doc | Rationale |
|-------|--------|--------|-----------|
| **1** | **#379** – Test suite improvements | [TDD-ISSUE-379-TEST-SUITE-IMPROVEMENTS.md](./TDD-ISSUE-379-TEST-SUITE-IMPROVEMENTS.md) | Add **tooling first**: Settings structure verification, WebSocket capture consistency, functions-in-Settings assertions, and diagnostics. These improvements make it easier to verify #490 and #333 with strong assertions and to debug failures. |
| **2** | **#490** – Component-owned agent context | [TDD-ISSUE-490-COMPONENT-OWNED-CONTEXT.md](./TDD-ISSUE-490-COMPONENT-OWNED-CONTEXT.md) | **Core refactor**: Component builds and publishes `agent.context`; app persists/restores. Use the new verification and diagnostics from #379 to validate Settings shape and context on reconnect. Unblocks or simplifies #333 (remount sends correct options). |
| **3** | **#333** – Remount Settings not sent | [TDD-ISSUE-333-REMOUNT-SETTINGS.md](./TDD-ISSUE-333-REMOUNT-SETTINGS.md) | **Focused bug**: After remount with different `agentOptions`, new connection must send Settings with new options. May be partially addressed by #490 (e.g. ref/context lifecycle); if not, fix remount + first-connection path explicitly. Use #379 helpers to assert Settings content. |
| **4** | **#346** – Idle timeout E2E failures | [TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md](./TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md) | **Independent**: Four direct-mode E2E specs (greeting-idle-timeout, idle-timeout-behavior, idle-timeout-during-agent-speech, text-idle-timeout-suspended-audio). No dependency on #490/#333; can be done in parallel with 2–3 or after. Fix component idle timeout behavior and/or test setup so all four pass. |

---

## Dependency summary

- **#379** → used by **#490** and **#333** for assertions and diagnostics.
- **#490** → may reduce rework for **#333** (who builds context and when Settings are sent).
- **#333** → benefits from #379 (assert Settings with new options) and possibly #490 (first-send-after-mount behavior).
- **#346** → independent; can run in parallel or last.

---

## Alternative ordering

- If you prefer to **fix the remount bug first** (high visibility): do **#333** before or in parallel with **#490**, accepting that some remount behavior might be revisited when #490 lands. Still do **#379** first so you have good assertions for #333.
- If **idle timeout** is higher priority for a release: do **#346** in parallel with **#379** (different areas); then **#490** → **#333**.

---

## TDD documents

| Issue | Document |
|-------|----------|
| #490 | [TDD-ISSUE-490-COMPONENT-OWNED-CONTEXT.md](./TDD-ISSUE-490-COMPONENT-OWNED-CONTEXT.md) |
| #379 | [TDD-ISSUE-379-TEST-SUITE-IMPROVEMENTS.md](./TDD-ISSUE-379-TEST-SUITE-IMPROVEMENTS.md) |
| #346 | [TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md](./TDD-ISSUE-346-IDLE-TIMEOUT-E2E.md) |
| #333 | [TDD-ISSUE-333-REMOUNT-SETTINGS.md](./TDD-ISSUE-333-REMOUNT-SETTINGS.md) |
