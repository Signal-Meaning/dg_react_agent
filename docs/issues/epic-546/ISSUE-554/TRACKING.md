# Tracking — GitHub #554 (release execution)

**Issue:** [Release v0.2.11: voice-agent-backend patch (EPIC-546 packaging)](https://github.com/Signal-Meaning/dg_react_agent/issues/554)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

Use **checkboxes on GitHub issue #554** as the primary checklist (same content as [GITHUB-ISSUE-BODY.md](./GITHUB-ISSUE-BODY.md)). Update this file when major milestones complete so the epic folder stays auditable without opening GitHub.

## Epic gates (before starting release checklist)

- [ ] [#547](https://github.com/Signal-Meaning/dg_react_agent/issues/547) (and any co-shipped code) merged: consumer no longer hits `MODULE_NOT_FOUND: selfsigned` on supported path
- [ ] [#548](https://github.com/Signal-Meaning/dg_react_agent/issues/548) resolved if included in same publish: runtime `dependencies` match proxy imports
- [ ] Version numbers in #554 Overview table confirmed (backend **0.2.11** or chosen patch; React bump or **no bump**)

## Release execution (rollup)

Mirror the sections from the GitHub issue; check here when each **section** is done.

- [ ] **Pre-release preparation** — lint, `test:mock`, E2E proxy mode, real-API integration if proxy touched, `openai-proxy-event-coverage`, `npm audit --audit-level=high`
- [ ] **EPIC-546 packaging smoke** — `npm pack` → clean install → start proxy; no missing modules ([`../RELEASE-AND-QUALIFICATION.md`](../RELEASE-AND-QUALIFICATION.md))
- [ ] **Version management** — `packages/voice-agent-backend/package.json` (and root if bumped)
- [ ] **Release docs** — `docs/releases/v…/` per patch rules (CHANGELOG, PACKAGE-STRUCTURE, validate script)
- [ ] **Release branch** — `release/v…` with commits
- [ ] **GitHub Release + CI publish** — workflow green; packages in registry
- [ ] **`latest` dist-tag** — only for packages actually published
- [ ] **Post-release** — PR `release/v…` → `main`; notify integrators (e.g. Voice Commerce); close #554 and update epic #546

## Verification log

_Add dated entries (command, outcome, operator)._

- [ ] _…_

### Real-API integration failure identification (2026-03-28)

`USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` reported:

1. **Issue #470 (function-call):** `Timeout waiting for assistant response after function call` (~60s) — no `ConversationText` (assistant) after `FunctionCallResponse` + backend HTTP; no `conversation_already_has_active_response` in the excerpt.
2. **`translates InjectUserMessage … ConversationText`:** Jest **25s** timeout — `done()` never called; log showed **`Unexpected server response: 504`** on the **proxy→OpenAI** WebSocket (OTel ERROR on upstream leg).

**Interpretation:** **504** is an HTTP status on the Realtime **upgrade** (or immediate gateway response), i.e. **upstream / edge** failure or overload, not a missing `server.ts` handler. The Issue #470 timeout is **absence of a completed assistant turn** within 60s (same suite shares process; can compound if sessions are slow or degraded). **EPIC-546** commits did not change `server.ts`; bisect vs last green release and **repeat** real-API runs still required to prove a deterministic repo regression vs API flake.

**Mitigation for qualification:** Run `npm test -- tests/integration/openai-proxy-run-ts-entrypoint.test.ts` (mock, **run.ts** path) in CI; keep real-API runs for ordering/tooling when keys are available.
