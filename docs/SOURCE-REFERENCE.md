# Source reference – component and proxy

This document directs you to the **major source elements** in this package so you can use the shipped source as a reference implementation. The package includes both built output (`dist/`) and source (`src/`, `scripts/`).

---

## Component (React)

| Purpose | Location | Notes |
|--------|----------|--------|
| **Entry point** | `src/index.ts` | Exports `DeepgramVoiceInteraction`, types, and test utilities. |
| **Main component** | `src/components/DeepgramVoiceInteraction/index.tsx` | Headless React component: WebSocket lifecycle, agent/transcription options, callbacks (e.g. `onFunctionCallRequest`), ref methods. |
| **Built output** | `dist/index.js`, `dist/index.esm.js`, `dist/index.d.ts` | Use these at runtime; `src/` is for reference and debugging. |
| **Types** | `src/types/` | Connection, agent, transcription, and related TypeScript types. |
| **Hooks / utils** | `src/hooks/`, `src/utils/`, `src/services/` | Used by the component (e.g. idle timeout, WebSocket handling). |

---

## OpenAI Realtime proxy

The proxy translates between the **component protocol** (e.g. Settings, InjectUserMessage, ConversationText) and the **OpenAI Realtime API** (session.update, conversation.item.create, response.create, etc.). It runs as a WebSocket server that clients connect to; it then connects to the OpenAI Realtime upstream.

| File | Purpose |
|------|--------|
| **`scripts/openai-proxy/server.ts`** | WebSocket server: accepts component protocol, translates to OpenAI client events, forwards to upstream, translates upstream events back to component. Handles **event ordering**: on `InjectUserMessage` it sends `conversation.item.create` to upstream and sends `response.create` **only after** upstream sends `conversation.item.added` or `conversation.item.done` (required by the OpenAI API so the connection stays open). Also handles binary audio (e.g. `input_audio_buffer.append`), greeting injection after session.updated, and FunctionCallRequest/FunctionCallResponse mapping. |
| **`scripts/openai-proxy/translator.ts`** | Pure mapping functions: component messages ↔ OpenAI Realtime events (e.g. Settings → session.update, InjectUserMessage → conversation.item.create, response.output_text.done → ConversationText, response.function_call_arguments.done → FunctionCallRequest). |
| **`scripts/openai-proxy/run.ts`** | Entry point to run the proxy (loads env, starts HTTP server, attaches WebSocket at a path). Use `npm run openai-proxy` from the package root. |
| **`scripts/openai-proxy/logger.ts`** | Optional OpenTelemetry-style logging when `OPENAI_PROXY_DEBUG=1`. |
| **`scripts/openai-proxy/README.md`** | Translator exports, server behavior, and how to run the proxy. |

**Important behavior (event order):** For text messages injected via the component (`InjectUserMessage`), the proxy must send `response.create` to OpenAI **only after** the upstream has sent `conversation.item.added` or `conversation.item.done`. Sending `response.create` immediately after `conversation.item.create` can cause the upstream to close the connection. See `docs/issues/ISSUE-388/OPENAI-REALTIME-API-REVIEW.md` for the API rationale.

---

## Deepgram proxy (test-app)

For Deepgram-backed flows, the test-app includes a **mock proxy server** that forwards WebSocket traffic to the Deepgram Voice Agent API (or transcription) and adds API key server-side. It does not translate protocols; it is a passthrough with routing and auth.

| Location | Purpose |
|----------|--------|
| **`test-app/scripts/mock-proxy-server.js`** | Single server that can expose `/deepgram-proxy` (Deepgram) and/or `/openai` (forwards to the OpenAI proxy subprocess). Used for E2E and local testing. |
| **`test-app/docs/PROXY-SERVER.md`** | Design, operation, and usage of the mock proxy server. |

---

## Further documentation

- **API surface:** `docs/API-REFERENCE.md`
- **Backend proxy (interface contract):** `docs/BACKEND-PROXY/README.md`, `docs/BACKEND-PROXY/INTERFACE-CONTRACT.md`
- **OpenAI proxy event order:** `docs/issues/ISSUE-388/OPENAI-REALTIME-API-REVIEW.md`
- **Proxy ownership and support scope:** `docs/issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md`
