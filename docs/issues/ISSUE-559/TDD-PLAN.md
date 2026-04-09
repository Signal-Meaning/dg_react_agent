# Issue #559 — TDD plan (idle timeout logging + 100 ms reset coalescing)

Follow **RED → GREEN → REFACTOR**. Tests define behavior; do not implement without failing tests first (see `.cursorrules`).

---

## 1. Scope clarification (before coding)

- **“Started idle timeout”** — Today emitted at **`info`** in `IdleTimeoutService.startTimeout()`. Issue: move to **`debug`** (or equivalent: only when service `debug` is on — confirm product choice; default should be **no** `info` spam).
- **“Idle timeout reached - closing agent connection”** — Emitted at **`info`** in `useIdleTimeoutManager`. GitHub issue example includes this line; decide in RED tests whether it also moves to **`debug`** for consistency with “default console quiet.” If tests expect it to stay **`info`** for supportability, document that deviation in the PR.
- **100 ms window** — Coalesce **repeated `resetTimeout` / `startTimeout` churn** so within 100 ms we do not repeatedly clear+set the timer and do not repeatedly emit the “started” log. After the window, behavior matches today (one timer, one log at **debug** when the countdown actually (re-)starts for “real”).

---

## 2. Unit tests (Jest) — recommended file

**Primary target:** `tests/IdleTimeoutService.issue-559-logging-debounce.test.ts` (new) or extend an existing `IdleTimeoutService*.test.ts` if it keeps the suite cohesive.

Use **fake timers** (`jest.useFakeTimers()`), inject a **mock logger** or `LogSink` if the codebase exposes one; if not, spy on `getLogger` / module logger per existing patterns in `tests/`.

### RED cases (examples)

1. **Log level — started message**  
   When the service starts the idle countdown under default logger options (no `debug`), assert **`info` is not called** with `Started idle timeout` and **`debug` is called** (or the message is suppressed at info — match final API).

2. **Log level — optional disconnect hook**  
   If moving `useIdleTimeoutManager` disconnect line to debug: add tests in `tests/hooks/` or integration test that asserts default level does not emit that string at `info`.

3. **Debounce — rapid resets**  
   Arrange: idle conditions allow timeout; call the code path that triggers **reset** N times within **&lt; 100 ms** (same activity type or mixed — define in test).  
   Assert: **`debug` “Started idle timeout”** (or timer arm) occurs **once** (or at most once per 100 ms window — specify exact rule in test name).

4. **Debounce — no stretch of real idle**  
   After coalesced resets, advance timers so that **no further resets** occur for **`timeoutMs`**. Assert: callback fires exactly once (same as today).

5. **Debounce — reset after window**  
   Reset at `t=0`, again at `t=150ms`. Assert: **two** distinct arm cycles (or two debug logs) as required by product rules.

6. **Regression — `__idleTimeoutStarted__`**  
   If E2E relies on window flags, assert they still flip when the countdown **actually** starts (may be once per debounced arm).

---

## 3. E2E (Playwright)

**File:** `test-app/tests/e2e/idle-timeout-behavior.spec.js`

The **Issue #222** test waits for a **console** event whose text includes **`Started idle timeout`**. After the implementation, that string will only appear if the app runs with **debug** logging.

**RED-consistent options (pick one in implementation):**

- **A (preferred):** Anchor on `window.__idleTimeoutStarted__` (already set in `IdleTimeoutService.startTimeout()`) or poll `page.evaluate` for that flag, instead of console text.
- **B:** Run the test page with **`VITE_` / env** forcing logger debug for idle tests only (only if the test-app already supports it cleanly).

Also grep E2E and docs for **`Started idle timeout`**, **`Idle timeout reached`**, **`closing agent connection`** and update assertions if levels change.

Run from **test-app**:

```bash
cd test-app && npm run test:e2e -- idle-timeout-behavior.spec.js
```

---

## 4. Commands (npm scripts)

From repo root:

```bash
npm test -- IdleTimeoutService
npm test -- useIdleTimeoutManager
```

Full suite when ready:

```bash
npm test
```

---

## 5. REFACTOR

- Keep debounce logic **localized** (private fields on `IdleTimeoutService` or a tiny helper) with clear names (`lastResetScheduleMs`, etc.).
- Avoid changing Voice Agent API–visible behavior; this is client-side idle UX/logging only.
- Do not add fallbacks that hide real errors (project proxy rules do not apply here, but keep logging honest).

---

## 6. PR / qualification

- Link **#559** in the PR.
- Note E2E change (console → flag or env) in the PR description so reviewers expect Playwright diffs.
