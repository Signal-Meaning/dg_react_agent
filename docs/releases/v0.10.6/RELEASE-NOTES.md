# Release Notes - v0.10.6

**Release Date**: March 2026  
**Type**: Patch release

## Summary

v0.10.6 ships **@signal-meaning/voice-agent-backend@0.2.11** with **Epic [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)** (OpenAI proxy TLS, packaging, Voice Commerce–style host integration): runtime dependency fixes, explicit TLS env contract, `attachVoiceAgentUpgrade` subprocess behavior, and integrator documentation. **@signal-meaning/voice-agent-react** is **0.10.6** on the same release train (no component API changes from 0.10.5).

## Packages

- **@signal-meaning/voice-agent-react** — 0.10.6
- **@signal-meaning/voice-agent-backend** — 0.2.11

## Validation

- **CI-equivalent (mock):** `CI=true npm run test:mock`, `npm run lint`, `npm audit --audit-level=high` (clean after lockfile `npm audit fix` on this release branch).
- **Proxy:** `npm test -- tests/openai-proxy-listen-tls`, `npm test -- voice-agent-backend-runtime-dependencies`, `npm test -- openai-proxy-tls-integrator-docs`, `npm test -- tests/integration/openai-proxy-integration.test.ts` (mock).
- **Real API (when `OPENAI_API_KEY` available):** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` per `.cursorrules` for proxy releases.
- **Packaging smoke (maintainer):** `npm pack` in `packages/voice-agent-backend`, install tarball in a clean temp project, start proxy — see `docs/issues/epic-546/RELEASE-AND-QUALIFICATION.md`.

## See also

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) — React package layout
- [Issue #554](https://github.com/Signal-Meaning/dg_react_agent/issues/554) — release execution checklist
