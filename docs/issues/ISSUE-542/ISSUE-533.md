# Issue #533: Harden client JSON — allowlist or remove passthrough to upstream

**GitHub:** [#533](https://github.com/Signal-Meaning/dg_react_agent/issues/533)

**Epic:** [#542](./README.md) · **TDD bundle:** C (client JSON boundary)

---

## Problem (Section 3)

In `server.ts` `forwardClientMessage`, JSON that parses successfully but is **not** `Settings`, `FunctionCallResponse`, or `InjectUserMessage` falls through to `upstream.send(raw)` — raw passthrough to OpenAI Realtime. That bypasses `translator.ts` invariants (`session.update`, `response.create` scheduling, etc.) and expands attack surface for any host that exposes the proxy socket.

Voice Commerce packaged tests **do not** rely on passthrough.

---

## Direction

- **Preferred:** Allowlist additional forwardable **component** message types only if they are first-class in the Voice Agent API contract, **or** remove passthrough once Section 5 fields cover legitimate knobs.
- **Minimum (if product needs time):** Document passthrough, threat model (who may connect), and discourage production use — still add tests that lock current behavior if passthrough remains.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Unit or integration: client sends JSON `{ "type": "SomeUnknownType", ... }`; mock upstream records `send` calls.
- [ ] Assert chosen policy encoded in test: **strict** (no raw to upstream; client `Error` with stable `code`) **or** **compat** (passthrough only when dev flag on; default off). Test fails today (raw forwarded).

### GREEN

- [ ] Allowlist / deny path implemented: unknown types never hit `upstream.send(raw)` unless explicit escape hatch (default off).
- [ ] If escape hatch exists: WARN log when used; documented in README.

### REFACTOR

- [ ] Centralize allowed client `type` list (`client-protocol.ts` or next to `translator.ts` exports).
- [ ] Update [COMPONENT-PROXY-CONTRACT.md](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) and proxy README (threat model if passthrough remains).

### Verified

- [ ] New tests pass; no regressions for `Settings`, `InjectUserMessage`, `FunctionCallResponse`, binary audio.
- [ ] If strict mode breaks an internal dev tool, document the flag and add one test for flag-on behavior.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — `forwardClientMessage` else branch
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`
- `docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md`
- `tests/integration/openai-proxy-integration.test.ts` and/or `tests/openai-proxy.test.ts`
