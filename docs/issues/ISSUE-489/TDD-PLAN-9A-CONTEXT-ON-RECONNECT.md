# TDD Plan: 9a — Context on Reconnect (OpenAI Proxy)

**Scope:** This document is **only** for resolving the **9a bug**: Settings sent on reconnect (OpenAI proxy path) must include `agent.context`. When 9a is resolved, return to [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) for the rest of the 12-test plan.

**Goal:** The E2E test **9a** (“Settings on reconnect include context”) passes with the **OpenAI** proxy and real APIs. Same behavior as Deepgram: the hook alone is enough when we guarantee context loads from storage.

---

## TDD tracking (at a glance)

| Phase    | What | Status |
|----------|------|--------|
| **RED**  | 9a E2E fails with OpenAI (last Settings have no `agent.context`). Unit tests already encode “context from storage when refs empty” (first connection, after remount). | Done (established) |
| **GREEN**| Fix: In `sendAgentSettings()`, when refs are empty **or on reconnect**, sync-load from localStorage into `lastPersistedHistoryForReconnectRef` before `getContextForSend()`. Unit tests pass. 9a E2E still failing (see [§ E2E run result](#e2e-run-result)). | In progress |
| **REFACTOR** | Remove 9a diagnostics and TODOs from component (step 4). | Not started |

**Tests that define the behavior:**

- **E2E 9a** (`openai-proxy-e2e.spec.js`): After disconnect, send message to trigger reconnect → last Settings must include `agent.context`.
- **Unit** (`reconnect-settings-context-isolation.test.tsx`): “from localStorage when refs empty on first connection”; “from localStorage on new connection after remount”. Both rely on the guarantee that the component sync-loads from storage in `sendAgentSettings()` when refs are empty.

**9b note:** Test 9b asserted `getAgentOptions` must be called on reconnect. The chosen fix is “hook alone is enough” by guaranteeing load from storage in the component; we do **not** require `getAgentOptions` to be called. 9a is the acceptance test. 9b can be updated to assert “last Settings have context” (same outcome as 9a) or left as a diagnostic; it may still report `callCount === 0` after the fix.

---

## Steps (do in this order)

| # | Step | Red / Green / Refactor | Status | Notes |
|---|------|------------------------|--------|--------|
| **1** | Confirm 9a fails with OpenAI and capture diagnostics | RED | [x] Done | Run 9a E2E; `[ISSUE-489]` logs show second Settings without context. See [§ Repro](#repro). |
| **2** | Unit/integration test inventory green | — | [x] Done | `reconnect-settings-context-isolation.test.tsx`, `useSettingsContext.test.tsx`, etc. See [§ Test inventory](#test-inventory). |
| **3** | Implement fix: guarantee context from storage when refs empty or on reconnect | GREEN | [ ] In progress | In `sendAgentSettings()`, sync-load from storage when refs are empty **or** `isReconnectionRef.current`. Run 9a with OpenAI to confirm. See [§ Fix (Green)](#fix-green). E2E run: still red (see [§ E2E run result](#e2e-run-result)). |
| **4** | Remove 9a diagnostics and TODOs from component | REFACTOR | [ ] Remaining | After step 3 is stable green: remove `[ISSUE-489]` logs, `dgInstanceCounter`, `dgInstanceIdRef`, `TODO(ISSUE-489)`. See [§ Success criteria](#success-criteria). |

**Current focus:** Step 3 — 9a E2E still fails after sync-load fix. Next: run sync load **on reconnect** as well (not only when refs empty); re-run 9a. Then step 4.

---

## E2E run result (2025-03)

**Command (from test-app):** `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"`

**Outcome:** **Failed.** Last Settings still had no `agent.context`.

**Diagnostics from run:**

| Item | Value |
|------|--------|
| historyBeforeDisconnect | 3 |
| historyAfterDisconnect | 3 |
| __e2eRestoredAgentContext | has: true, messageCount: 3 |
| getAgentOptions callCount | 0 |
| __lastGetAgentOptionsDebug | fromComponent/fromRef/fromStorage/etc.: 0, source: "none" |
| WebSocket constructor count | 3 |
| Settings count | 2 (indices 0, 1) |
| last Settings has context | false |

**Interpretation:** The test page’s component reports 3 messages in `getConversationHistory()` after disconnect, but the **second** Settings (sent when the new WebSocket connects) had no context. So either (a) the instance that builds the second Settings has empty refs (sync load ran but didn’t see localStorage — e.g. different window/iframe), or (b) sync load was skipped because that instance’s refs were non-empty, yet `getContextForSend()` still returned empty (stale ref or different ref), or (c) the second Settings is built on a path that doesn’t call our `sendAgentSettings()`. **Next change:** Run sync load from storage **on every reconnect** (`isReconnectionRef.current`), not only when refs are empty, so we always refresh from storage before building Settings on reconnect.

---

## Success criteria (all must be met)

- [ ] 9a passes with `USE_REAL_APIS=1` and the **OpenAI** proxy (from test-app).
- [ ] No regression: 9a still passes with Deepgram.
- [ ] Jest tests in `useSettingsContext.test.tsx` and `reconnect-settings-context-isolation.test.tsx` still pass.
- [ ] Step 4 complete: diagnostics and TODOs related to 9a removed from the component.

---

## Fix (Green)

**Requirement:** The OpenAI path, like Deepgram, must make “the hook alone is enough” by guaranteeing that options/context load from storage when in-memory refs are empty.

**Implementation (component):** In `sendAgentSettings()` in `DeepgramVoiceInteraction/index.tsx`, **before** calling `getContextForSend()`:

1. If both refs are empty **or** we are on a reconnect (`isReconnectionRef.current`), synchronously read from localStorage (keys: `lastUsedStorageKeyRef.current`, `'dg_voice_conversation'`, `'dg_conversation'`), parse/validate, and set `lastPersistedHistoryForReconnectRef.current`.
2. Then call `getContextForSend()`. The hook’s `getHistoryForSettings()` sees the ref populated and returns that history.

No dependency on the app’s `getAgentOptions`. On reconnect we always refresh from storage so the instance that builds the second Settings has context even if its in-memory refs are stale or from a different scope.

**Verification:** Run from test-app: `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"` (with backend running). 9a must pass.

---

## Repro

**Test:** `openai-proxy-e2e.spec.js` — **9a. Isolation – Settings on reconnect include context**.

**Run (from test-app):**
```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"
```
Backend must be running (`npm run backend`).

**Observed (OpenAI, before fix):** Last Settings on second connection had no `agent.context`; diagnostics showed `fromComponent: 0`, `fromRef: 0`, `source: "none"`.

**Observed (Deepgram):** Same test passes; context present. Defect was isolated to the OpenAI path (reconnecting instance had empty refs; no sync load in the code path that built the second Settings).

---

## Defect isolation

| Backend   | Result (before fix) | Context on reconnect (last Settings) |
|-----------|----------------------|--------------------------------------|
| Deepgram  | Pass                 | Reconnecting instance had refs/storage; hook had data. |
| OpenAI    | Fail                 | Reconnecting instance had empty refs; no `getAgentOptions` call; no other source. |

**Session/context ownership:** The **app** owns session/context storage (e.g. localStorage). The component sends Settings with `agent.context` on (re)connection; the proxy **uses** that payload and does not retain context server-side. The fix ensures the component **always** has context from storage when refs are empty, so the hook alone is enough.

---

## What’s in place (component)

- **Connection-handler preload:** When WebSocket is OPEN, preload from localStorage into `lastPersistedHistoryForReconnectRef` before calling `sendAgentSettings()`.
- **Sync load in sendAgentSettings (fix):** At the start of `sendAgentSettings()`, when refs are empty **or** on reconnect (`isReconnectionRef.current`), sync-read from storage and set `lastPersistedHistoryForReconnectRef.current` before `getContextForSend()`. This guarantees the hook sees data when building Settings on reconnect.
- **Reconnection detection:** `hadAgentConnectionClosedRef` so we treat the next `connected` as reconnection when appropriate.
- **Jest:** `reconnect-settings-context-isolation.test.tsx` includes tests that depend on this guarantee (“from localStorage when refs empty on first connection”, “from localStorage on new connection after remount”).

---

## Test inventory

| Test file | What it covers |
|-----------|----------------|
| **reconnect-settings-context-isolation.test.tsx** | Settings with context on reconnect when agentOptions updated; from localStorage when refs empty (first connection and after remount); from window fallback / `__e2eRestoredAgentContext`. |
| **useSettingsContext.test.tsx** | `getContextForSend` from refs, from storage (getItem), from `window.__e2eRestoredAgentContext`. |
| **component-owned-context-490.test.tsx** | `restoredAgentContext` on reconnect when in-memory history is empty. |
| **openai-proxy-integration.test.ts** | Protocol: session.update, session.updated, context; Settings with context.messages to upstream. |

**E2E:** `openai-proxy-e2e.spec.js` — **9a** (Settings on reconnect include context); **9b** (diagnostic: getAgentOptions call count; with current fix, 9a is the acceptance test).

---

## Diagnostics (remove in step 4)

The component logs `[ISSUE-489]` at **info** in two places:

1. Connection handler (when calling `sendAgentSettings()`): `instanceId`, `preloadRefLength`.
2. Start of `sendAgentSettings()`: `instanceId`, `effectiveContextMessages`, `preloadRefLength`.

Also: `dgInstanceCounter`, `dgInstanceIdRef`, `TODO(ISSUE-489)` comments. Remove all after 9a is stable green.

---

## Next steps (proposed)

1. **Re-run 9a** after the “sync load on reconnect” change (run sync load when `isReconnectionRef.current` as well as when refs empty). If still red, capture component logs for the **second** connection (e.g. `[ISSUE-489] sendAgentSettings: instanceId=X effectiveContextMessages=Y preloadRefLength=Z`) to see whether sync load ran and what the hook returned.
2. **If 9a passes:** Mark step 3 [x], run 9a with Deepgram to confirm no regression, then do step 4 (refactor: remove diagnostics).
3. **If 9a still fails:** Consider (a) logging inside the sync-load block (whether we entered it, which key had data, ref length after load) to confirm storage is visible to the component instance; (b) verifying that the connection handler that runs for the second WebSocket is the same component instance as `deepgramRef.current` (e.g. same `instanceId` in logs for first and second Settings).

---

## After 9a is resolved

Return to **[TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md)**. Then:

- Re-run Phase 2+6 and 9a to confirm green.
- Proceed with Phase 1 (playback/TTS), Phase 3, Phase 4, Phase 5 as described there.
- Update [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) when applicable.

---

## References

- Component: `src/components/DeepgramVoiceInteraction/index.tsx` (sendAgentSettings, sync load, connection handler).
- Hook: `src/hooks/useSettingsContext.ts`.
- E2E 9a/9b: `test-app/tests/e2e/openai-proxy-e2e.spec.js`.
- Unit: `tests/reconnect-settings-context-isolation.test.tsx`.
- Main plan: [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md).
