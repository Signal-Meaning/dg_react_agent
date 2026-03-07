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

**Reset flags on reconnection:** In the 'connected' handler, when `isReconnection === true`, set `hasSentSettingsRef.current = false` and `windowWithGlobals.globalSettingsSent = false` so `sendAgentSettings()` does not skip for the new connection.

**Reconnect context fallback:** After `getContextForSend()`, if we're on reconnect (`isReconnectionRef.current`) and `effectiveContext` is empty but `lastPersistedHistoryForReconnectRef` has length (we just synced from storage), build `effectiveContext` from that ref and use it. This covers the case where the hook does not see the ref in the same tick.

**Manager-scoped tracking (avoid races):** We key "already sent" to the **manager instance**, not only to the flags. `lastManagerThatSentSettingsRef` holds the WebSocketManager that last sent Settings. In `sendAgentSettings()`, we skip only when the flags say sent **and** the current manager is that same instance (`currentManager === lastManagerThatSentSettingsRef.current`). So a new connection (new WebSocketManager) always sends, regardless of whether the previous connection's 'closed' has fired. We set the ref when we send; we clear it on 'closed', in stop(), and in effect cleanup. This prevents contention and avoids relying on event order.

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

1. **Schedule send from reconnection block (reliable second send):** Define `checkAndSend` when `event.state === 'connected'` at the start of state handling so both the stateChanged/reconnection block and the “Send settings message” block can use it. When `isReconnection` is true, after the reconnect preload, call `setTimeout(checkAndSend, 50)` from the reconnection block so the second connection’s send is scheduled even if the later “Send settings message” block is not reached or its timeout is not observed. This guarantees we attempt to send Settings on reconnect from the same code path that runs for the first connection.
2. **Log reconnect preload result:** After the reconnect preload in the stateChanged block, log `[ISSUE-489] reconnect preload: preloadRefLength=N` so we can confirm the ref is populated before any scheduled `checkAndSend` runs.
3. **Verify context source on second send:** When `sendAgentSettings` runs with `isReconnectionRef.current === true`, ensure `getContextForSend()` sees context: either from `lastPersistedHistoryForReconnectRef` (reconnect preload) or from the hook’s window fallbacks (`__e2eRestoredAgentContext` / `__appLastKnownConversation`). The hook already uses these; if the ref is still empty in E2E, consider whether `conversationStorage` / `getItem` in the hook use the same key as the test’s `setConversationInLocalStorage` (test uses `dg_voice_conversation`; component uses `getItemForSettings` → `localStorage.getItem` and keys include `dg_voice_conversation`).
4. **If 9a still fails:** Capture a trace or run with `--headed` and confirm in DevTools that the second `checkAndSend` runs and what `effectiveContextMessages` is in `sendAgentSettings` for the second connection. If context is still 0, add a one-off log in the hook’s `getContextForSend` (or in the component after `getContextForSend`) to see which branch (fromHistory / fromApp / fromRestored / window) is used.
5. **After 9a passes:** Mark step 3 [x], run 9a with Deepgram to confirm no regression, then do step 4 (refactor: remove all ISSUE-489 diagnostics and TODOs).


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
