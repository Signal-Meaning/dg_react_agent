# Tracking — GitHub #550

**Issue:** [OpenAI proxy: scoped TLS env contract — avoid silent inheritance of host HTTPS=true](https://github.com/Signal-Meaning/dg_react_agent/issues/550)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

The proxy subprocess must **not** enable TLS solely because the host exported generic **`HTTPS=true`** for another service. TLS for the OpenAI proxy must follow **proxy-specific** configuration documented with the package.

> **Parallel epic track:** [#555](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) — unrelated to **env scoping** here.

## Repository status (accurate for current tree)

| Item | State |
|------|--------|
| **Implementation** | **`resolveOpenAIProxyListenMode`** in **`listen-tls.ts`** — **does not** read `HTTPS` / `HTTPS=1` for listen mode. |
| **Tests** | **`tests/openai-proxy-listen-tls.test.ts`** — `HTTPS: '1'` and `HTTPS: 'true'` → **`{ kind: 'http' }`**. |
| **run.ts** | Comment block documents EPIC-546 / Issue #550; uses only resolver output. |
| **Integrator docs** | Package README “What changed” explains migration off global **`HTTPS`** ([#552](./TRACKING-552.md)). |

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Deprecation / migration
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md)

## TDD — RED

- [x] **Test:** `HTTPS=1` / `HTTPS=true` without proxy TLS opt-in → **`http`** — `openai-proxy-listen-tls.test.ts`.
- [x] **Test:** PEM paths and/or **`OPENAI_PROXY_INSECURE_DEV_TLS`** → TLS modes as expected — same file.

## TDD — GREEN

- [x] Proxy-specific env contract in **`listen-tls.ts`** + **`run.ts`**.
- [x] **test-app / E2E** — use **`OPENAI_PROXY_INSECURE_DEV_TLS`** or PEM / scheme flags per Playwright config; generic **`HTTPS`** for Vite does not imply proxy TLS (see test-app docs).

## TDD — REFACTOR

- [x] **Centralized** in **`listen-tls.ts`**.

## Migration

- [x] Documented for integrators (package README + SPEC cross-links).
- [x] Changelog / release notes — covered in package README migration section (confirm in actual `CHANGELOG` when releasing via #554).

## Definition of done

- [x] No accidental TLS from global **`HTTPS`** alone (per tests).
- [x] Docs and examples updated.
- [ ] GitHub #550 closed with PR link and this file.

## Verification log

- **2026-03-28:** `npm test -- openai-proxy-listen-tls` — **PASS**.
