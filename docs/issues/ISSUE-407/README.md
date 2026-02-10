# Issue #407: Refactor – Move function call execution to backend (not frontend)

**Branch:** `davidrmcgee/issue407`  
**GitHub:** [#407](https://github.com/Signal-Meaning/dg_react_agent/issues/407)

---

## Summary

Refactor the test-app and recommended integration pattern so that **function calls are executed on the backend** (e.g. proxy or app server), not in the browser/frontend.

## Background

In both the Deepgram and OpenAI Voice Agent APIs, **"client-side" means your side of the WebSocket (your infrastructure), not "browser."**

- **Deepgram:** [Function Call Request](https://developers.deepgram.com/docs/voice-agent-function-call-request) — `client_side: true` means "the client must handle the function." The "client" is the WebSocket client (could be browser or your backend). Which functions are client-side is defined by the agent config (a different story from OpenAI).
- **OpenAI:** The Realtime API has no `client_side`; our proxy injects `client_side: true` when mapping to the component protocol. That means **all functions are `client_side`** from the component’s perspective; execution location is an integration choice (backend recommended).

Currently the test-app runs function handlers in the frontend (`onFunctionCallRequest` / `window.handleFunctionCall` in the browser). For production (security, secrets, data access), functions should typically run on the backend.

## Scope

- **Test-app:** Move function execution from frontend to backend (app server). Frontend receives `FunctionCallRequest`, forwards to app backend; backend executes and returns result; frontend sends `FunctionCallResponse`. Proxies are not involved in function execution.
- **Docs / recommendations:** Update CONVERSATION-STORAGE, BACKEND-PROXY, and any integration docs to recommend backend execution for function calls and document the pattern (frontend → app backend → execute → frontend sends `FunctionCallResponse`).
- **E2E / tests:** Adjust or add tests so that function-call E2E validates backend execution where applicable (or document that test-app may keep a minimal frontend handler for demo only).
- **Optional:** Example shows how the frontend routes `FunctionCallRequest` to an app backend and sends `FunctionCallResponse`.

---

## Acceptance criteria

- [ ] Test-app no longer executes function logic in the browser by default; execution happens on app backend (proxies not involved).
- [ ] Documentation clearly recommends backend execution for function calls and explains API semantics (client = your infrastructure, not necessarily browser).
- [ ] Existing E2E for function calling still pass (or are updated to reflect backend execution).
- [ ] Optional: Example shows how the frontend routes `FunctionCallRequest` to an app backend and returns `FunctionCallResponse`.

---

## Plan (resolution steps)

### TDD (mandatory)

**This project uses Test-Driven Development.** For Phase 1.2 and Phase 1 step 3 we follow:

1. **🔴 RED:** Write failing tests first that define the desired behavior.
2. **🟢 GREEN:** Implement minimal code to make tests pass.
3. **♻️ REFACTOR:** Improve code while keeping tests green.

No implementation for the backend endpoint or frontend forwarding without tests first.

### Phase 1: Backend function execution (app backend only; proxies not involved)

**Phase 1.1 — Define backend contract** ✅

1. **Define backend contract for function execution**
   - Document an HTTP endpoint that accepts a function-call payload (id, name, arguments) and returns the result content (or error). See **[BACKEND-FUNCTION-CALL-CONTRACT.md](./BACKEND-FUNCTION-CALL-CONTRACT.md)** (Phase 1.1 deliverable).
   - **Proxies are not involved with function execution.** The app backend owns execution; document that pattern.

**Phase 1.2 — Implement backend handler and common handlers (TDD)**

2. **Implement backend handler (app backend, common/DRY)**  
   Phase 1.2 and the **common backend handlers** are described here. **Tests first:** add integration tests for `POST /function-call` (see [BACKEND-FUNCTION-CALL-CONTRACT.md](./BACKEND-FUNCTION-CALL-CONTRACT.md)); then implement.
   - **Chosen approach: App backend.** Add an HTTP endpoint (e.g. on the test-app backend server) that receives function-call payloads, runs the same logic currently in the frontend (e.g. `get_current_time`), and returns JSON result. The frontend calls this endpoint and then sends `FunctionCallResponse`.
   - **Handlers are common:** Backend function handlers must be **neither Deepgram nor OpenAI specific**. One set of handlers (e.g. one module or route handler) shared by both Deepgram and OpenAI flows — be DRY. The same HTTP endpoint serves the frontend whether it is connected to Deepgram or to the OpenAI proxy.

**Phase 1.3 — Test-app frontend: forward only (TDD)**

3. **Test-app frontend: forward only, no execution**
   - **Tests first:** Add or adjust tests (e.g. E2E or integration) that assert the app uses the backend for function execution (no in-browser handler by default); then implement.
   - **Definitely:** Change test-app so it does **not** run function logic in `onFunctionCallRequest` by default.
   - Frontend receives `FunctionCallRequest` from the component → sends request to app backend (HTTP) → receives result → calls `sendFunctionCallResponse`.
   - If we keep a minimal frontend handler for E2E/demo, document it clearly as "demo only" and prefer backend path as default.

### Phase 2: Documentation

4. **BACKEND-PROXY and integration docs**
   - Update [BACKEND-PROXY README](../BACKEND-PROXY/README.md) and [Component–Proxy Contract](../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) (or INTERFACE-CONTRACT) to recommend **backend execution** for function calls.
   - Add a short section: "client" = your infrastructure (browser or backend); for production, execute functions on the app backend (proxies not involved); document the pattern (frontend forwards `FunctionCallRequest` → app backend executes → frontend sends `FunctionCallResponse`).

5. **CONVERSATION-STORAGE and other references**
   - If CONVERSATION-STORAGE or other docs mention function-call handling, add a sentence recommending backend execution and link to BACKEND-PROXY.

### Phase 3: Tests and E2E

6. **Unit / integration tests**
   - Phase 1.2 adds integration tests for the `/function-call` endpoint (TDD). Ensure existing proxy integration tests for `FunctionCallRequest` / `FunctionCallResponse` still pass when the test-app frontend forwards to the app backend and sends the response.
   - Backend execution path is covered by the new function-call endpoint tests and (after Phase 1.3) by E2E that use the backend.

7. **E2E**
   - Existing E2E for function calling: run against the new backend execution path and assert success, or explicitly document that a given test uses a "demo only" frontend handler.
   - Prefer E2E that validates backend execution where applicable (e.g. function result returned from backend, not from in-browser logic).

### Phase 4: Optional – Example

8. **Optional: Document frontend → app backend flow**
   - If not already done in Phase 1, add a clear example: frontend receives `FunctionCallRequest` from the component, calls app backend (e.g. HTTP POST), gets result, sends `FunctionCallResponse`. Document in BACKEND-PROXY or in this issue.

---

## Status (tracking)

| Phase | Item | Status | Notes |
|-------|------|--------|--------|
| **1** | Backend contract for function execution (Phase 1.1) | ✅ Done | [BACKEND-FUNCTION-CALL-CONTRACT.md](./BACKEND-FUNCTION-CALL-CONTRACT.md) |
| **1** | Implement backend handler (Phase 1.2; common/DRY) | ✅ Done | `test-app/scripts/function-call-handlers.js`, `backend-server.js` POST /function-call |
| **1** | Test-app frontend: forward only, no execution by default (Phase 1.3) | ✅ Done | `functionCallBackend.ts` + App.tsx; unit tests in functionCallBackend.test.ts |
| **2** | BACKEND-PROXY / Component–Proxy docs updated | ✅ Done | README + COMPONENT-PROXY-CONTRACT |
| **2** | CONVERSATION-STORAGE / other refs (if needed) | ✅ Done | Best-practice + link to #407 |
| **3** | Unit/integration tests for backend execution path | ✅ Done | function-call-endpoint-integration, functionCallBackend, openai-proxy-integration (FCR) |
| **3** | E2E updated or documented for backend execution | ✅ Done | [PHASE-3-TESTS-E2E.md](./PHASE-3-TESTS-E2E.md); test 6 (openai-proxy-e2e) uses backend path |
| **4** | Optional: Frontend → app backend example | ✅ Done | [FRONTEND-TO-BACKEND-EXAMPLE.md](./FRONTEND-TO-BACKEND-EXAMPLE.md) |

**Legend:** ⬜ Not started | 🔄 In progress | ✅ Done

---

## References

- Deepgram: [Function Call Request](https://developers.deepgram.com/docs/voice-agent-function-call-request)
- Component: `onFunctionCallRequest`, `sendFunctionCallResponse` — `src/types/index.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- Test-app: `handleFunctionCallRequest`, `window.handleFunctionCall` — `test-app/src/App.tsx`, `test-app/tests/e2e/helpers/test-helpers.js`
- OpenAI proxy: `scripts/openai-proxy/server.ts`, `translator.ts` — `FunctionCallRequest` / `FunctionCallResponse` mapping
- Docs: [BACKEND-PROXY](../BACKEND-PROXY/README.md), [COMPONENT-PROXY-CONTRACT](../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md), [CONVERSATION-STORAGE](../CONVERSATION-STORAGE.md)
- **Phase 1.1:** [BACKEND-FUNCTION-CALL-CONTRACT.md](./BACKEND-FUNCTION-CALL-CONTRACT.md) — HTTP contract for app-backend function execution
- **Phase 1.2 tests:** `test-app/tests/function-call-endpoint-integration.test.js` — TDD integration tests for POST /function-call
- **Phase 1.2 implementation:** `test-app/scripts/function-call-handlers.js`, `test-app/scripts/backend-server.js` (POST /function-call)
- **Phase 1.3 tests:** `test-app/tests/functionCallBackend.test.ts` — unit tests for forwarding util
- **Phase 1.3 implementation:** `test-app/src/utils/functionCallBackend.ts`, `test-app/src/App.tsx` (forward when no handler; baseUrl from proxyEndpoint)
- **Phase 3:** [PHASE-3-TESTS-E2E.md](./PHASE-3-TESTS-E2E.md) — which tests cover backend path; E2E demo vs backend
- **Phase 4:** [FRONTEND-TO-BACKEND-EXAMPLE.md](./FRONTEND-TO-BACKEND-EXAMPLE.md) — example flow with code references
