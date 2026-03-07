# TDD Plan: 9a — Context on Reconnect (OpenAI Proxy)

**Scope:** This document is **only** for resolving the **9a bug**: Settings sent on reconnect (OpenAI proxy path) must include `agent.context`. When 9a is resolved, return to [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) for the rest of the 12-test plan.

**Goal:** The E2E test **9a** (“Settings on reconnect include context”) passes with the **OpenAI** proxy and real APIs. Same behavior as Deepgram: the hook alone is enough when we guarantee context loads from storage.

---

## TDD tracking (at a glance)

| Phase    | What | Status |
|----------|------|--------|
| **RED**  | 9a E2E fails with OpenAI (last Settings have no `agent.context`). Unit tests already encode “context from storage when refs empty” (first connection, after remount). | Done (established) |
| **GREEN**| Fix: Reconnect preload + synchronous send when ref populated and ws OPEN; ref fallback and forced preload in `sendAgentSettings()`. Unit tests pass. **9a E2E passes** (see [§ E2E run result – 9a passed](#e2e-run-result--9a-passed)). | Done |
| **REFACTOR** | Remove 9a diagnostics and TODOs from component (step 4). | Done |

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
| **3** | Implement fix: guarantee context from storage when refs empty or on reconnect | GREEN | [x] Done | Reconnect preload + sync send when ref populated and ws OPEN; ref fallback and forced preload in `sendAgentSettings()`. 9a E2E passes. See [§ Fix (Green)](#fix-green) and [§ E2E run result – 9a passed](#e2e-run-result--9a-passed). |
| **4** | Remove 9a diagnostics and TODOs from component | REFACTOR | [x] Done | Removed `[ISSUE-489]` logs, `dgInstanceCounter`, `dgInstanceIdRef`, `TODO(ISSUE-489)`; fixed unused vars. |

**Current focus:** 9a complete. Step 4 refactor done. Return to [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) for the rest of the 12-test plan.

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

**Interpretation:** The test page’s component reports 3 messages in `getConversationHistory()` after disconnect, but the **second** Settings (sent when the new WebSocket connects) had no context. So either (a) the instance that builds the second Settings has empty refs (sync load ran but didn’t see localStorage — e.g. different window/iframe), or (b) sync load was skipped because that instance’s refs were non-empty, yet `getContextForSend()` still returned empty (stale ref or different ref), or (c) the second Settings is built on a path that doesn’t call our `sendAgentSettings()`. **Change applied:** Run sync load from storage **on every reconnect** (`isReconnectionRef.current`), not only when refs are empty.

**Re-run after sync-on-reconnect change:** 9a **still failed** (same diagnostics: last Settings has context false, getAgentOptions callCount 0). Component now logs `[ISSUE-489] sendAgentSettings pre:` (hasInMemory, isReconnection, shouldLoadFromStorage, convRefLen, preloadRefLenBefore) and `sendAgentSettings syncLoad:` (loadedFromKey, preloadRefLenAfter). **Next:** Run 9a again and capture these logs for the **second** connection. Component logs appear in the **browser** console; run with `--headed` and open devtools, or add a `page.on('console', ...)` in the test to forward messages containing `[ISSUE-489]`.

**9a run with page console forward:** Only **one** set of `[ISSUE-489]` logs appeared (first connection only):

- `Connection handler sending Settings: instanceId=1 preloadRefLength=0`
- `sendAgentSettings pre: instanceId=1 hasInMemory=false isReconnection=false shouldLoadFromStorage=true convRefLen=0 preloadRefLenBefore=0`
- `sendAgentSettings syncLoad: loadedFromKey=none preloadRefLenAfter=0`
- `sendAgentSettings: instanceId=1 effectiveContextMessages=0 preloadRefLength=0`

There were **no** `[ISSUE-489]` logs for the second connection, even though the test reports 2 Settings (indices 0, 1) and 3 WebSocket constructor calls. So the **second** Settings message is **not** being sent by the same code path that runs `sendAgentSettings()` (connection handler → sendAgentSettings). Either (a) a **different component instance** sends the second Settings (e.g. remount with instanceId=2; that instance’s console might not be the one we’re forwarding), or (b) the second Settings is sent by **another code path** that builds and sends Settings without going through the connection handler. **Implication:** Fix must ensure the code path that actually sends the second Settings either runs our sync-load + getContextForSend logic, or we need to find and fix the path that sends the second Settings so it includes context.

**9a run with 'connected' diagnostic:** Two `Agent 'connected' event received: instanceId=1` — handler runs for both connections. For the second connection we see no "Connection handler sending Settings" or sendAgentSettings logs. **Likely cause:** On reconnection, `hasSentSettingsRef` / `globalSettingsSent` are still true (first connection's 'closed' can fire after the second opens), so when `checkAndSend` eventually calls `sendAgentSettings()` we skip. **Fix applied:** In the 'connected' handler, when `isReconnection` is true, reset `hasSentSettingsRef.current` and `windowWithGlobals.globalSettingsSent` to `false` so the new connection is allowed to send Settings. Then the existing sync-load in `sendAgentSettings()` (when `isReconnectionRef.current`) populates context from storage. Also added info-level logs: `checkAndSend` (wsState, hasManager), `sendAgentSettings skipped (already sent)`. Re-run 9a to confirm green.

**Latest run (2026-03-07) — 9a still failing after reconnect fallback:** Re-run with reconnect context fallback in place. Playwright report details:

| Item | Value |
|------|--------|
| **Test** | 9a. Isolation – Settings on reconnect include context |
| **Status** | failed |
| **Duration** | 33.47 s |
| **Assertion** | `expect(hasContext).toBe(true)` at openai-proxy-e2e.spec.js:551 |
| **Error** | Last Settings has no `agent.context`; `historyBeforeDisconnect=3`; `historyAfterDisconnect=3`; `__lastGetAgentOptionsDebug`: all 0, source `"none"`; Settings count=2; last has context: false |

**Console output (order preserved):** First connection only: `Agent 'connected'` → `checkAndSend` → `Connection handler sending Settings` → `sendAgentSettings pre` (isReconnection=false, preloadRefLenBefore=0) → `sendAgentSettings syncLoad` (loadedFromKey=none, preloadRefLenAfter=0) → `sendAgentSettings` (effectiveContextMessages=0). Then test logs history before/after disconnect (3/3), `__e2eRestoredAgentContext` has 3 messages. Then second connection: **only** `Agent 'connected' event received: instanceId=1` — **no** second `checkAndSend`, **no** second `Connection handler sending Settings`, **no** second `sendAgentSettings` logs. Then getAgentOptions callCount=0, WebSocket sent types show two Settings at indices 0 and 1, last has context: false.

**Playwright error-context (page snapshot):** At failure, UI shows session active, Conversation History with 3 items (assistant + 2 user messages), text input with "What famous people lived there?", Settings Applied: false, proxy mode, agentState idle. Full snapshot in `test-app/test-results/openai-proxy-e2e-OpenAI-Pr-50f9d-site-for-session-retention--chromium/error-context.md`.

**Interpretation:** The second `Settings` message is sent (2 Settings in captured sent list), but our connection-handler path does not log for the second connection: no second `checkAndSend` and no second `sendAgentSettings`. So either (1) the second connection skips the “send Settings” branch (e.g. `hasSentSettingsRef` / `globalSettingsSent` still true because `'closed'` hasn’t run yet) and we should see `[ISSUE-489] Settings skipped (flags)` — if that log is missing, console forwarding may be missing it or the skip branch isn’t hit; (2) we do schedule a second `checkAndSend` but when it runs `agentManagerRef.current` is the old (closed) manager so `wsState !== OPEN` and we only log at `config.debug` (no info-level log); or (3) the second `Settings` is sent by a different code path (e.g. test app or another component), not by our connection handler. **Root cause to confirm:** Whether the second connection takes the “skip” branch (flags) or the “schedule checkAndSend” branch, and if the latter, whether the second `checkAndSend` runs and what `wsState` it sees.

**Latest run (2026-03-07, post–core-path fix):** Same failure. Console shows:

- **First connection:** `Agent 'connected'` → `connected state: hasSentSettingsRef=false … isReconnection=false` → `checkAndSend` → `Connection handler sending Settings` → `sendAgentSettings pre/syncLoad/sendAgentSettings` (effectiveContextMessages=0).
- **After disconnect:** history before/after = 3, `__e2eRestoredAgentContext` has 3 messages.
- **Second connection:** `Agent 'connected' event received` → `connected state: hasSentSettingsRef=false globalSettingsSent=false hadAgentConnectionClosedRef=true isReconnection=true` — then **no** second `checkAndSend`, **no** second `Connection handler sending Settings`, **no** second `sendAgentSettings` logs.
- **Result:** WebSocket sent types include 2 Settings (indices 0, 1), **last has context: false**.

**Revised interpretation:** Flags are correct on second `connected` (refs reset, `isReconnection=true`), so the “schedule checkAndSend” branch should be taken. The second Settings is present in the captured sent list, so *some* path is sending it. The only caller of `sendAgentSettings()` is the connection handler’s `checkAndSend` when `wsState === 1`. So either: (A) the second `checkAndSend` runs but its logs are not forwarded (e.g. timing or execution context), and it sends Settings with **empty** context (preload/ref or hook not seeing storage/window); or (B) another code path sends a second Settings (no other path found in component). **Conclusion:** Assume (A): second Settings is sent by our path but with empty context. So the fix must ensure (1) we reliably schedule send on reconnect (e.g. schedule from the reconnection block as well), and (2) when we send on reconnect, context is non-empty (reconnect preload into ref, and/or hook’s `getContextForSend` seeing `lastPersistedHistoryRef` or window fallbacks).

**Safeguards added (post–reconnect preload):**
- **Ref fallback broadened:** In `sendAgentSettings()`, use `lastPersistedHistoryForReconnectRef` whenever `effectiveContext` is empty and the ref has messages (no longer require `isReconnectionRef.current`). Any code path that would send Settings with empty context now attaches context from the ref when available.
- **Forced sync preload before getContextForSend:** When `isReconnectionRef.current` is true, sync-read from `localStorage` (keys: `lastUsedStorageKeyRef`, `dg_voice_conversation`, `dg_conversation`) into `lastPersistedHistoryForReconnectRef` immediately before calling `getContextForSend()`, so the hook or the ref fallback sees context in the same tick.
- **Synchronous send on reconnect:** When `isReconnection` is true and the reconnect preload populated the ref (`preloadRefLength > 0`) and the new manager’s WebSocket is already OPEN (`getReadyState() === 1`), call `sendAgentSettings()` **synchronously** from the reconnection block instead of only scheduling `setTimeout(checkAndSend, 50)`. The second Settings is then sent in the same tick as the `'connected'` event using the ref we just set, avoiding timeout/closure issues that prevented the deferred send from logging or seeing context in E2E.

---

## E2E run result – 9a passed (2026-03-07)

**Command (from test-app):** `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"`

**Outcome:** **Passed.** Last Settings has `agent.context`; test passed in 34.4s.

**Console output (order preserved):**
- First connection: `Agent 'connected'` → `checkAndSend` → `Connection handler sending Settings` → `sendAgentSettings` (effectiveContextMessages=0).
- After disconnect: history before/after = 3, `__e2eRestoredAgentContext` has 3 messages.
- Second connection: `Agent 'connected'` → `connected state: … isReconnection=true` → `reconnect preload: preloadRefLength=3` → **`reconnect sync send: preloadRefLength=3 wsOPEN=true`** → `sendAgentSettings pre` (hasInMemory=true, convRefLen=3, preloadRefLenBefore=3) → `sendAgentSettings syncLoad: loadedFromKey=dg_voice_conversation` → `sendAgentSettings: effectiveContextMessages=3 preloadRefLength=3` → `Settings skipped (flags)` (later block correctly skips).

**Result:** Settings at indices 0, 1, 8, 9; **last has context: true**. getAgentOptions debug: contextMsgCount=3, source=component.

**Deepgram run (2026-03-07):** 9a also passes with Deepgram proxy. Command: `E2E_BACKEND=deepgram USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"`. Proxy endpoints used: `ws://localhost:8080/deepgram-proxy` (Deepgram), `ws://localhost:8080/openai` (OpenAI). Console showed first connection (preloadRefLength=0, effectiveContextMessages=0), then after disconnect/reconnect second connection (preloadRefLength=4, effectiveContextMessages=4). WebSocket sent types included Settings at indices 0, 1, 6, 7; **last has context: true**; 1 passed (4.8s). No regression.

---

## Success criteria (all must be met)

- [x] 9a passes with `USE_REAL_APIS=1` and the **OpenAI** proxy (from test-app).
- [x] No regression: 9a passes with Deepgram (`E2E_BACKEND=deepgram USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"`).
- [x] Jest tests in `useSettingsContext.test.tsx` and `reconnect-settings-context-isolation.test.tsx` still pass.
- [x] Step 4 complete: diagnostics and TODOs related to 9a removed from the component.

---

## Fix (Green)

**Requirement:** The OpenAI path, like Deepgram, must make “the hook alone is enough” by guaranteeing that options/context load from storage when in-memory refs are empty.

**Implementation (component):** In `sendAgentSettings()` in `DeepgramVoiceInteraction/index.tsx`, **before** calling `getContextForSend()`:

1. If both refs are empty **or** we are on a reconnect (`isReconnectionRef.current`), synchronously read from localStorage (keys: `lastUsedStorageKeyRef.current`, `'dg_voice_conversation'`, `'dg_conversation'`), parse/validate, and set `lastPersistedHistoryForReconnectRef.current`.
2. Then call `getContextForSend()`. The hook’s `getHistoryForSettings()` sees the ref populated and returns that history.

No dependency on the app’s `getAgentOptions`. On reconnect we always refresh from storage so the instance that builds the second Settings has context even if its in-memory refs are stale or from a different scope.

**Reset flags on reconnection:** In the 'connected' handler, when `isReconnection === true`, set `hasSentSettingsRef.current = false` and `windowWithGlobals.globalSettingsSent = false` so `sendAgentSettings()` does not skip for the new connection.

**Reconnect context fallback:** After `getContextForSend()`, if we're on reconnect (`isReconnectionRef.current`) and `effectiveContext` is empty but `lastPersistedHistoryForReconnectRef` has length (we just synced from storage), build `effectiveContext` from that ref and use it. This covers the case where the hook does not see the ref in the same tick.

**Manager-scoped tracking (avoid races):** We key "already sent" to the **manager instance**, not only to the flags. `lastManagerThatSentSettingsRef` holds the WebSocketManager that last sent Settings. In `sendAgentSettings()`, we skip only when the flags say sent **and** the current manager is that same instance (`currentManager === lastManagerThatSentSettingsRef.current`). So a new connection (new WebSocketManager) always sends, regardless of whether the previous connection's 'closed' has fired. We set the ref when we send; we clear it on 'closed', in stop(), and in effect cleanup. This prevents contention and avoids relying on event order.

**Synchronous send on reconnect (fix that made 9a pass):** In the reconnection block, after preloading from localStorage into `lastPersistedHistoryForReconnectRef`, if `preloadLen > 0` and `agentManagerRef.current?.getReadyState() === 1` (WebSocket already OPEN), call `sendAgentSettings()` immediately instead of only scheduling `setTimeout(checkAndSend, 50)`. The second Settings is then sent in the same tick with the ref we just populated, so it includes context. If the socket is not OPEN yet or preload is empty, keep the deferred `setTimeout(checkAndSend, 50)`.

**Verification:** Run from test-app: `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js -g "9a"` (with backend running). 9a passes (confirmed 2026-03-07).

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

The component logs `[ISSUE-489]` at **info** in these places:

1. **On every 'connected' event:** `Agent 'connected' event received: instanceId=X` — confirms whether the handler runs for the first and second connection.
2. When Settings are **skipped:** `Settings skipped (state.hasSentSettings): instanceId=X` or `Settings skipped (flags): instanceId=X hasSentSettingsRef=... globalSettingsSent=...`.
3. Connection handler (when calling `sendAgentSettings()`): `instanceId`, `preloadRefLength`.
4. Start of `sendAgentSettings()` (pre): `instanceId`, `hasInMemory`, `isReconnection`, `shouldLoadFromStorage`, `convRefLen`, `preloadRefLenBefore`.
5. After sync-load block: `loadedFromKey` (or `none`), `preloadRefLenAfter`.
6. After `getContextForSend()`: `instanceId`, `effectiveContextMessages`, `preloadRefLength`.

Also: `dgInstanceCounter`, `dgInstanceIdRef`, `TODO(ISSUE-489)` comments. Remove all after 9a is stable green.

---

## Next steps (proposed)

1. **Step 4 (refactor):** Remove all `[ISSUE-489]` logs, `dgInstanceCounter`, `dgInstanceIdRef`, and `TODO(ISSUE-489)` comments from the component. See § Diagnostics (remove in step 4).
2. **Before release:** Run 9a with Deepgram to confirm no regression (with Deepgram proxy/backend as applicable).
3. **Return to main plan:** Return to [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) for the rest of the 12-test plan.


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
