# Issue #439: TDD plan — OpenAI proxy: start() with no options should not request transcription

**Parent:** [GitHub Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439)  
**Status:** Implementation complete (Phases 1–4). All tests pass; regression suite (lazy-initialization, connection-mode, backend-proxy) green.

---

## Overview

This document is the **Test-Driven Development** plan for fixing the bug where, when using an OpenAI proxy (`proxyEndpoint` URL containing `/openai`), calling `ref.current.start()` with no arguments while passing `transcriptionOptions` and/or `endpointConfig` causes "Failed to create transcription manager" (surfaced as "Failed to start voice interaction").

**Root cause:** `createTranscriptionManager()` already returns `null` for OpenAI proxy (transcript/VAD come from the agent WebSocket). The `start()` method does not use that same inference when deriving `shouldStartTranscription` from props, so it sets `shouldStartTranscription = true`, calls `createTranscriptionManager()`, gets `null`, and throws.

**Contract choice (from issue):**

| Option | Contract | This plan |
|--------|----------|-----------|
| **Option A** | When `proxyEndpoint` indicates an OpenAI proxy (e.g. path contains `/openai`), the component **automatically** treats the session as agent-only and does not request/start transcription, regardless of `transcriptionOptions` / `endpointConfig`. | **Chosen** — component infers; no host workaround required. |
| **Option B** | Host must omit `transcriptionOptions` and `endpointConfig` for OpenAI and call `start({ agent: true, transcription: false })`; document this clearly so integrators avoid the failure. | Not used. |

**TDD rule:** Tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).

---

## Phase 1: RED — Tests for OpenAI proxy + start() with no options ✅ DONE

**Goal:** Define expected behavior with failing tests: with OpenAI proxy URL and transcription/endpoint props, `start()` with no arguments must succeed and start only the agent.

### 1.1 Unit test: start() with no options + OpenAI proxy + transcriptionOptions does not throw ✅

**Location:** `tests/lazy-initialization.test.js` (or new `tests/openai-proxy-start-contract.test.js`).

1. **Add a describe block** (e.g. `'OpenAI proxy start() contract (Issue #439)'`).
2. **Write failing test(s):**
   - Render `DeepgramVoiceInteraction` with:
     - `proxyEndpoint="wss://localhost:3001/api/openai/proxy"`
     - `agentOptions={ ... }`
     - `endpointConfig={{ agentUrl: 'wss://agent.deepgram.com/v1/agent/converse' }}`
     - `transcriptionOptions={{ model: 'nova-2' }}`
   - Call `ref.current.start()` with **no arguments**.
   - **Assert:** `start()` resolves (does not throw "Failed to create transcription manager").
   - **Assert:** Only the **agent** manager is created and connected (transcription manager is never created for OpenAI proxy).
3. Run tests → **RED** (current behavior: `start()` throws when transcription manager creation returns `null`).

### 1.2 Optional: test that explicit start({ transcription: true }) with OpenAI proxy still does not create transcription manager ✅

**Goal:** Contract is “OpenAI proxy = agent-only”; even if host passes `start({ agent: true, transcription: true })`, component should not create/use transcription manager.

1. **Test:** Same props (OpenAI proxy + transcriptionOptions). Call `ref.current.start({ agent: true, transcription: true })`.
2. **Assert:** Resolves without throw; only agent manager is created/connected (transcription manager not created).
3. Run tests → **RED** if current code tries to create transcription manager on explicit `transcription: true`.

**Deliverables:** Failing tests that define the desired contract for OpenAI proxy and `start()`.

---

## Phase 2: GREEN — Infer OpenAI proxy in start() and suppress transcription ✅ DONE

**Goal:** In `start()`, when `proxyEndpoint` indicates an OpenAI proxy, set `shouldStartTranscription = false` so the component never requests or creates a transcription manager for that session.

### 2.1 Implement isOpenAIProxy and override shouldStartTranscription ✅

**Location:** `src/components/DeepgramVoiceInteraction/index.tsx` (in `start()`, near where `shouldStartTranscription` / `shouldStartAgent` are derived, ~L2864–2880).

