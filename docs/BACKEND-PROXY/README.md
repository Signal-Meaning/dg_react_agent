# Backend Proxy Documentation

This directory describes the **backend proxies and translators** used with the `DeepgramVoiceInteraction` React component: what they are, what this project provides, and how to implement or use them.

## Overview: what are the backend proxies?

The React component connects to a **WebSocket endpoint** to run the voice agent. That endpoint can be:

1. **Deepgram directly** (direct mode) — the component connects to Deepgram using an API key. The key is passed from the frontend; suitable for development or low-risk use.
2. **Your backend** (proxy mode) — the component connects to a WebSocket URL you provide (e.g. `wss://your-api.com/deepgram-proxy`). Your backend then talks to Deepgram (or to another provider). This keeps API keys and secrets on the server and gives you control over auth, logging, and routing.

The **backend proxy** is the server-side code that:

- Accepts a WebSocket connection from the component.
- Speaks the **same protocol** the component expects (Deepgram Voice Agent message types: Settings, SettingsApplied, ConversationText, AgentAudioDone, etc.).
- Forwards messages to and from an upstream provider (Deepgram or, via a translator, another API such as OpenAI Realtime).

So there are two main patterns:

- **Deepgram proxy** — Your backend holds the Deepgram API key and forwards client ↔ Deepgram. The protocol is unchanged; you are just moving the connection and credentials to your server.
- **Translation proxy (e.g. OpenAI)** — Your backend talks to a different upstream (e.g. OpenAI Realtime API) and **translates** between that API’s protocol and the component’s protocol. The component still sees the same message types (SettingsApplied, AgentAudioDone, etc.); the proxy is responsible for mapping upstream events to that contract.

