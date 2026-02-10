# Issue #407: Refactor – Move function call execution to backend (not frontend)

**Branch:** `davidrmcgee/issue407`  
**GitHub:** [#407](https://github.com/Signal-Meaning/dg_react_agent/issues/407)

---

## Summary

Refactor the test-app and recommended integration pattern so that **function calls are executed on the backend** (e.g. proxy or app server), not in the browser/frontend.

## Background

In both the Deepgram and OpenAI Voice Agent APIs, **"client-side" means your side of the WebSocket (your infrastructure), not "browser."**

- **Deepgram:** [Function Call Request](https://developers.deepgram.com/docs/voice-agent-function-call-request) — `client_side: true` means "the client must handle the function." The "client" is the WebSocket client (could be browser or your backend).
- **OpenAI:** The Realtime API has no `client_side`; our proxy injects `client_side: true` when mapping to the component protocol. Execution location is an integration choice.

Currently the test-app runs function handlers in the frontend (`onFunctionCallRequest` / `window.handleFunctionCall` in the browser). For production (security, secrets, data access), functions should typically run on the backend.

## Scope

- **Test-app:** Move function execution from frontend to backend (e.g. proxy or a small backend service). Frontend receives `FunctionCallRequest`, forwards to backend; backend executes and returns result; frontend sends `FunctionCallResponse` (or backend sends it via proxy).
- **Docs / recommendations:** Update CONVERSATION-STORAGE, BACKEND-PROXY, and any integration docs to recommend backend execution for function calls and document the pattern (e.g. proxy handles `FunctionCallRequest` → calls app backend → sends `FunctionCallResponse`).
- **E2E / tests:** Adjust or add tests so that function-call E2E validates backend execution where applicable (or document that test-app may keep a minimal frontend handler for demo only).
- **Optional:** Proxy or example shows how to route `FunctionCallRequest` to an app backend and return `FunctionCallResponse`.

---

## Acceptance criteria

- [ ] Test-app no longer executes function logic in the browser by default; execution happens on backend (proxy or app server).
- [ ] Documentation clearly recommends backend execution for function calls and explains API semantics (client = your infrastructure, not necessarily browser).
- [ ] Existing E2E for function calling still pass (or are updated to reflect backend execution).
- [ ] Optional: Proxy or example shows how to route `FunctionCallRequest` to an app backend and return `FunctionCallResponse`.

---

## Plan (resolution steps)

### Phase 1: Backend function execution (proxy or app server)

1. **Define backend contract for function execution**
   - Document or add an HTTP (or WebSocket) endpoint that accepts a function-call payload (id, name, arguments) and returns the result content (or error).
   - Decide whether the **proxy** (e.g. `scripts/openai-proxy`) executes functions itself or forwards to an **app backend** URL; document the chosen pattern.

2. **Implement backend handler**
   - **Option A – Proxy executes:** Extend the OpenAI proxy (and/or document Deepgram proxy) to handle `FunctionCallRequest` by calling a small function-executor (e.g. same process or configurable app URL), then sending `FunctionCallResponse` (or `conversation.item.create` function_call_output) to upstream.
   - **Option B – App backend:** Add an HTTP endpoint (e.g. on the test-app backend server) that receives function-call payloads, runs the same logic currently in the frontend (e.g. `get_weather`), and returns JSON result. Proxy or frontend calls this endpoint and then sends `FunctionCallResponse`.

3. **Test-app frontend: forward, don’t execute**
   - Change test-app so it does **not** run function logic in `onFunctionCallRequest` by default.
   - Frontend receives `FunctionCallRequest` from the component → sends request to backend (HTTP or via existing WebSocket/proxy) → receives result → calls `sendFunctionCallResponse` (or backend sends response via proxy so frontend is out of the loop).
   - If we keep a minimal frontend handler for E2E/demo, document it clearly as "demo only" and prefer backend path as default.

### Phase 2: Documentation

4. **BACKEND-PROXY and integration docs**
   - Update [BACKEND-PROXY README](../BACKEND-PROXY/README.md) and [Component–Proxy Contract](../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) (or INTERFACE-CONTRACT) to recommend **backend execution** for function calls.
   - Add a short section: "client" = your infrastructure (browser or backend); for production, execute functions on the backend (proxy or app server); document the pattern (proxy handles `FunctionCallRequest` → calls app backend → sends `FunctionCallResponse`).

5. **CONVERSATION-STORAGE and other references**
   - If CONVERSATION-STORAGE or other docs mention function-call handling, add a sentence recommending backend execution and link to BACKEND-PROXY.

### Phase 3: Tests and E2E

6. **Unit / integration tests**
   - Ensure existing proxy integration tests for `FunctionCallRequest` / `FunctionCallResponse` still pass when the **client** is the test-app frontend that forwards to backend (or when the proxy executes and sends response).
   - Add or adjust tests so that the **backend execution path** is covered (e.g. proxy or app backend receives request, returns result, client or proxy sends `FunctionCallResponse`).

7. **E2E**
   - Existing E2E for function calling: either run against the new backend execution path and assert success, or explicitly document that a given test uses a "demo only" frontend handler.
   - Prefer E2E that validates backend execution where applicable (e.g. function result returned from backend, not from in-browser logic).

### Phase 4: Optional – Proxy example

8. **Optional: Document or implement proxy → app backend**
   - If not already done in Phase 1, add a clear example or code path: proxy receives `FunctionCallRequest` (from component), calls app backend (e.g. HTTP POST), gets result, sends `FunctionCallResponse` (or upstream `conversation.item.create` function_call_output). Document in BACKEND-PROXY or in this issue.

---

## Status (tracking)

| Phase | Item | Status | Notes |
|-------|------|--------|--------|
| **1** | Backend contract for function execution | ⬜ Not started | |
| **1** | Implement backend handler (proxy or app backend) | ⬜ Not started | |
| **1** | Test-app frontend: forward only, no execution by default | ⬜ Not started | |
| **2** | BACKEND-PROXY / Component–Proxy docs updated | ⬜ Not started | |
| **2** | CONVERSATION-STORAGE / other refs (if needed) | ⬜ Not started | |
| **3** | Unit/integration tests for backend execution path | ⬜ Not started | |
| **3** | E2E updated or documented for backend execution | ⬜ Not started | |
| **4** | Optional: Proxy → app backend example | ⬜ Not started | |

**Legend:** ⬜ Not started | 🔄 In progress | ✅ Done

---

## References

- Deepgram: [Function Call Request](https://developers.deepgram.com/docs/voice-agent-function-call-request)
- Component: `onFunctionCallRequest`, `sendFunctionCallResponse` — `src/types/index.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- Test-app: `handleFunctionCallRequest`, `window.handleFunctionCall` — `test-app/src/App.tsx`, `test-app/tests/e2e/helpers/test-helpers.js`
- OpenAI proxy: `scripts/openai-proxy/server.ts`, `translator.ts` — `FunctionCallRequest` / `FunctionCallResponse` mapping
- Docs: [BACKEND-PROXY](../BACKEND-PROXY/README.md), [COMPONENT-PROXY-CONTRACT](../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md), [CONVERSATION-STORAGE](../CONVERSATION-STORAGE.md)
