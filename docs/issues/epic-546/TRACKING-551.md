# Tracking — GitHub #551

**Issue:** [OpenAI proxy: explicit insecure dev TLS + forbid in-process cert generation in production](https://github.com/Signal-Meaning/dg_react_agent/issues/551)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

- In-process self-signed certificate generation only when a **dedicated** opt-in env is set: **`OPENAI_PROXY_INSECURE_DEV_TLS=1`** or **`true`**.
- When **`NODE_ENV=production`**, **do not** use in-process dev TLS — resolver returns **`fatal`**; use HTTP or PEM paths only.

> **Parallel epic track:** [#555](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) — production **cert** policy remains this issue; #555 is **upstream Realtime** behavior.

## Repository status (accurate for current tree)

| Item | State |
|------|--------|
| **Env name** | **`OPENAI_PROXY_INSECURE_DEV_TLS`** (final; documented in README + `run.ts`). |
| **`listen-tls.ts`** | **`insecureDevSelfSigned`** only when flag truthy and **not** `NODE_ENV=production`. |
| **Production + flag** | **`fatal`** with message forbidding dev TLS in production. |
| **`run.ts`** | **`require('selfsigned')`** only inside **`insecureDevSelfSigned`** branch. |
| **`dependencies`** | **`selfsigned`** present for consumers on that path ([#547](./TRACKING-547.md)). |

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Mode 3, Priority
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)

## TDD — RED

- [x] **`NODE_ENV=production` + `OPENAI_PROXY_INSECURE_DEV_TLS=1`** → **`fatal`** — `openai-proxy-listen-tls.test.ts`.
- [x] **Non-production + flag** → **`insecureDevSelfSigned`** — same file.
- [x] **Flag unset** → **`http`** (no `selfsigned` branch in resolver; `run.ts` does not load `selfsigned` on HTTP path).

## TDD — GREEN

- [x] Guards in **`resolveOpenAIProxyListenMode`** + **`run.ts`** branch.
- [x] **`dependencies`** include **`selfsigned`** for dev TLS path.

## TDD — REFACTOR

- [x] Clear **`fatal`** message string for prod + dev TLS (see `listen-tls.ts`).

## Definition of done

- [x] Behavior documented in integrator docs ([#552](./TRACKING-552.md) / README).
- [ ] GitHub #551 closed with PR link and this file.

## Verification log

- **2026-03-28:** `npm test -- openai-proxy-listen-tls` — **PASS** (includes production + insecure dev cases).