This repo **promotes and maintains** proxy and translator code that we document and ship for other teams to use. References in this doc to “the proxy” or “our proxy” mean that promoted code (e.g. in `packages/voice-agent-backend/` or the patterns in the implementation guides), not a specific deployment like the test-app’s local backend. **The dg_react_agent team is responsible for the correctness of that proxy/translator code against the component’s protocol** (message types, ordering, and lifecycle such as SettingsApplied and AgentAudioDone). Integrators who use or adapt the code we provide can rely on us to maintain it; third-party implementations are outside our support scope (see [Support scope](#support-scope) below).

### What this repo provides

- **Interface contract** — The specification of the WebSocket protocol between component and proxy (message types, ordering, readiness). See [Interface Contract](./INTERFACE-CONTRACT.md) and [Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md).
- **Reference implementations** — Guides for implementing a proxy in your stack: [Node.js/Express](./IMPLEMENTATION-NODEJS.md), [Python/FastAPI](./IMPLEMENTATION-FASTAPI.md), [Python/Django](./IMPLEMENTATION-DJANGO.md).
- **OpenAI translation proxy** — Code that translates between the component protocol and the OpenAI Realtime API, in `packages/voice-agent-backend/scripts/openai-proxy/`. See [Run the OpenAI proxy](./RUN-OPENAI-PROXY.md).
- **Test-app backend** — A single server used by the test-app that hosts both a Deepgram proxy and the OpenAI proxy (and optional function endpoints) for development and E2E testing. See [Test-app backend](#test-app-backend-single-server) below.

## Documentation Files

### Core Documentation

- **[Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md)** - Big picture: one component protocol, multiple backends (Deepgram or translation proxy); readiness contract (SettingsApplied before first user message) applies to all
- **[Backend function-call contract](./BACKEND-FUNCTION-CALL-CONTRACT.md)** - HTTP contract for app-backend function execution (`POST /function-call`); intent and third-party scope (Epic #455)
- **[Interface Contract](./INTERFACE-CONTRACT.md)** - Specification of the backend proxy interface contract that developers must implement
- **[Security Best Practices](./SECURITY-BEST-PRACTICES.md)** - Security guidelines and best practices for backend proxy implementation
- **[Migration Guide](./MIGRATION-GUIDE.md)** - Step-by-step guide for migrating from direct connection to proxy mode

### OpenAI proxy (translation layer)

- **[Run the OpenAI proxy and tests](./RUN-OPENAI-PROXY.md)** – Env vars, how to run the proxy (canonical and standalone), unit/integration/E2E test commands, CI notes. Proxy lives in `packages/voice-agent-backend/scripts/openai-proxy/` (Issue #445).

### Implementation Guides

- **[Node.js/Express Implementation](./IMPLEMENTATION-NODEJS.md)** - Complete guide for implementing backend proxy with Node.js and Express
- **[Python/FastAPI Implementation](./IMPLEMENTATION-FASTAPI.md)** - Complete guide for implementing backend proxy with Python and FastAPI
- **[Python/Django Implementation](./IMPLEMENTATION-DJANGO.md)** - Complete guide for implementing backend proxy with Python and Django

## Test-app backend (single server)

The test-app uses **one backend server** that hosts both Deepgram and OpenAI proxies (and can host function endpoints). Run it with `cd test-app && npm run backend`. See [Architecture](./ARCHITECTURE.md) for DRY validation and structure.

## Quick Start

1. **Read the Interface Contract** - Understand what your backend must implement
2. **Choose Your Framework** - Select the implementation guide for your backend stack
3. **Follow Security Best Practices** - Ensure your implementation is secure
4. **Update Your Frontend** - Use `proxyEndpoint` prop instead of `apiKey`

## Key Concepts

### Component–Proxy Contract (All Proxies)

The component speaks **one protocol** (Deepgram Voice Agent message types). Whether the proxy talks to Deepgram directly or to another service (e.g. OpenAI via a translation layer), the **readiness contract** is the same: the component must receive **SettingsApplied** before sending the first user message, and the proxy must send it and keep the connection open. See [Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md).

### Idle timeout and greeting (AgentAudioDone)

The component starts its **idle timeout** only when the agent is idle (not speaking, not playing). That can happen in two ways: (1) the proxy sends **AgentAudioDone** after response or greeting **audio** — then the component transitions to idle and starts the timer; (2) for **text-only** greeting or turns (e.g. `ConversationText` assistant with no binary), the component has a built-in path that transitions to idle after a short defer, so the proxy does **not** need to send `AgentAudioDone`. Our **Deepgram proxy** (`packages/voice-agent-backend/src/attach-upgrade.js`) sends `AgentAudioDone` after the first assistant `ConversationText` **only when** it has already forwarded at least one binary message in that connection; for text-only greeting the component’s text-only path handles it. See [Component–Proxy Contract § Idle timeout and agent completion](./COMPONENT-PROXY-CONTRACT.md#idle-timeout-and-agent-completion-agentaudiodone--text-only-path).

### Interface Contract, Not New Service

**Important**: This is **not a new service to deploy**. Instead, it's an **interface contract** that developers implement in their existing backend infrastructure by adding a WebSocket proxy endpoint.

### Connection Modes

- **Direct Mode**: Component connects directly to Deepgram using `apiKey` prop
- **Proxy Mode**: Component connects through your backend proxy using `proxyEndpoint` prop

### Function calls: execute on the app backend (Issue #407)

In both Deepgram and OpenAI Voice Agent APIs, **"client-side" means your side of the WebSocket (your infrastructure), not necessarily the browser.** For production (security, secrets, data access), **function calls should be executed on your app backend**, not in the browser.

- **Proxies are not involved with function execution.** The WebSocket proxy forwards `FunctionCallRequest` / `FunctionCallResponse`; it does not run function logic. Your **app backend** (e.g. the same server that hosts the proxy or a separate service) should expose an HTTP endpoint (e.g. `POST /function-call`) that executes the function and returns the result.
- **Recommended pattern:** Frontend receives `FunctionCallRequest` from the component → POSTs to your app backend → backend executes (common handlers for Deepgram and OpenAI) → frontend sends `FunctionCallResponse` with the returned content.

**Minimal example (frontend in `onFunctionCallRequest`):**

```ts
// Derive HTTP base from proxy endpoint, e.g. ws://localhost:8080/openai → http://localhost:8080
const baseUrl = getFunctionCallBackendBaseUrl(proxyEndpoint);

const res = await fetch(`${baseUrl}/function-call`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: request.id, name: request.name, arguments: request.arguments ?? '{}' }),
});
const body = await res.json();
if (body.error) sendResponse({ id: request.id, error: body.error });
else sendResponse({ id: request.id, result: JSON.parse(body.content) });
```

Backend responds with `{ "content": "..." }` (success) or `{ "error": "..." }`. See [Backend function-call contract](./BACKEND-FUNCTION-CALL-CONTRACT.md), [Issue #407](../issues/ISSUE-407/README.md) (historical), and [Full example with test-app code](../issues/ISSUE-407/FRONTEND-TO-BACKEND-EXAMPLE.md).

### Security Benefits

- API keys never exposed to frontend
- Better compliance with security standards
- Reduced risk of unauthorized usage
- Better control over API usage

## Validation & Testing

Backend proxy support has been comprehensively validated and is production-ready:

- ✅ 47/47 proxy mode tests passing (100% pass rate)
- ✅ All connection-relevant features validated
- ✅ Equivalent test coverage confirmed between proxy and direct modes
- ✅ All regression fixes validated in proxy mode

For detailed validation results, see the [validation documentation](../issues/ISSUE-345/ISSUE-345-VALIDATION-REPORT.md).

## Support scope

We provide **reference proxy code** and the **interface contract** (protocol, event order). We do **not** support third-party proxy implementations: we do not provide technical support, debugging, or SLAs for proxies built or operated by others. For hosted proxy services or support, customers should adopt third-party proxy implementations or vendors that implement the same contract. See [Proxy ownership and support scope](../issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md#support-scope-for-proxies) for the full statement.

## OpenAI proxy (translation layer)

The test-app can use an **OpenAI Realtime** backend via a translation proxy in **packages/voice-agent-backend/scripts/openai-proxy/** (Issue #445). How to run it and run tests: **[RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md)**. Protocol and message ordering (client ↔ proxy ↔ OpenAI): [PROTOCOL-AND-MESSAGE-ORDERING.md](../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md). **Settings → WebSocket `session.update`:** field-by-field map in [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md) (Epic [#542](../issues/ISSUE-542/README.md): Voice Commerce proxy defect register, client JSON boundary, inject queue #534, session mapping #535–#540, etc.). The same component–proxy contract (e.g. SettingsApplied before first message) applies; see [Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md). **Context:** The proxy receives context only in the first Settings per connection. When a reconnection is made, the app must pass `agentOptions.context` with the conversation history so the new connection’s first message is Settings with context. See PROTOCOL-AND-MESSAGE-ORDERING § 2.2 and test-app README § "When is context sent to the backend?".

## Related Documentation

- [API Reference](../API-REFERENCE.md) - Component API documentation with proxy mode examples
- [Conversation storage](../CONVERSATION-STORAGE.md) - Who owns persistence logic (component) vs storage implementation (application); test-app demonstrates with localStorage
- [Backend function-call contract](./BACKEND-FUNCTION-CALL-CONTRACT.md) - Function calls on the app backend (not frontend); [Issue #407](../issues/ISSUE-407/README.md) (historical); [example](../issues/ISSUE-407/FRONTEND-TO-BACKEND-EXAMPLE.md)
- [Issue #242 Tracking](../issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md) - Complete feature tracking document
- [Proxy ownership decision](../issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md) - What we own (code, contract) and support scope for proxies