# Refactoring Plan: release/v0.9.8

**Branch:** `release/v0.9.8`  
**Scope:** DeepgramVoiceInteraction component and related E2E/context behavior after Issue #489 / #490 and test 9a resolution.

**Implementation status (TDD refactor):**

- **Phase 1:** Done — `getHistoryForSettings()` in `src/utils/getHistoryForSettings.ts`; unit tests in `tests/getHistoryForSettings.test.ts`. Component uses it via `useSettingsContext`.
- **Phase 2:** Done — `buildSettingsMessage()` in `src/utils/buildSettingsMessage.ts`; unit tests in `tests/buildSettingsMessage.test.ts`. Component calls it from `sendAgentSettings`.
- **Phase 3:** Done — single "latest history" ref: removed `latestConversationHistoryRef` and the ref sync at start of `sendAgentSettings`; hook now uses `conversationHistoryRef` (updated by effect + ConversationText handler) as `latestHistoryRef`. All 30 context/history tests pass.
- **Phase 4:** Done — `useSettingsContext` in `src/hooks/useSettingsContext.ts`; returns `getEffectiveContext` and `getContextForSend`; unit tests in `tests/useSettingsContext.test.tsx`. Component uses `getContextForSend()` in `sendAgentSettings`; `baseAgentOptions = getAgentOptions?.() ?? agentOptionsRef.current` so Settings are sent when getAgentOptions is not provided.
- **Phase 5:** Pending — document “context for Settings on reconnect” (e.g. in `docs/issues/ISSUE-490/REFACTOR-CONTEXT-OWNERSHIP.md` or component JSDoc).

E2E run post-refactor: 223 passed, 24 skipped. See `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md` (Latest E2E run post-refactor).

---

## 1. Current state (pre-refactor)

### 1.1 Component size and structure

- **File:** `src/components/DeepgramVoiceInteraction/index.tsx` (~3,909 lines).
- **Single file:** One large component with many refs, effects, and handlers; no internal modules or hooks for “context for Settings” or “connection lifecycle.”

### 1.2 Context and history for Settings (Issue #489 / #490)

- **Multiple sources of “history for Settings”:**
  - `conversationHistory` (state).
  - `conversationHistoryRef` (synced from state in `useEffect`).
  - `latestConversationHistoryRef` (updated every render + `useLayoutEffect`) so async connection handler sees latest.
  - Module-level `lastPersistedHistoryForReconnectRef` (updated in persist effect and in ConversationText handler).
  - Sync read from `localStorage` in `sendAgentSettings` (keys: `lastUsedStorageKeyRef`, `'dg_voice_conversation'`, `'dg_conversation'`).
- **Context resolution in `sendAgentSettings`:**
  - `sourceForHistory` = latest ref → lastPersisted → localStorage.
  - `getAgentOptions?.(() => sourceForHistory ?? [])` for app-supplied options.
  - `effectiveContext` = `fromHistory ?? fromApp ?? fromRestored` (plus fallback to `agentOptionsRef.current?.context`).
- **Result:** Reconnect path is robust but complex and hard to reason about; E2E 9a was stabilized by the test supplying `restoredAgentContext` before reconnect rather than by simplifying the component.

### 1.3 Other technical debt

- **Settings message construction:** Built inline in `sendAgentSettings` (audio config, agent config, OpenAI proxy vs Deepgram branching). Could be a pure function or small module.
- **Connection lifecycle:** `hasSentSettingsRef`, `globalSettingsSent`, connection-state handler, and “when to call sendAgentSettings” are spread across the file.
- **Idle timeout / greeting / text-only path:** ConversationText (assistant) + 200ms defer + AgentAudioDone handling is non-trivial and could be isolated for clarity and tests.

---

## 2. Goals and non-goals

### Goals

- **Single, clear source for “history used when sending Settings”** so reconnect behavior is easy to understand and test.
- **Reduce duplication** between refs and module-level state used only for reconnect context.
- **Preserve API compatibility** with Voice Agent API v1 and with existing props (`getAgentOptions`, `restoredAgentContext`, `conversationStorage`, etc.).
- **Keep E2E 9/9a and context-retention tests passing** (including the current 9a approach of setting `restoredAgentContext` before reconnect when needed).

