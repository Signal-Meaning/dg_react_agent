# Tracking — GitHub #547

**Issue:** [voice-agent-backend: ship selfsigned as runtime dependency (or drop HTTPS=1 require) — patch release](https://github.com/Signal-Meaning/dg_react_agent/issues/547)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Consumers who install `@signal-meaning/voice-agent-backend` as a normal dependency must not hit **`MODULE_NOT_FOUND: selfsigned`** when using the **documented dev TLS path** for the OpenAI proxy subprocess.

> **Parallel epic track:** [#555 — Real-API / protocol regression](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) covers OpenAI proxy **Realtime message handling** and test-app **function-call E2E**; it does not replace this issue’s packaging scope.

## Repository status (accurate for current tree)

| Item | State |
|------|--------|
| **`selfsigned` in `dependencies`** | **Yes** — `packages/voice-agent-backend/package.json` lists `"selfsigned": "^2.4.1"` under **`dependencies`** (not `devDependencies`). |
| **Runtime `require('selfsigned')`** | **Yes** — `scripts/openai-proxy/run.ts` loads it only on the **`insecureDevSelfSigned`** branch from `resolveOpenAIProxyListenMode` (i.e. **`OPENAI_PROXY_INSECURE_DEV_TLS=1`** / `true`, and not in production). Generic **`HTTPS=1` alone no longer enables** this path ([#550](./TRACKING-550.md)). |
| **Automated guard** | **`tests/packaging/voice-agent-backend-runtime-dependencies.test.ts`** — asserts `selfsigned` (and OpenTelemetry log packages) appear under **`dependencies`** so a consumer install resolves them. |
| **Package version in tree** | **`0.2.11`** in `packages/voice-agent-backend/package.json`. **Registry publish** and **GitHub #547 close** are still maintainer actions (see [#554](./ISSUE-554/TRACKING.md)). |

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) (packaging rule)
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)

## TDD — RED

- [x] **Guard test** — `tests/packaging/voice-agent-backend-runtime-dependencies.test.ts` fails if `selfsigned` is missing from **`dependencies`** (would reproduce the Voice Commerce **`MODULE_NOT_FOUND`** class of defect on consumer installs).
- [x] **Historical RED** — Before Option A, `selfsigned` lived only in `devDependencies`; documented in package README “What changed” section. *No longer reproducible on current `main` without reverting `package.json`.*

## TDD — GREEN

- [x] **Option A:** `selfsigned` is in **`dependencies`** in `packages/voice-agent-backend/package.json`.
- [x] **Option B:** *Not taken* — runtime still **`require('selfsigned')`** on the explicit insecure-dev TLS path; consumers who use that path need the module installed (Option A satisfies that).
- [x] Packaging tests pass; proxy can start with **`OPENAI_PROXY_INSECURE_DEV_TLS=1`** when `OPENAI_API_KEY` is set (manual smoke; TLS branch exercised in integration tests elsewhere).

## TDD — REFACTOR

- [x] TLS resolution centralized in **`listen-tls.ts`** (`resolveOpenAIProxyListenMode`) — shared with [#550](./TRACKING-550.md) / [#551](./TRACKING-551.md); avoids duplicating env logic in `run.ts`.

## Definition of done

- [x] `packages/voice-agent-backend/package.json` matches runtime needs (**`selfsigned` +** other shipped proxy imports under **`dependencies`** — see also [#548](./TRACKING-548.md)).
- [ ] [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) **Packaging smoke** (`npm pack` → clean install → start proxy) executed for the **published** tarball when cutting the release that claims this fix.
- [ ] Patch **published** to registry and **GitHub #547** closed with PR link — tracked with [#554](./ISSUE-554/TRACKING.md) / maintainer.
- [ ] This file updated with publish date / command when shipped.

## Verification log

_Add dated bullets: command, outcome._

- **2026-03-28:** `npm test -- voice-agent-backend-runtime-dependencies` (repo root) — **PASS** (asserts `selfsigned` and OTel log deps in `dependencies`).
