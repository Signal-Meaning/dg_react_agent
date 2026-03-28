# Tracking — GitHub #552

**Issue:** [Docs: OpenAI proxy supported TLS modes and host integration (Voice Commerce contract)](https://github.com/Signal-Meaning/dg_react_agent/issues/552)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Publish a **single clear story** for integrators (including Voice Commerce) covering:

1. **HTTP localhost** — when to use; mixed-content / browser caveats.
2. **Bring-your-own-cert** — PEM env vars; mkcert alignment with main API optional note.
3. **Optional built-in dev cert** — explicit opt-in only; trust warnings.

Include the **packaging rule**: runtime `require()` ⇒ listed under `dependencies` (or documented peers).

## Repository status (accurate for current tree)

All checklist items below are **[x]** in-repo. Remaining work is **closing GitHub #552** after the docs ship in a merged PR.

**Related (function-call / partners):** [#555](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) and [BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md) — test-app may include **`e2eVerify`** in tool JSON for OpenAI-proxy E2E; third parties are not required to copy that field.

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md)
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)

## Checklist

- [x] Update `packages/voice-agent-backend/README.md` with **Supported modes** section (§ OpenAI proxy: TLS modes and subprocess environment).
- [x] Add or update repo `docs/` cross-links: [RUN-OPENAI-PROXY.md](../../BACKEND-PROXY/RUN-OPENAI-PROXY.md), [BACKEND-PROXY/README.md](../../BACKEND-PROXY/README.md), [OPENAI-PROXY-PACKAGING.md](../../OPENAI-PROXY-PACKAGING.md), `scripts/openai-proxy/README.md`.
- [x] Document **subprocess env contract**: `HTTPS` ignored by `run.ts`; `attachVoiceAgentUpgrade` strips `HTTPS` and sets `OPENAI_PROXY_INSECURE_DEV_TLS` when appropriate.
- [x] Document **migration** from pre-epic `HTTPS=1` self-signed behavior.
- [x] Add **packaging rule** and pointer to `voice-agent-backend-runtime-dependencies.test.ts`.
- [x] Voice Commerce / EPIC-1131 traceability (neutral) in package README.
- [x] Regression tests: `tests/docs/openai-proxy-tls-integrator-docs.test.ts`.

## Definition of done

- [x] New developer can configure all supported modes from docs alone (primary: package README + RUN-OPENAI-PROXY).
- [x] Examples use final env var names from implementation.
- [x] Links to GitHub #546 / #552 and `docs/issues/epic-546/`.
- [ ] GitHub #552 closed with PR link (maintainer action after merge).

## Verification log

- **2026-03-28:** `npm test -- openai-proxy-tls-integrator-docs` — pass.