1. After computing `isTranscriptionConfigured` and `isAgentConfigured`, and after deriving `shouldStartTranscription` and `shouldStartAgent` from `options`/props, add:
   - `const isOpenAIProxy = config.connectionMode === 'proxy' && (config.proxyEndpoint ?? '').includes('/openai');`
   - If `isOpenAIProxy`, set `shouldStartTranscription = false` (so transcription is never requested for OpenAI proxy, regardless of props or explicit `options.transcription`).
2. Optionally log when transcription is skipped due to OpenAI proxy (e.g. reuse or mirror the log from `createTranscriptionManager()`).
3. Run tests from Phase 1 → **GREEN**.

### 2.2 No change to createTranscriptionManager()

`createTranscriptionManager()` already returns `null` for OpenAI proxy; no change required there. The fix is entirely in `start()` so we never call it for transcription when using OpenAI proxy.

**Deliverables:** `start()` no longer throws when OpenAI proxy + transcriptionOptions/endpointConfig and `start()` called with no options; tests pass.

---

## Phase 3: REFACTOR and documentation ✅ DONE

### 3.1 Code clarity ✅

- Ensure the same OpenAI proxy detection pattern is consistent: `(config.proxyEndpoint ?? '').includes('/openai')` (and `connectionMode === 'proxy'`) is already used in `createTranscriptionManager()` and elsewhere (~L3483). No new helper is strictly required; if a shared helper is introduced (e.g. `isOpenAIProxy(config)`), use it in both `start()` and `createTranscriptionManager()` for consistency.

### 3.2 Documentation ✅

1. **Migration guide (done):** When proxy URL path contains `/openai`, component is agent-only; transcript/VAD via agent; `start()` with no args succeeds. See `docs/BACKEND-PROXY/MIGRATION-GUIDE.md` section "OpenAI proxy (agent-only)".
2. **In-code comment (done):** In `start()` where `shouldStartTranscription` is forced to `false` for OpenAI proxy, add a one-line comment referencing Issue #439 and “agent-only; transcript/VAD via agent”.

**Deliverables:** Clear, consistent detection; docs updated; comment for future maintainers.

---

## Phase 4: Acceptance and regression ✅

1. **Minimal repro from issue:** Render with `proxyEndpoint="wss://localhost:3001/api/openai/proxy"`, `agentOptions`, `endpointConfig`, `transcriptionOptions`; call `ref.current.start()` with no arguments → must succeed, agent connects, no transcription manager created.
2. **Regression:** Existing tests that use non-OpenAI proxy (e.g. `proxyEndpoint: 'wss://api.example.com/deepgram-proxy'`) or direct mode with `transcriptionOptions` and `start()` with no options must still create and connect both managers (see e.g. `tests/lazy-initialization.test.js` — “should use props to determine services when start() called without flags”).
3. **Test-app:** Optional sanity check: test-app already uses `start({ agent: true, transcription: false })` when `(proxyEndpoint ?? '').includes('/openai')`; after the fix, calling `start()` with no arguments with the same props should also work without changing test-app.

**Deliverables:** Issue #439 minimal repro passes; existing lazy-initialization and start() tests still pass; document acceptance in the issue or close when done.

---

## Order and dependencies

- **Phase 1** first: write failing tests (RED).
- **Phase 2** next: implement override of `shouldStartTranscription` in `start()` for OpenAI proxy (GREEN).
- **Phase 3** after GREEN: refactor for consistency and add docs/comments.
- **Phase 4** after implementation: run full repro and regression suite.

---

## References

- **Component:** `src/components/DeepgramVoiceInteraction/index.tsx`
  - `createTranscriptionManager()` returns `null` for OpenAI proxy (~L618–628)
  - `start()` derives `shouldStartTranscription` (~L2864–2896)
  - Microphone path already skips transcription for OpenAI proxy (~L3482–3497)
- **Test-app:** `test-app/src/App.tsx` — uses `start({ agent: true, transcription: false })` when proxy URL contains `/openai`
- **Existing tests:** `tests/lazy-initialization.test.js` (start() and props-driven service selection), `tests/connection-mode-selection.test.tsx`, `tests/backend-proxy-mode.test.tsx` (proxy mode)
