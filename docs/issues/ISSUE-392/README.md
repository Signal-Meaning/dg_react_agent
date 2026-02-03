# Issue #392: Production-ready proxy code (OpenAI + Deepgram)

**GitHub:** [Issue #392](https://github.com/Signal-Meaning/dg_react_agent/issues/392)  
**Scope:** Proxy **code** quality and coverage only. This team delivers **component technology** only; no production hosting, no endpoint/auth docs, no SLAs or support ownership.

---

## Context

- We own the **proxy code** (OpenAI Realtime and Deepgram) in this repo and the **integration contract** with third parties via the proxy (and direct) API. See [PROXY-OWNERSHIP-DECISION.md](../ISSUE-388/PROXY-OWNERSHIP-DECISION.md).
- **Team scope:** We deliver **component technology only**. We do **not** host production proxy services, document endpoints/auth for a hosted service, or own SLAs/support. We focus on **integration with 3pp via the proxy (and direct) API**.
- **"Production-ready" here** means **code quality and test coverage** of the proxy implementations, not "we run a hosted production service." We may already be there after the Issue #388 defect correction (proxy event ordering, integration test, E2E canary).

## Goal

Ensure proxy **code** (OpenAI, Deepgram) meets a production-ready bar for **quality and coverage**. Reference implementations stay the source of truth for protocol and ordering; any gaps from an audit are addressed or explicitly deferred.

## Definition of "production ready" (code)

For each proxy (OpenAI, Deepgram), "production ready" means **code** bar only:

- [ ] **Protocol and behavior** match the reference implementation and docs (e.g. OpenAI: `response.create` only after `conversation.item.added` per Issue #388).
- [ ] **Test coverage:** Unit and/or integration tests cover the proxy behavior (e.g. ordering, translation); E2E canary exists for the injectUserMessage → agent reply flow where applicable.
- [ ] **Code quality:** Maintainable, documented (in-repo), no known correctness gaps; reference implementation is the contract for anyone integrating (us or 3pp).

**Out of scope for this team:** Hosting, endpoint URLs, auth docs for a hosted service, runbooks, SLAs, support ownership.

## Scope

| Proxy | Reference in repo | Notes |
|-------|-------------------|--------|
| **OpenAI Realtime** | `scripts/openai-proxy/` (server.ts, translator.ts, run.ts) | Translates component protocol ↔ OpenAI Realtime API. Issue #388 fix (event ordering) in place. |
| **Deepgram** | test-app mock proxy, Deepgram Voice Agent API usage | Backend the component uses for Deepgram-based voice agent flows. |

## Deliverables (checklist)

### 1. OpenAI proxy code

- [ ] **Audit:** Confirm `scripts/openai-proxy/` meets production-ready code bar (protocol, ordering per Issue #388, tests).
- [ ] **Coverage:** Unit tests (`tests/openai-proxy.test.ts`) and integration test (`tests/integration/openai-proxy-integration.test.ts`) cover key behavior; E2E canary `openai-inject-connection-stability.spec.js` passes with real proxy. Add tests only if audit finds gaps.
- [ ] **Docs:** In-repo docs (e.g. OPENAI-REALTIME-API-REVIEW.md, scripts/openai-proxy/README.md) describe event order and usage for integrators.

### 2. Deepgram proxy code

- [ ] **Audit:** Confirm test-app mock proxy (and any Deepgram integration paths) meet production-ready code bar; tests and coverage adequate.
- [ ] **Gaps:** Address or ticket any gaps found (no hosting or endpoint docs in scope).

### 3. Documentation and scope clarity

- [ ] Update [PROXY-OWNERSHIP-DECISION.md](../ISSUE-388/PROXY-OWNERSHIP-DECISION.md) if needed: we own proxy **code** and integration contract; we do not host or document endpoints/auth/SLAs.
- [ ] Ensure [RESPONSE-TO-VOICE-COMMERCE-PROOF.md](../ISSUE-388/RESPONSE-TO-VOICE-COMMERCE-PROOF.md) and any customer-facing wording align: point to **reference implementation** and event-ordering requirements for integrators; no "use our hosted production proxy" unless another team provides it.

### 4. Repo and CI

- [ ] CI: existing proxy integration and E2E tests pass.
- [ ] Reference implementation is the single source of truth for protocol/ordering; no drift.

## References

- **Ownership decision:** [PROXY-OWNERSHIP-DECISION.md](../ISSUE-388/PROXY-OWNERSHIP-DECISION.md)
- **OpenAI proxy reference:** `scripts/openai-proxy/` (README)
- **OpenAI event order (Issue #388):** [OPENAI-REALTIME-API-REVIEW.md](../ISSUE-388/OPENAI-REALTIME-API-REVIEW.md)
- **Customer response:** [RESPONSE-TO-VOICE-COMMERCE-PROOF.md](../ISSUE-388/RESPONSE-TO-VOICE-COMMERCE-PROOF.md)
- **Issue #381:** OpenAI Realtime proxy support
- **Issue #388:** OpenAI upstream closes after first message — fix in proxy (event ordering)

## Acceptance criteria (issue complete when)

- Audit confirms proxy code meets production-ready bar (quality, coverage) or gaps are ticketed.
- Scope is clearly documented: component technology + proxy code + 3pp integration only; no hosting/endpoints/SLAs.
- PROXY-OWNERSHIP-DECISION and customer-facing wording align with "reference implementation + integration" (no hosted-service commitment unless another team owns it).

## Notes for implementer

- This is a **verify/confirm** ticket: we may already be at the bar after Issue #388. Run the audit first; only add work if gaps exist.
- If another team will provide a **hosted** production proxy, that is a separate effort; this ticket is about the **code** we deliver in this repo.
