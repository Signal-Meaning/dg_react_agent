# Changelog - v0.11.1

**Release Date:** April 2026  
**Release Type:** Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **@signal-meaning/voice-agent-backend 0.2.13 (Issue [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571), PR [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572)):** OpenAI relay **`createOpenAIWss`** (`packages/voice-agent-backend/src/attach-upgrade.js`) now **queues** client→upstream WebSocket frames until the upstream socket is **`OPEN`**, matching **`createDeepgramWss`**. Prevents **Settings** (and other early frames) from being dropped when the browser connects through the Express upgrade relay before the translator handshake completes (symptom: no `session.update`, audio stuck in `pendingAudioQueue`, no agent response). Regression test: `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js`.

## Changed

- **@signal-meaning/voice-agent-react** republished at **0.11.1** with the same component sources as **0.11.0** (release train with backend **0.2.13**).

## Backward Compatibility

- **Component public API:** Unchanged.
- **Backend relay:** Integrators using **browser → `attachVoiceAgentUpgrade` OpenAI path → translator** should upgrade to **0.2.13** for the race fix; direct translator connections were unaffected.

## References

- Issue [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571) — defect analysis and checklist
- PR [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572) — implementation merge to `main`
