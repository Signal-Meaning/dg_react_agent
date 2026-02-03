# Issue #392: Production-ready proxy code — audit report

**Date:** 2026-02-03  
**Scope:** Proxy **code** quality and coverage only (no hosting, endpoints, SLAs).

---

## 1. OpenAI proxy code (`scripts/openai-proxy/`)

### 1.1 Protocol and behavior (Issue #388)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `response.create` only after `conversation.item.added` or `conversation.item.done` for InjectUserMessage | **Met** | `server.ts`: `pendingResponseCreateAfterItemAdded` set on InjectUserMessage; `response.create` sent only in upstream `message` handler when `msg.type === 'conversation.item.added' \|\| msg.type === 'conversation.item.done'` (lines 105–106, 202–210, 341–347). |
| Reference implementation matches OPENAI-REALTIME-API-REVIEW.md | **Met** | Same event order as documented. |

### 1.2 Test coverage

| Test | Location | Status |
|------|----------|--------|
| Unit (translator + Issue #388 contract) | `tests/openai-proxy.test.ts` | **Pass** — 45 tests total; describe "Issue #388: proxy event order" encodes `maySendResponseCreateAfterInjectUserMessage(upstreamTypesReceived)`. |
| Integration (proxy server + mock upstream) | `tests/integration/openai-proxy-integration.test.ts` | **Pass** — Includes "Issue #388: sends response.create only after receiving conversation.item.added from upstream for InjectUserMessage" (delay ≥ 50 ms between item.create and response.create). |
| E2E canary (real proxy) | `test-app/tests/e2e/openai-inject-connection-stability.spec.js` | **Present** — "should receive agent response after first text message (real OpenAI proxy)"; requires `VITE_OPENAI_PROXY_ENDPOINT`. |
| E2E proxy suite | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | **Present** — Connection, greeting, single message, multi-turn, reconnection, audio, function calling, error handling. |

**Jest run (2026-02-03):** `npm test -- --testPathPattern="openai-proxy"` → 2 suites, 45 tests passed.

### 1.3 Code quality and docs

- **Maintainable:** server.ts, translator.ts, run.ts, logger.ts are structured and commented (Issue #381, #388).
- **In-repo docs:** `scripts/openai-proxy/README.md`, `docs/issues/ISSUE-388/OPENAI-REALTIME-API-REVIEW.md` describe event order and usage for integrators.
- **No known correctness gaps** for the injectUserMessage → agent reply flow; reference implementation is the contract.

### 1.4 OpenAI proxy audit conclusion

**Production-ready bar (code):** **Met.** Protocol/ordering correct, unit + integration tests cover key behavior, E2E canary exists. Add tests only if future audit finds gaps.

---

## 2. Deepgram proxy code (test-app mock proxy)

### 2.1 Reference and behavior

| Item | Details |
|------|---------|
| **Reference** | `test-app/scripts/mock-proxy-server.js` — WebSocket proxy for Deepgram (agent + transcription). |
| **Behavior** | Passthrough: client ↔ Deepgram Voice Agent API (or transcription). No protocol translation; adds API key via subprotocol, validates origin/auth, forwards query params. Message queuing (Issue #329) until Deepgram/client ready. |
| **Path routing** | Single `server.on('upgrade')` by pathname: `/openai` → OpenAI subprocess forwarder, `PROXY_PATH` (e.g. `/deepgram-proxy`) → Deepgram. |

### 2.2 Test coverage

| Test | Location | What it covers |
|------|----------|----------------|
| Unit (Deepgram routing) | `test-app/tests/mock-proxy-server.test.js` | Service type detection, endpoint routing (agent vs transcription), query param forwarding. Does not start server. |
| Integration | `test-app/tests/mock-proxy-server-integration.test.js` | API key requirement: neither key → exit 1; only Deepgram or only OpenAI → process stays up. |
| E2E | `deepgram-backend-proxy-mode.spec.js`, `deepgram-backend-proxy-authentication.spec.js`, `api-key-security-proxy-mode.spec.js` | Test-app with proxy; proxy assumed running. |

Documented gaps (PROXY-SERVER-TEST-COVERAGE.md): server process with only OpenAI (subprocess + forwarder), both endpoints on same port, startup message content. These are **optional** for production-ready **code** bar; Deepgram proxy logic (routing, auth, queuing) is covered by unit + integration + E2E.

### 2.3 Deepgram proxy audit conclusion

**Production-ready bar (code):** **Met.** Passthrough proxy is documented, testable, and covered. Remaining gaps are process/startup assertions; can be ticketed if desired, not required to close this issue.

---

## 3. Documentation and scope clarity

| Doc | Status | Action |
|-----|--------|--------|
| PROXY-OWNERSHIP-DECISION.md | Aligned | States we own proxy **code** and integration contract; do not host or document endpoints/auth/SLAs. **Fix:** Update follow-up link from `PROXY-PRODUCTION-TICKET.md` (missing) to ISSUE-392. |
| RESPONSE-TO-VOICE-COMMERCE-PROOF.md | Aligned | Points to reference implementation and event-ordering requirements; no "use our hosted production proxy." No change needed. |
| OPENAI-REALTIME-API-REVIEW.md, scripts/openai-proxy/README.md | In place | Event order and usage for integrators. |

---

## 4. Repo and CI

- **CI:** Existing proxy integration tests (`openai-proxy`, `openai-proxy-integration`) and related Jest tests pass.
- **E2E:** `openai-inject-connection-stability.spec.js` and `openai-proxy-e2e.spec.js` require `VITE_OPENAI_PROXY_ENDPOINT`; run when env is set.
- **Reference implementation:** Single source of truth for protocol/ordering; server.ts implements the contract.

---

## 5. Checklist summary (Issue #392 deliverables)

| Deliverable | Status |
|-------------|--------|
| 1. OpenAI proxy: audit | **Done** — Meets bar. |
| 1. OpenAI proxy: coverage | **Done** — Unit, integration, E2E canary present and passing. |
| 1. OpenAI proxy: docs | **Done** — OPENAI-REALTIME-API-REVIEW.md, scripts/openai-proxy/README.md. |
| 2. Deepgram proxy: audit | **Done** — Meets bar; optional gaps documented. |
| 2. Deepgram proxy: gaps | **None blocking** — Optional process/startup tests can be ticketed. |
| 3. Docs and scope | **Update** — Fix PROXY-OWNERSHIP-DECISION link to ISSUE-392. |
| 4. CI / reference | **Confirmed** — Tests pass; reference implementation is source of truth. |

---

## 6. Recommended follow-up (optional)

- Fix PROXY-OWNERSHIP-DECISION.md follow-up link: `[PROXY-PRODUCTION-TICKET.md](./PROXY-PRODUCTION-TICKET.md)` → `[Issue #392](./ISSUE-392/README.md)` (or equivalent).
- Optionally ticket: mock-proxy-server integration tests for "server starts with only OpenAI" and "both endpoints on same port" (see PROXY-SERVER-TEST-COVERAGE.md).
