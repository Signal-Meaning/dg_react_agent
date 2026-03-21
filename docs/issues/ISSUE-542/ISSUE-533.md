# Issue #533: Harden client JSON — allowlist or remove passthrough to upstream

**GitHub:** [#533](https://github.com/Signal-Meaning/dg_react_agent/issues/533)

**Epic:** [#542](./README.md) · **TDD bundle:** C (client JSON boundary)

---

## Problem (Section 3)

In `server.ts` `forwardClientMessage`, JSON that parses successfully but is **not** `Settings`, `FunctionCallResponse`, or `InjectUserMessage` falls through to `upstream.send(raw)` — raw passthrough to OpenAI Realtime. That bypasses `translator.ts` invariants (`session.update`, `response.create` scheduling, etc.) and expands attack surface for any host that exposes the proxy socket.

Voice Commerce packaged tests **do not** rely on passthrough.

---

## Decision (implemented)

- **Default (strict):** Unknown client JSON → component **Error** (`code: disallowed_client_message_type`); **not** forwarded upstream.
- **KeepAlive:** Ignored at proxy (not sent to OpenAI); component may still send for socket liveness.
- **Escape hatch:** `OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH=1` in `run.ts`, or `createOpenAIProxyServer({ allowClientJsonPassthrough: true })` — forwards **arbitrary unknown JSON** only (not `KeepAlive`; OpenAI has no such client event). Legacy debugging only.

---

## Direction (historical)

- **Preferred:** Allowlist additional forwardable **component** message types only if they are first-class in the Voice Agent API contract, **or** remove passthrough once Section 5 fields cover legitimate knobs.
- **Minimum (if product needs time):** Document passthrough, threat model (who may connect), and discourage production use — still add tests that lock current behavior if passthrough remains.

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR (client-protocol.ts) · - [x] Verified (integration + escape-hatch test)

### RED

- [x] Unit or integration: client sends JSON `{ "type": "SomeUnknownType", ... }`; mock upstream records `send` calls.
- [x] Assert chosen policy encoded in test: **strict** (no raw to upstream; client `Error` with stable `code`) **or** **compat** (passthrough only when dev flag on; default off). Test fails today (raw forwarded).

### GREEN

- [x] Allowlist / deny path implemented: unknown types never hit `upstream.send(raw)` unless explicit escape hatch (default off).
- [x] If escape hatch exists: WARN log when used; documented in README.

### REFACTOR

- [x] Centralize allowed client `type` list — [`client-protocol.ts`](../../../packages/voice-agent-backend/scripts/openai-proxy/client-protocol.ts); unit tests [`openai-proxy-client-protocol.test.ts`](../../../tests/openai-proxy-client-protocol.test.ts); `server.ts` uses `OPENAI_PROXY_CLIENT_JSON_TYPE` + `getOpenAIProxyAllowedClientJsonTypesDescription()`.
- [x] Update proxy README and [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) (COMPONENT-PROXY-CONTRACT: optional if a dedicated client-boundary section is added later).

### Verified

- [x] New tests pass; no regressions for `Settings`, `InjectUserMessage`, `FunctionCallResponse`, binary audio.
- [x] If strict mode breaks an internal dev tool, document the flag and add one test for flag-on behavior.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/client-protocol.ts` — importable legal client JSON `type` list (Issue #533 refactor)
- `tests/openai-proxy-client-protocol.test.ts` — unit tests for `client-protocol.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — `forwardClientMessage` else branch
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`
- `docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md`
- `tests/integration/openai-proxy-integration.test.ts` and/or `tests/openai-proxy.test.ts`
