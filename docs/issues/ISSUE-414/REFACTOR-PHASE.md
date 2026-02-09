# Issue #414: Refactor phase — branch review and work summary

**Branch:** `davidrmcgee/issue414`  
**Purpose:** Capture the scope of Issue 414 work, refactor-phase review (correctness, completeness, coverage, DRYness, clarity), and recommendations. Single place to see what was touched and how it fits the Voice Agent architecture.

---

## 1. Scope of work (what was touched)

### 1.1 Component and shared runtime

| Area | Path | Change |
|------|------|--------|
| **Shared constant** | `src/constants/voice-agent.ts` | New: `DEFAULT_IDLE_TIMEOUT_MS = 10000`. Single source for default idle timeout. |
| **Types** | `src/types/agent.ts` | `AgentOptions.idleTimeoutMs` optional; documented as shared with backends. |
| **Component** | `src/components/DeepgramVoiceInteraction/index.tsx` | `effectiveIdleTimeoutMs` from options or constant; sent in Settings as `agent.idleTimeoutMs`; passed to WebSocketManager and useIdleTimeoutManager; treats `idle_timeout` / `session_max_duration` as expected closure (no onError); unconditional log for assistant ConversationText. |
| **WebSocket manager** | `src/utils/websocket/WebSocketManager.ts` | Default `idleTimeout` from `DEFAULT_IDLE_TIMEOUT_MS`; resets and closure behavior unchanged. |
| **Idle timeout hook** | `src/hooks/useIdleTimeoutManager.ts` | Default `timeoutMs` from `DEFAULT_IDLE_TIMEOUT_MS`. |

### 1.2 OpenAI proxy (backend we control)

| Area | Path | Change |
|------|------|--------|
| **Translator** | `scripts/openai-proxy/translator.ts` | `ComponentSettings.agent.idleTimeoutMs`; `mapSettingsToSessionUpdate` uses only `settings.agent?.idleTimeoutMs ?? 10000` for `idle_timeout_ms` in session.update (no env var). |
| **Server** | `scripts/openai-proxy/server.ts` | Maps upstream idle-timeout error to component code `idle_timeout`; logs expected closure. |
| **Protocol doc** | `scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` | §3.9: idle timeout from Settings only; no env. |
| **README** | `scripts/openai-proxy/README.md` | Idle timeout described as from Settings. |

### 1.3 Deepgram proxy

- **Backend** (`test-app/scripts/backend-server.js`): Pass-through only; no idle-timeout logic. Forwards client Settings to Deepgram unchanged. No change required.

### 1.4 Tests

| Type | Path / scope | Relevance |
|------|----------------|-----------|
| **Integration** | `tests/integration/openai-proxy-integration.test.ts` | Session.update uses Settings.idleTimeoutMs; mock-only test for GA audio.input / turn_detection. |
| **Unit** | `tests/openai-proxy.test.ts`, `tests/unit/openai-proxy-first-binary-json-heuristic.test.js` | Proxy mapping and heuristics. |
| **Integration** | `tests/integration/openai-proxy-cli.test.ts` | CLI protocol. |
| **Component** | `tests/component-vad-callbacks.test.tsx` | VAD contract (any backend). |
| **E2E** | `test-app/tests/e2e/openai-proxy-e2e.spec.js`, helpers | Connection, greeting, multi-turn, basic audio, VAD (5b), repro 9/10; `assertNoRecoverableAgentErrors` (idle_timeout not an error). |

### 1.5 Docs (ISSUE-414)

- **Entry / index:** CURRENT-UNDERSTANDING.md, README.md, NEXT-STEPS.md.
- **Resolution / plan:** RESOLUTION-PLAN.md, PASSING-VS-FAILING-TESTS-THEORY.md, E2E-RELAXATIONS-EXPLAINED.md.
- **Protocol / contract:** COMPONENT-PROXY-INTERFACE-TDD.md; PROTOCOL-AND-MESSAGE-ORDERING.md (in scripts).
- **Investigations:** REGRESSION-SERVER-ERROR-INVESTIGATION.md, OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md, OPENAI-SESSION-STATE-AND-TESTS.md, others.

---

## 2. Correctness

- **Single idle timeout value:** Component and OpenAI proxy use the same value: component sends it in Settings; proxy uses it in session.update. No second source (e.g. env) for proxy.
- **Expected closure:** Codes `idle_timeout` and `session_max_duration` are treated as normal closure (no onError). Aligns Deepgram and OpenAI proxy behavior.
- **Buffer / VAD:** Server VAD disabled (`turn_detection: null`); proxy-only commit and response.create. Buffer-too-small and dual-control race resolved in our flow.
- **Types:** `AgentOptions.idleTimeoutMs` is documented and used. **Gap:** `AgentSettingsMessage.agent` does not declare `idleTimeoutMs` (component sends it at runtime). Recommendation: add to type for correctness (see §6).

