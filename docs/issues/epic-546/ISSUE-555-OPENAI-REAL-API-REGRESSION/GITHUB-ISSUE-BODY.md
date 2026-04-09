## Summary

`USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` has been failing in release qualification (post–EPIC-546 / v0.10.6 train) where it previously passed. This issue tracks **determining root cause** (repo regression vs upstream flake), **fixing or hardening** the proxy/tests, and restoring a **reliable real-API qualification** path.

**Parent epic:** #546 (OpenAI proxy TLS & packaging) — this is a **follow-on quality/regression** item, not the TLS entrypoint work itself.

## Observed failures (2026-03-28)

1. **Issue #470 real-API — function-call flow**  
   - Error: `Issue #470 real-API: Timeout waiting for assistant response after function call` (~60s).  
   - Meaning: After real HTTP POST to minimal `/function-call` backend and `FunctionCallResponse`, no assistant `ConversationText` including expected tool result (`12:00` / `UTC`) within the timeout.

2. **`translates InjectUserMessage … ConversationText` (real-API branch)**  
   - Jest **25s** timeout; `done()` never called.  
   - Log: **`Unexpected server response: 504`** on the **proxy → OpenAI** WebSocket (HTTP upgrade / gateway), logged via OpenTelemetry as upstream ERROR.

## Context

- EPIC-546 commits did **not** modify `packages/voice-agent-backend/scripts/openai-proxy/server.ts`; they changed `run.ts`, `listen-tls`, `attach-upgrade.js`, and packaging. The failing suite uses **in-process** `createOpenAIProxyServer` on plain HTTP (not `run.ts`), so TLS refactors are not the direct code path for these tests — but **lockfile / transitive deps / API behavior** can still explain a regression in practice.
- Mitigation already added in-repo: **`tests/integration/openai-proxy-run-ts-entrypoint.test.ts`** exercises the **same `run.ts` entrypoint as test-app** (mock upstream) for CI/release docs — see `docs/issues/epic-546/RELEASE-AND-QUALIFICATION.md`.

## Definition of done

- [x] **Bisect** (or equivalent) — **Analysis equivalent to bisect** documented in [TRACKING.md](./TRACKING.md): **#470** path = **repo** (`response.output_text.done` not forwarded as `ConversationText`); **504** = **upstream / gateway** flake.
- [x] **Repeat** real-API integration runs — post-fix **PASS** logged (see [#554](../ISSUE-554/TRACKING.md) **2026-03-28**); re-run before sensitive releases if needed.
- [x] If repo bug: **fix** in `server.ts` / `translator.ts` / tests — **done** (`ConversationText` from `response.output_text.done` after tools); **`USE_REAL_APIS=1`** suite green on recorded qualification run.
- [x] **504** — documented as **intermittent upstream**; **re-run** qualification (no synthetic success); OTel improvements: [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565) / [#567](https://github.com/Signal-Meaning/dg_react_agent/pull/567).
- [x] Update **`docs/issues/epic-546/ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md`** — **done** (**2026-04-09**); GitHub **#555** closed.

## References

- Integration suite: `tests/integration/openai-proxy-integration.test.ts`
- `run.ts` entrypoint test: `tests/integration/openai-proxy-run-ts-entrypoint.test.ts`
- Epic tracking: `docs/issues/epic-546/TDD-EPIC-546.md`, `RELEASE-AND-QUALIFICATION.md`
- Release execution: #554