### Non-goals (for this plan)

- Full split of the component into many small files (can be a later phase).
- Changing the public API beyond what Issue #490 already specifies (e.g. `onAgentOptionsUsedForSettings`, `restoredAgentContext`).
- Rewriting idle timeout or WebSocket logic; only isolate where it helps clarity.

**When to reconsider:**

- **Public API / context contract:** Prefer a **single source of truth** for context: the component builds `agent.context` only from (1) its own conversation history and (2) `restoredAgentContext` when provided. Treat `getAgentOptions` as supplying instructions, functions, and other options—not context. The app persists context when the component publishes it (`onAgentOptionsUsedForSettings`) and passes it back via `restoredAgentContext` on reload/reconnect. That pattern is easier to maintain and avoids send-time timing bugs; any move in that direction should remain backward compatible (e.g. still accept context from `getAgentOptions` when present, but document the preferred path).
- **Idle timeout / WebSocket rewrite:** Reconsider only if repeated bugs in the same area (e.g. greeting vs response completion) are hard to fix without a clearer state machine. Prefer isolating the logic into a hook or module first; full rewrite only if isolation proves insufficient.

---

## 3. Phased refactoring plan

### Phase 1: Consolidate “history for Settings” (low risk)

**Objective:** One clear pipeline for “what history do we use when building agent.context for Settings?”

1. **Introduce a small helper (e.g. `getHistoryForSettings`)** that encapsulates:
   - Inputs: latest in-memory history (ref), last-persisted (module-level ref), optional sync localStorage read (keys from one place).
   - Output: `ConversationMessage[]` (or undefined) and optionally which source was used (for logging/tests).
2. **Call that helper from `sendAgentSettings`** instead of inlining the ref → lastPersisted → localStorage loop. Keep `effectiveContext = fromHistory ?? fromApp ?? fromRestored` and the rest of the function unchanged.
3. **Optionally:** Reduce to a single module-level ref for “last persisted history” (drop `lastUsedStorageKeyRef` if the only consumer is this helper and keys can be passed in).
4. **Tests:** Unit test for `getHistoryForSettings` (in-memory → persisted → localStorage fallback). Re-run E2E 9a and context-retention.

**Exit criteria:** E2E 9/9a and relevant unit tests pass; `sendAgentSettings` is shorter and the “history for Settings” contract is documented in one place.

---

### Phase 2: Extract Settings payload construction (low risk)

**Objective:** Separate “what to send” from “when to send” and “send over WebSocket.”

1. **Extract `buildSettingsMessage(options, effectiveContext, config)`** (or similar) that:
   - Takes merged agent options (with `effectiveContext`), proxy vs Deepgram flag, and any config (e.g. `idleTimeoutMs`).
   - Returns the Settings message object (type, audio, agent, etc.) without side effects.
2. **Keep `sendAgentSettings`** as the orchestrator: resolve context (Phase 1), call `getAgentOptions`, compute `effectiveContext`, call `buildSettingsMessage`, then send and set refs/flags.
3. **Tests:** Unit tests for `buildSettingsMessage` (e.g. OpenAI proxy gets `idleTimeoutMs`, context shape is correct). No change to E2E behavior.

**Exit criteria:** Settings shape is unit-tested; `sendAgentSettings` is easier to read and modify.

---

### Phase 3: Simplify refs used only for reconnect (medium risk)

**Objective:** Fewer refs and less “double sync” (state → ref → module-level) without changing behavior.

1. **Document the invariant:** “On reconnect, we need history from at least one of: (a) current instance ref, (b) module-level last persisted, (c) localStorage, (d) restoredAgentContext.”
2. **Evaluate:** Can we rely on a single “latest history for reconnect” ref (e.g. always set from state in one place: e.g. persist effect + ConversationText), and remove `latestConversationHistoryRef` + the “invariant” sync at the start of `sendAgentSettings`? Only if tests and E2E stay green.
3. **If safe:** Remove redundant ref sync and keep one path that updates “last known history” (state → persist effect + ConversationText → module-level ref). Use that plus optional localStorage in `getHistoryForSettings`.
4. **Tests:** Re-run full E2E subset (9, 9a, context-retention, openai-proxy reconnection). Add or adjust unit test that simulates “reconnect with empty in-memory ref, module-level has history” and asserts context is sent.

