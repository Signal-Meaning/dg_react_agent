# TDD plan — EPIC-546 (OpenAI proxy TLS, packaging, and qualification)

**Rule:** Tests define behavior first (**🔴 RED**), then minimal implementation (**🟢 GREEN**), then **🟡 REFACTOR** while staying green. This matches `.cursorrules` and the explicit **TDD → PR merge** lane in [ISSUE-555/TRACKING.md](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) for proxy/protocol regressions.

**Order:** Complete **RED → GREEN → REFACTOR → merged PR** for the change set **before** treating [pre-release / #554](./ISSUE-554/TRACKING.md) checkboxes as the source of truth for shipping.

---

## Tracking index (this epic)

Statuses follow each **TRACKING*.md** / **ISSUE-*/TRACKING.md** (update this table when checkboxes change).

| Workstream | Status | Tracking file | Role |
|------------|--------|---------------|------|
| #547 `selfsigned` / consumer install | **Done in tree** — **publish + close #547** via [#554](./ISSUE-554/TRACKING.md) | [TRACKING-547.md](./TRACKING-547.md) | Packaging |
| #548 Runtime imports vs `dependencies` | **Done in tree** (default path); **CLI `speaker`** optional / not in `deps` — **close #548** on merge | [TRACKING-548.md](./TRACKING-548.md) | Packaging |
| #549 TLS from PEM paths | **Done in tree** — **close #549** on merge | [TRACKING-549.md](./TRACKING-549.md) | Behavior |
| #550 Scoped TLS env (`HTTPS` inheritance) | **Done in tree** — **close #550** on merge | [TRACKING-550.md](./TRACKING-550.md) | Behavior |
| #551 Dev TLS opt-in + production guard | **Done in tree** — **close #551** on merge | [TRACKING-551.md](./TRACKING-551.md) | Behavior |
| #552 Integrator docs | **Done in tree** — close **GitHub #552** on merge | [TRACKING-552.md](./TRACKING-552.md) | Docs + doc tests |
| #554 **Release execution** (publish) | **Pre-release in progress** — checklist started 2026-03-28 on `release/v0.10.6`; publish / GitHub Release not done | [ISSUE-554/TRACKING.md](./ISSUE-554/TRACKING.md) | Pre-release / ship (not a substitute for TDD) |
| #555 **Real-API regression + protocol** | **In progress** — TDD 🔴/🟢 evidenced; 🟡 REFACTOR, merged PR, and pre-release `USE_REAL_APIS` logs **open** | [ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) | `USE_REAL_APIS`, Issue #470 path, TDD checklist + verification log |

Sub-issues **#547–#551** use per-file **TDD — RED / GREEN / REFACTOR** sections. **#555** adds a rollup table + PR checklist; **#554** separates **TDD → PR** from **release execution**.

---

## Scope of testing

| Layer | Location (typical) | Use for EPIC-546 |
| ----- | ------------------ | ---------------- |
| **Unit (proxy)** | `tests/openai-proxy.test.ts` (repo root) | Translator/server behavior, e.g. **`response.output_text.done` → assistant `ConversationText`** after tool output ([Issue #555](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md)) |
| **Unit** | `tests/` (Jest, repo root) | Env parsing, TLS mode selection, PEM/selfsigned guards, path resolution |
| **Integration** | `tests/integration/openai-proxy-integration.test.ts` | Proxy creation, WS path, HTTPS/WSS fixtures; **mock** upstream; **optional `USE_REAL_APIS=1`** for release qualification |
| **Integration (run.ts)** | `tests/integration/openai-proxy-run-ts-entrypoint.test.ts` | Spawn `run.ts` like test-app; mock upstream; TLS env sanitization |
| **Integration (test-app backend)** | `test-app/tests/function-call-endpoint-integration.test.js`, `backend-integration.test.js` | `POST /function-call` contract, including optional **`e2eVerify`** in tool JSON for E2E/integration parity |
| **Packaging / install smoke** | [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) | `npm pack` + production `npm install` + spawn proxy; no `MODULE_NOT_FOUND` |
| **E2E** | `test-app/tests/e2e/` | From **test-app** only; OpenAI-proxy **6** / **6b** use **`fc-e2e-verify`** + literal **`dg-openai-proxy-fc-e2e-v1`** in agent-response (same contract as integration Issue #470); see `test-app/tests/e2e/README.md` |
| **Doc contract (#552)** | `tests/docs/openai-proxy-tls-integrator-docs.test.ts` | Integrator docs: TLS env names, `attachVoiceAgentUpgrade`, packaging rule, epic link |

---

## Red → Green → Refactor (per issue)

1. **🔴 RED** — Add or extend a test that fails under old behavior or captures the defect (consumer install, wrong env, missing `ConversationText`, fragile E2E matcher, etc.). Prefer a **committed failing test** before the GREEN commit when practical.
2. **🟢 GREEN** — Minimal code + `package.json`/docs changes until automated tests pass (mock-first for CI).
3. **🟡 REFACTOR** — Names, helpers, structure; tests stay green.

For **#555**, also record evidence and check off **REFACTOR** / **merged PR** in [ISSUE-555/TRACKING.md](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md).

---

## Commands (reference)

**Repo root**

- `npm test` — full Jest (mock-first CI expectation).
- `npm test -- tests/openai-proxy.test.ts` — OpenAI proxy unit tests (includes Issue #555 translator/server cases).
- `npm test -- tests/integration/openai-proxy-integration.test.ts` — integration (mock upstream unless real-API env).
- `npm test -- tests/integration/openai-proxy-run-ts-entrypoint.test.ts` — **run.ts** entry (mock upstream).
- `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — **release / qualification** when keys available; see workspace rules for proxy fixes.
- `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts -t "Issue #470 real-API"` — targeted Issue #470 function-call + real HTTP backend path.

**test-app**

- `npm test` — Jest including `/function-call` integration tests.
- `USE_REAL_APIS=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6. Simple function calling|6b. Issue #462"` — partner-style function call + real `POST /function-call` + **`e2eVerify`** assertion (requires proxy, keys, backend per README).

**voice-agent-backend** — follow root and `packages/voice-agent-backend/package.json` scripts where applicable.

---

## Dependencies and mocks

- Do not invent upstream messages to turn tests green; fix protocol, packaging, or expectations.
- Packaging tests should simulate a **consumer tree** (no published package `devDependencies`), not only monorepo hoisting.

---

## Completion

Epic TDD expectations are met when:

- Each **open** sub-issue tracking file (#547–#551, #555 as applicable) has its **Definition of done** and **TDD** checklists satisfied (or explicitly N/A with note).
- **#554** [release execution](./ISSUE-554/TRACKING.md) is checked off when you **publish** (separate from #555 TDD → PR).
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) is executed for the version(s) you ship.

**#555 close:** Follow **Definition of done** in [ISSUE-555/TRACKING.md](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) (TDD checklist + pre-release logs as required).
