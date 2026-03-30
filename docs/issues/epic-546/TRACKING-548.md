# Tracking — GitHub #548

**Issue:** [voice-agent-backend: audit openai-proxy runtime imports vs package.json dependencies](https://github.com/Signal-Meaning/dg_react_agent/issues/548)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Every `require()` / static `import` reachable when an integrator runs the **shipped** OpenAI proxy entrypoint must resolve from **`dependencies`** (or documented **`peerDependencies`**) of `@signal-meaning/voice-agent-backend`.

> **Parallel epic track:** [#555 — Real-API / protocol regression](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) (translator/server); separate from this **dependencies audit** issue.

## Repository status (accurate for current tree)

| Item | State |
|------|--------|
| **Default path: `run.ts` → `server.ts` (+ `listen-tls`, `logger`, `translator`, …)** | **`dependencies`** include `ws`, `dotenv`, `selfsigned`, `@opentelemetry/api-logs`, `@opentelemetry/sdk-logs`, `express` (see `package.json`). |
| **Automated guard** | **`tests/packaging/voice-agent-backend-runtime-dependencies.test.ts`** asserts `selfsigned` + both OpenTelemetry log packages are under **`dependencies`**. |
| **`speaker` (`speaker-sink.ts`)** | **Not** listed in `package.json`. Loaded only via **dynamic `require('speaker')`** when **`cli.ts`** uses `createSpeakerSink` — **CLI / optional playback**, not the default `run.ts` WebSocket proxy path. Treat as **documented optional** or future **`peerDependencies` / optional dep** if you guarantee CLI without install. |

**Historical note (stale):** OpenTelemetry packages were once **`devDependencies`-only**; they are now **`dependencies`** — matches `logger.ts` always loading on proxy startup.

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Packaging rule
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)

## Inventory (default proxy subprocess path)

| File / area | Runtime module | Default `run.ts` path? | In `dependencies`? |
|-------------|----------------|------------------------|---------------------|
| `server.ts` | `ws`, Node `http`/`https`/`path`/`fs`/`url` | Yes | `ws` yes; Node built-ins |
| `run.ts` | `dotenv`, `selfsigned` (branch), `./server`, `./listen-tls` | Yes | `dotenv`, `selfsigned` yes |
| `logger.ts` | `@opentelemetry/api-logs`, `@opentelemetry/sdk-logs` | Yes (via server) | Yes |
| `speaker-sink.ts` | `speaker` (dynamic) | **No** (CLI / `cli.ts`) | **No** — optional |

- [x] Core **`run.ts` + `createOpenAIProxyServer`** imports satisfied by **`dependencies`** (verified by packaging test + manual review above).
- [ ] **Optional:** Expand inventory for every file under `scripts/openai-proxy/` or add `AUDIT-OPENAI-PROXY-DEPS.md` if the table grows.

## TDD — RED

- [x] **Guard test** — `tests/packaging/voice-agent-backend-runtime-dependencies.test.ts` fails if required runtime packages drop out of **`dependencies`**.
- [ ] **Optional:** Minimal-install boot test (consumer tree) without monorepo hoisting — not required if packaging test + release smoke suffice.

## TDD — GREEN

- [x] **OpenTelemetry** packages promoted to **`dependencies`** (default path loads `logger.ts`).
- [x] **`selfsigned`** in **`dependencies`** ([#547](./TRACKING-547.md)).

## TDD — REFACTOR

- [x] `package.json` aligns with shipped proxy path; lockfile updated in repo.

## Definition of done

- [x] No known gap between **default** runtime path and **`dependencies`** (CLI `speaker` exception documented above).
- [x] Tests / CI guard: **`voice-agent-backend-runtime-dependencies`** (document in PR when closing #548).
- [ ] [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) packaging smoke for the **published** tarball when releasing.
- [ ] GitHub #548 closed with link to PR and this file.

## Verification log

- **2026-03-28:** `npm test -- voice-agent-backend-runtime-dependencies` (repo root) — **PASS**.
