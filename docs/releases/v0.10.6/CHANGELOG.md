# Changelog - v0.10.6

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **@signal-meaning/voice-agent-backend 0.2.11 (Epic [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546), PR [#553](https://github.com/Signal-Meaning/dg_react_agent/pull/553)):** OpenAI proxy **packaging** — `selfsigned` and OpenTelemetry logging packages are **runtime `dependencies`** so consumers no longer hit `MODULE_NOT_FOUND: selfsigned` when using dev TLS paths. **TLS contract** — proxy listen mode uses **`OPENAI_PROXY_TLS_KEY_PATH`** / **`OPENAI_PROXY_TLS_CERT_PATH`** (PEM), **`OPENAI_PROXY_INSECURE_DEV_TLS`** for explicit dev self-signed TLS, or HTTP by default; generic **`HTTPS=1` is not** the proxy TLS switch. **`attachVoiceAgentUpgrade`** strips **`HTTPS`** from the OpenAI subprocess and sets insecure-dev TLS when the outer server is HTTPS and PEM paths are absent. **`NODE_ENV=production`** rejects insecure-dev TLS. Tests: `tests/packaging/voice-agent-backend-runtime-dependencies.test.ts`, `tests/openai-proxy-listen-tls.test.ts`, `tests/docs/openai-proxy-tls-integrator-docs.test.ts`. Integrator docs: `packages/voice-agent-backend/README.md`, `docs/BACKEND-PROXY/RUN-OPENAI-PROXY.md`, `docs/OPENAI-PROXY-PACKAGING.md`, `docs/issues/epic-546/`.

## Changed

- **@signal-meaning/voice-agent-react** republished at **0.10.6** with the same component sources as 0.10.5 (release train with backend 0.2.11).

## Backward Compatibility

✅ **Component API unchanged.**  
⚠️ **OpenAI proxy subprocess:** Hosts that relied on **`HTTPS=1` alone** for proxy TLS must use **`OPENAI_PROXY_INSECURE_DEV_TLS=1`**, PEM path env vars, or HTTP; see package README § *Migration from older behavior*. Integrators using **`attachVoiceAgentUpgrade`** with **`https: true`** are adjusted automatically unless they use PEM paths.

## References

- Epic [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546) — OpenAI proxy TLS, packaging, host integration
- PR [#553](https://github.com/Signal-Meaning/dg_react_agent/pull/553) — implementation merge to `main`
- Issue [#554](https://github.com/Signal-Meaning/dg_react_agent/issues/554) — release checklist