---

## 3. Completeness

- **Done:** Shared constant; Settings carry idle timeout; proxy uses only Settings; expected closure handling; docs and protocol §3.9; integration and E2E coverage for the changed behavior.
- **Optional / future:** Configurable idle_timeout_ms beyond Settings (e.g. env override) is not required; doc consolidation (§8 in RESOLUTION-PLAN) is optional; adding `idleTimeoutMs` to `AgentSettingsMessage.agent` is a small type completeness fix.

---

## 4. Coverage (testing)

- **Unit:** Proxy mapping and binary heuristic; component VAD callbacks (backend-agnostic).
- **Integration:** OpenAI proxy integration (session.update from Settings, error mapping, protocol); CLI; firm audio / greeting with real API when keys available.
- **E2E:** OpenAI proxy specs (connection, greeting, single/multi-turn, basic audio, VAD 5b, repro 9/10); `assertNoRecoverableAgentErrors` ensures idle_timeout closure does not count as error.
- **Strategy:** Real-API first where possible; mocks for CI. See docs/development/TEST-STRATEGY.md and E2E-BACKEND-MATRIX.md.

---

## 5. DRYness and common APIs

### 5.1 Idle timeout

- **Single constant:** `DEFAULT_IDLE_TIMEOUT_MS` in `src/constants/voice-agent.ts`. Used by component, WebSocketManager, useIdleTimeoutManager.
- **Proxy fallback:** `scripts/openai-proxy/translator.ts` uses literal `10000` when `settings.agent?.idleTimeoutMs` is missing. Same value by design; proxy lives under `scripts/` and does not import from `src/`. **Options:** (a) Keep 10000 with comment "same as DEFAULT_IDLE_TIMEOUT_MS"; (b) add a small shared constants module consumable by both (e.g. script imports from src) if we want strict DRY.
- **Naming:** `AgentOptions.idleTimeoutMs` and Settings `agent.idleTimeoutMs` and proxy `idle_timeout_ms` are aligned by name and meaning across component and proxy.

### 5.2 Closure codes

- **Common handling:** Component treats `idle_timeout` and `session_max_duration` the same (expected closure). Single code path; no backend-specific branching for these codes.

### 5.3 APIs we control

- **Settings:** One message shape; component sends, Deepgram receives as-is, OpenAI proxy maps to session.update. Idle timeout is part of that contract.
- **Error/closure:** Proxy sends component-style Error with `code`; component interprets codes uniformly.

---

## 6. Clarity

- **Constant and types:** JSDoc on `DEFAULT_IDLE_TIMEOUT_MS`, `AgentOptions.idleTimeoutMs`, and WebSocketManager default explain shared use and proxy alignment.
- **Protocol:** PROTOCOL-AND-MESSAGE-ORDERING.md §3.9 is the source of truth for idle timeout on the wire and in session.update.
- **Doc index:** CURRENT-UNDERSTANDING.md and README.md point to resolution, next steps, and other ISSUE-414 docs. This file (REFACTOR-PHASE.md) summarizes refactor review and scope.

---

## 7. Architectural simplicity

- **One source for idle timeout in UI flow:** Component decides value (option or default) and sends it in Settings. Proxies that need it (OpenAI) read from Settings only. No proxy-only env or config file for idle timeout.
- **Same behavior for both backends:** Expected closure (idle_timeout / session_max_duration) is not an error for Deepgram or OpenAI proxy; one policy in the component.

---

## 8. Recommendations (refactor phase)

| # | Item | Priority | Notes |
|---|------|----------|--------|
| 1 | **Type completeness** | Recommended | Add `idleTimeoutMs?: number` to `AgentSettingsMessage.agent` in `src/types/agent.ts` so the wire shape matches what the component sends. |
| 2 | **Proxy fallback 10000** | Optional | Keep as-is with comment, or introduce shared constant import in proxy if we want strict DRY. |
| 3 | **Doc consolidation** | Optional | RESOLUTION-PLAN §8; merge or archive redundant ISSUE-414 docs as needed. |
| 4 | **Connection timeout** | Optional | `WebSocketManager` uses `connectionTimeout: 10000`; could move to `voice-agent.ts` as a named constant if we want all timeouts in one place. |

---

## 9. Summary

Issue 414 work keeps the Voice Agent **correct** (single idle timeout from Settings, expected closure not an error), **complete** for the stated goals (buffer-too-small fixed, idle-timeout closure handled, proxy uses Settings only), **covered** by unit, integration, and E2E tests, **DRY** for the component (one constant, one policy), and **clear** in types, protocol docs, and doc index. The only small gap is the missing `idleTimeoutMs` on `AgentSettingsMessage.agent`; adding it completes type fidelity for the Settings message.
