# Changelog - v0.11.0

**Release Date:** April 2026  
**Release Type:** Minor Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Added

- **Test-app Live mode (Issue [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)):** Presentation-oriented Live flow — Start control, `LiveModeView`, E2E smoke coverage, and live tool row during function calls (integrator pattern in test-app; not a new required component API).
- **OpenAI proxy — commit scheduling (Issue [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)):** Phase 2 scheduler for audio commit timing (continuous mic and close flush), first-commit threshold and orphan tail handling, optional Server VAD configuration and API idle bounds (see proxy scripts and tests).
- **OpenAI proxy — observability (Issue [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565), PR [#567](https://github.com/Signal-Meaning/dg_react_agent/pull/567)):** OTel-aligned logging — explicit service resource, trace context derived from `trace_id`, compact console exporter to avoid noisy undefined trace fields.
- **Test-app diagnostics:** Mic timing debug wiring (e.g. correlating mic click, `getUserMedia`, first binary uplink to proxy commit) for OpenAI proxy qualification; E2E and backend health helpers as documented in issue folders.

## Changed

- **Idle timeout logging (Issue [#559](https://github.com/Signal-Meaning/dg_react_agent/issues/559), PR [#568](https://github.com/Signal-Meaning/dg_react_agent/pull/568)):** Debounced debug-level idle start log; E2E and troubleshooting docs aligned on `__idleTimeoutStarted__`.
- **OpenAI proxy:** Audio commit rescheduling after response ends; default Server VAD path and related test qualification with backend `.env` (see merged PRs on `main`).
- **@signal-meaning/voice-agent-backend** released as **0.2.12** with this train (proxy, logging, packaging alignment as in repo).

## Fixed

- **Mic / PCM / OpenAI path (Issue [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)):** PCM timing after Settings, `stopAudioCapture` behavior, Live OpenAI E2E idle URL alignment, proxy and test-app fixes recorded in ISSUE-560 docs and tests.
- **Integration / E2E stability:** Real-API integration path stabilization (e.g. Issue [#489](https://github.com/Signal-Meaning/dg_react_agent/issues/489) tool-choice requirements), serial workers for `USE_REAL_APIS=1` Playwright runs, backend `/health` / `/ready` coverage in tests.

## Backward Compatibility

- **Component public API:** No intentional breaking changes to `DeepgramVoiceInteraction` props or ref handle signatures; behavior improvements around audio capture and proxy timing may affect edge cases — see [API-CHANGES.md](./API-CHANGES.md) and [NEW-FEATURES.md](./NEW-FEATURES.md).
- **OpenAI proxy:** Integrators should re-run proxy-mode and (when possible) real-API checks after upgrade; see [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md).

## References

- Release checklist: Issue [#570](https://github.com/Signal-Meaning/dg_react_agent/issues/570)
- Epic rollup: PR [#569](https://github.com/Signal-Meaning/dg_react_agent/pull/569) (epic [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546))
