# New Features - v0.10.0

This minor release improves **OpenAI proxy event mapping** (Epic #493), **component-owned context** (Issue #490), **test and release process**, and **E2E reliability**. No new public component APIs are added.

---

## Epic #493: OpenAI proxy event mapping

### Overview

When using the component with the OpenAI proxy (e.g. `@signal-meaning/voice-agent-backend`), transcription and agent events are now mapped more completely and consistently: delta accumulation for `input_audio_transcription.delta`, full transcription completed/delta payloads, UtteranceEnd from `speech_stopped` and `last_word_end`, and function_call content as ConversationText for parity with Deepgram behavior. Unmapped events are logged as warnings for debugging.

### Benefits

- More accurate and complete conversation and transcription state in the UI.
- Easier debugging via clear warnings for unknown event types.
- Documentation for transcription events when VAD is disabled.

### References

- Epic #493; Issues #494–#500, #497, #498.
- Component and proxy docs in `docs/` and `packages/voice-agent-backend`.

---

## Component-owned context and settings (Issue #490, #379)

### Overview

The component’s internal context and Settings pipeline (getHistoryForSettings, buildSettingsMessage, useSettingsContext) are covered by additional unit and integration tests. Settings structure is validated in tests (Issue #379). No change to the public API.

### Benefits

- Higher confidence in context and Settings behavior on connect and reconnect.
- Clearer test coverage for integrators who rely on agent context and history.

---

## Release and test process

### Overview

- Release issue templates now state that **Pre-Release Preparation** must be completed before version bump or publish; checklist body order puts Pre-Release first.
- E2E in proxy mode: 191 tests passed, 60 skipped. Real-API test strategy and USE_REAL_APIS / USE_PROXY_MODE are documented.

### References

- `.github/ISSUE_TEMPLATE/release-checklist.md`, `quick-release.md`.
- `test-app/tests/e2e/README.md`, `docs/development/TEST-STRATEGY.md`.

---

## Backend package (voice-agent-backend 0.2.6)

### Overview

**@signal-meaning/voice-agent-backend** is released as **0.2.6** alongside this component release. Upgrade to 0.2.6 when using the proxy or backend; see that package’s README and release notes for backend-specific changes.

---

## References

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog for v0.10.0
- [API-CHANGES.md](./API-CHANGES.md) — API surface summary
- [EXAMPLES.md](./EXAMPLES.md) — Installation and usage
