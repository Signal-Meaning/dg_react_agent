# Tracking — GitHub #549

**Issue:** [OpenAI proxy: TLS from PEM paths (mkcert / operator-provided certs)](https://github.com/Signal-Meaning/dg_react_agent/issues/549)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Support **HTTPS/WSS** using operator-provided **key and certificate files** (e.g. mkcert), with **no** `selfsigned.generate()` on this path.

> **Parallel epic track:** [#555](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) — WS **application** protocol after tool calls; this issue is **TLS listen** only.

## Repository status (accurate for current tree)

| Item | State |
|------|--------|
| **Env vars** | **`OPENAI_PROXY_TLS_KEY_PATH`** and **`OPENAI_PROXY_TLS_CERT_PATH`** — both required together; implemented in **`listen-tls.ts`** and **`run.ts`** (reads PEM files, `https.createServer`). |
| **Unit tests** | **`tests/openai-proxy-listen-tls.test.ts`** — PEM mode, trim, fatal when only one path set. |
| **Integration** | **`run.ts`** wires `tlsMode.kind === 'pem'` to `fs.readFileSync` + `https.createServer`; full listen qualified via broader proxy tests / manual mkcert. |
| **Docs / spec** | Package README + **`tests/docs/openai-proxy-tls-integrator-docs.test.ts`** assert integrator docs mention PEM env names (cross-check [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md)). |

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Mode 2
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md)

## Env names (finalize in implementation)

- [x] Final names: **`OPENAI_PROXY_TLS_KEY_PATH`**, **`OPENAI_PROXY_TLS_CERT_PATH`** (shipped).
- [x] [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) and package README aligned (see doc regression test).

## TDD — RED

- [x] **Unit:** PEM vs fatal-only-one-path behavior in **`openai-proxy-listen-tls.test.ts`**.
- [ ] **Optional:** Dedicated integration test with **temp PEM files** on disk and assert listen (if not already covered elsewhere).

## TDD — GREEN

- [x] **`https.createServer`** with file-backed key/cert in **`run.ts`**.
- [x] **`createOpenAIProxyServer`** / **`run.ts`** wired for `pem` mode.
- [x] **`listen-tls`** pure resolver + tests green.

## TDD — REFACTOR

- [x] Shared resolver **`listen-tls.ts`** (no duplicated env parsing in `run.ts` beyond calling resolver).

## Definition of done

- [x] PEM mode documented for integrators ([#552](./TRACKING-552.md) / package README).
- [x] Real production keys not committed; tests use paths only (no secrets in repo).
- [ ] GitHub #549 closed with PR link and this file.

## Verification log

- **2026-03-28:** `npm test -- openai-proxy-listen-tls` — **PASS**.
