# Proxy ownership: we own the code and integration contract

**Decision:** We take ownership of **both** proxy implementations (OpenAI Realtime and Deepgram) as **code** in this repo. They must be **production-ready** in the sense of **code quality and test coverage**. This team delivers **component technology only**; we do not host production proxy services, document endpoint/auth for a hosted service, or own SLAs/support.

## Scope

- **OpenAI Realtime proxy** — Reference implementation: `scripts/openai-proxy/` (Issue #381, #388). We own the code and the protocol/ordering contract (e.g. `response.create` only after `conversation.item.added`).
- **Deepgram proxy** — Reference: test-app mock proxy and Deepgram Voice Agent API integration. We own the code and integration behavior.

## Implications

- **Integrators (customers or 3pp)** use our **reference implementation** (or equivalent that follows the same protocol/ordering) for correct behavior (e.g. InjectUserMessage → agent reply). We document event order and usage in-repo (e.g. OPENAI-REALTIME-API-REVIEW.md, scripts/openai-proxy/README.md).
- **We focus on** integration with third parties via the proxy (and direct) API. We do **not** document endpoints, auth, or usage for a **hosted** production backend unless another team provides and owns that backend.
- **Reference implementations** in the repo remain the source of truth for protocol and ordering.

## Follow-up

- **This team:** Ensure proxy code meets production-ready bar (quality, coverage); see [PROXY-PRODUCTION-TICKET.md](./PROXY-PRODUCTION-TICKET.md).
- **If a hosted production proxy is provided:** That is owned by another team; we keep reference implementation aligned with the contract so integrators can rely on it.
