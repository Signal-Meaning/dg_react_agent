# Issue #531: Always log Realtime `error` events without `LOG_LEVEL` / `OPENAI_PROXY_DEBUG`

**GitHub:** [#531](https://github.com/Signal-Meaning/dg_react_agent/issues/531)

**Epic:** [#542](./README.md) · **TDD bundle:** A (observability)

---

## Problem (Section 1)

`run.ts` passes `logLevel: undefined` when neither `LOG_LEVEL` nor `OPENAI_PROXY_DEBUG` is set. `initProxyLogger` then **does not** initialize the OTel logger (`logger.ts`: no provider when level unset). Every `emitLog` in `server.ts` becomes a no-op, including the branch that handles upstream `type: "error"`. Operators see nothing on stderr while the client may still receive a translated `Error`.

---

## Expected behavior

With **no** logging env vars, at least one **ERROR**-severity record must still be emitted for each upstream Realtime `error` event (reuse the same attribute keys as today: `error.code`, `error.message`, `connection_id`, direction `upstream→client`).

Document in `packages/voice-agent-backend/scripts/openai-proxy/README.md` and/or the `run.ts` header that upstream errors are always logged.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Add failing test: with no `LOG_LEVEL` / `OPENAI_PROXY_DEBUG`, an upstream Realtime `error` still produces a visible ERROR log (unit on `logger.ts` with mock exporter **or** integration with stderr spy on `createOpenAIProxyServer` + mock upstream sending `{ type: 'error', ... }`).
- [ ] Confirm test fails on current baseline (logger uninitialized → `emitLog` no-op).

### GREEN

- [ ] Implement **Option A** (`console.error` fallback in `emitLog` when logger null and severity ≥ ERROR) **or** **Option B** (default `initProxyLogger` to `error` when env unset); document which in the PR / commit message.
- [ ] Upstream `error` path continues to use ERROR severity for non-special cases (`server.ts`).

### REFACTOR

- [ ] Deduplicate “force emit critical logs” logic if both `console.error` and OTel are used.
- [ ] Update proxy `README.md` and/or `run.ts` header: upstream errors always logged without opt-in.

### Verified

- [ ] Mock-based test passes in CI.
- [ ] Manual or scripted run: unset `LOG_LEVEL`, trigger upstream error (e.g. bad model in `session.update`), confirm stderr shows the error.
- [ ] No change that hides upstream errors behind synthetic success (`.cursorrules` proxy rules).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/logger.ts` — `initProxyLogger`, `emitLog`
- `packages/voice-agent-backend/scripts/openai-proxy/run.ts` — default `logLevel`
- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — upstream `error` handler (verify severity after fix)
- `packages/voice-agent-backend/scripts/openai-proxy/README.md` — documentation
- Tests: new or under `tests/` next to existing `openai-proxy*.test.ts`