**Exit criteria:** Fewer refs, same behavior; E2E and unit tests pass.

---

### Phase 4: Extract “context resolution” hook (required, medium effort)

**Objective:** Isolate “resolve effectiveContext for Settings” so the main component only calls a hook and uses the result.

1. **New hook (e.g. `useSettingsContext`):**
   - Inputs: `conversationHistory`, `getAgentOptions`, `restoredAgentContext`, `conversationStorage` / key, optional storage adapter for sync read.
   - Returns: e.g. `{ getEffectiveContext: () => AgentContext | undefined }` used only from `sendAgentSettings`.
2. **Hook internals:** Encapsulate `getHistoryForSettings` (Phase 1), `fromHistory` / `fromApp` / `fromRestored`, and any refs needed (e.g. restoredAgentContextRef). No change to when Settings are sent.
3. **Component:** `sendAgentSettings` calls `getEffectiveContext()`, then builds and sends Settings as today.
4. **Tests:** Move or duplicate context-resolution unit tests to the hook; keep E2E unchanged.

**Exit criteria:** Context resolution is testable in isolation; component file is shorter. API and behavior unchanged.

---

### Phase 5: Documentation and E2E alignment (low risk)

**Objective:** One place that describes “how context gets into Settings on reconnect.”

1. **Update or add:** A short “Context for Settings on reconnect” section in the component’s JSDoc or in `docs/issues/ISSUE-490/REFACTOR-CONTEXT-OWNERSHIP.md` that states:
   - Order of precedence: in-memory history → last persisted (module/storage) → getAgentOptions → restoredAgentContext.
   - Why E2E 9a sets `window.__e2eRestoredAgentContext` before reconnect (so the “restored” path is exercised when in-memory/persisted are empty or not yet synced).
2. **Optional:** Add a comment in the E2E 9a spec referencing this doc so future changes don’t remove the `restoredAgentContext` setup by mistake.

**Exit criteria:** New contributors can understand reconnect context without tracing the whole file.

---

## 4. Risk and dependencies

| Risk | Mitigation |
|------|------------|
| Regressions on reconnect or in proxy mode | Each phase ends with E2E 9/9a and context-retention (and, if available, openai-proxy reconnection) passing. |
| Multiple module instances (e.g. duplicate bundle) | Phase 3 only removes refs after confirming behavior with current bundling; document that module-level ref is process-wide. |
| Refactor scope creep | Stick to “context/history for Settings” and “Settings payload”; leave idle timeout and WebSocket lifecycle for a later plan. |

**Dependencies:**

- Phase 2 can run in parallel with Phase 1 or after it.
- Phase 3 should follow Phase 1 (and ideally Phase 2) so the “history for Settings” pipeline is already clear.
- Phase 4 is required; the hook is the intended home for context resolution after Phases 1–3.
- Phase 5 can be done after Phase 1 or in parallel with 2–4.

---

## 5. Suggested order of work

1. **Phase 1** — Consolidate history-for-Settings (helper + single call site).
2. **Phase 2** — Extract `buildSettingsMessage`.
3. **Phase 5** — Document “context on reconnect” (can start after Phase 1).
4. **Phase 3** — Simplify refs if metrics and tests support it.
5. **Phase 4** — Extract context-resolution hook (required).

---

## 6. References

- **Issue #489 (E2E / context on reconnect):** `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md`
- **Issue #490 (component-owned context):** `docs/issues/ISSUE-490/REFACTOR-CONTEXT-OWNERSHIP.md`
- **Voice Agent API:** https://developers.deepgram.com/docs/voice-agent and v1 migration guide
- **Test 9a (restoredAgentContext before reconnect):** `test-app/tests/e2e/openai-proxy-e2e.spec.js` — test “9a. Isolation – Settings on reconnect include context”
