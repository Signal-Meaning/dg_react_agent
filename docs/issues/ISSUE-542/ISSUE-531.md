# Issue #531: Always log Realtime `error` events without `LOG_LEVEL` / `OPENAI_PROXY_DEBUG`

**GitHub:** [#531](https://github.com/Signal-Meaning/dg_react_agent/issues/531)

**Epic:** [#542](./README.md) · **TDD bundle:** A (observability)

## Decision (canonical)

**Option B only:** when `LOG_LEVEL` / `logLevel` are unset, `initProxyLogger` uses a minimum severity of **error** and initializes OTel so ERROR logs (including upstream Realtime `error`) always emit. **Do not** switch to Option A (`console.error` fallback in `emitLog` when the logger is null) unless product explicitly reverses this decision—Option B keeps a single OTel path and consistent attributes.

**Why Option A is not required:** The supported entrypoint is `createOpenAIProxyServer`, which **must always** call `initProxyLogger` (even when `options.logLevel` is undefined) so Option B actually applies. Option A would only help if `emitLog` ran without a prior `initProxyLogger` (unsupported) or after `shutdownProxyLogger` during teardown (not worth a second logging path for normal ops).

**Implementation:** Option B in `logger.ts` plus unconditional `initProxyLogger({ logLevel: options.logLevel })` in `server.ts` (Issue #531 wire-up).

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

- [x] Implement **Option B** (default `initProxyLogger` minimum severity to **error** when env/option unset); see **Decision** above.
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
