# Issue #531: Always log Realtime `error` events without `LOG_LEVEL` / `OPENAI_PROXY_DEBUG`

**GitHub:** [#531](https://github.com/Signal-Meaning/dg_react_agent/issues/531)

**Epic:** [#542](./README.md) · **TDD bundle:** A (observability)

**Implementation:** **Option B** — when `LOG_LEVEL` / `logLevel` option are unset, `initProxyLogger` sets minimum severity to **error** and always initializes OTel so `emitLog` at ERROR reaches the console exporter.

---

## Problem (Section 1)

Previously, `run.ts` passed `logLevel: undefined` when neither `LOG_LEVEL` nor `OPENAI_PROXY_DEBUG` was set. `initProxyLogger` did not initialize the OTel logger, so every `emitLog` in `server.ts` was a no-op, including the branch that handles upstream `type: "error"`.

---

## Expected behavior

With **no** logging env vars, at least one **ERROR**-severity record must still be emitted for each upstream Realtime `error` event (reuse the same attribute keys as today: `error.code`, `error.message`, `connection_id`, direction `upstream→client`).

Document in `packages/voice-agent-backend/scripts/openai-proxy/README.md` and/or the `run.ts` header that upstream errors are always logged.

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (all items below)

### RED

- [x] Add failing test: with no `LOG_LEVEL` / `OPENAI_PROXY_DEBUG`, an upstream Realtime `error` still produces a visible ERROR log (unit on `logger.ts` with mock exporter **or** integration with stderr spy on `createOpenAIProxyServer` + mock upstream sending `{ type: 'error', ... }`).
- [x] Confirm test fails on current baseline (logger uninitialized → `emitLog` no-op).

### GREEN

- [x] Implement **Option A** (`console.error` fallback in `emitLog` when logger null and severity ≥ ERROR) **or** **Option B** (default `initProxyLogger` to `error` when env unset); document which in the PR / commit message.
- [x] Upstream `error` path continues to use ERROR severity for non-special cases (`server.ts`).

### REFACTOR

- [x] Deduplicate “force emit critical logs” logic if both `console.error` and OTel are used. _(N/A: Option B only — single OTel path.)_
- [x] Update proxy `README.md` and/or `run.ts` header: upstream errors always logged without opt-in.

### Verified

- [x] Mock-based test passes in CI.
- [ ] Manual or scripted run: unset `LOG_LEVEL`, trigger upstream error (e.g. bad model in `session.update`), confirm stderr shows the error.
- [x] No change that hides upstream errors behind synthetic success (`.cursorrules` proxy rules).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/logger.ts` — `initProxyLogger`, `emitLog`
- `packages/voice-agent-backend/scripts/openai-proxy/run.ts` — default `logLevel`
- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — upstream `error` handler (verify severity after fix)
- `packages/voice-agent-backend/scripts/openai-proxy/README.md` — documentation
- Tests: `tests/logging-standard-proxy.test.ts`
