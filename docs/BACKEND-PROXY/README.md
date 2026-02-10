# Backend Proxy Documentation

**Issue #242** - Backend Proxy Support for Secure API Key Management

This directory contains comprehensive documentation for implementing and using backend proxy mode with the `DeepgramVoiceInteraction` component.

## Documentation Files

### Core Documentation

- **[Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md)** - Big picture: one component protocol, multiple backends (Deepgram or translation proxy); readiness contract (SettingsApplied before first user message) applies to all
- **[Interface Contract](./INTERFACE-CONTRACT.md)** - Specification of the backend proxy interface contract that developers must implement
- **[Security Best Practices](./SECURITY-BEST-PRACTICES.md)** - Security guidelines and best practices for backend proxy implementation
- **[Migration Guide](./MIGRATION-GUIDE.md)** - Step-by-step guide for migrating from direct connection to proxy mode

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

Backend responds with `{ "content": "..." }` (success) or `{ "error": "..." }`. See [Issue #407](../issues/ISSUE-407/README.md), [Backend function-call contract](../issues/ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md), and [Full example with test-app code](../issues/ISSUE-407/FRONTEND-TO-BACKEND-EXAMPLE.md).

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

The test-app can use an **OpenAI Realtime** backend via a translation proxy in `scripts/openai-proxy/`. Protocol and message ordering (client ↔ proxy ↔ OpenAI) are documented in **[scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)**. The same component–proxy contract (e.g. SettingsApplied before first message) applies; see [Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md).

## Related Documentation

- [API Reference](../API-REFERENCE.md) - Component API documentation with proxy mode examples
- [Conversation storage](../CONVERSATION-STORAGE.md) - Who owns persistence logic (component) vs storage implementation (application); test-app demonstrates with localStorage
- [Issue #407](../issues/ISSUE-407/README.md) - Function calls on the app backend (not frontend); [contract](../issues/ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md); [example](../issues/ISSUE-407/FRONTEND-TO-BACKEND-EXAMPLE.md)
- [Issue #242 Tracking](../issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md) - Complete feature tracking document
- [Proxy ownership decision](../issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md) - What we own (code, contract) and support scope for proxies