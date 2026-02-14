# Issue #439: OpenAI proxy — start() with no options must not request transcription

**GitHub:** [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439)

---

## Summary

When the host uses an OpenAI proxy (`proxyEndpoint` URL containing `/openai`) and starts the voice session with **no arguments** to `ref.current.start()`, while also passing `transcriptionOptions` and/or `endpointConfig`, the component throws "Failed to create transcription manager" (surfaced as "Failed to start voice interaction"). For an OpenAI proxy, transcript and VAD are delivered over the single agent WebSocket; there is no separate Deepgram transcription service. The component already skips creating a transcription manager in `createTranscriptionManager()` for OpenAI proxy, but `start()` does not use that same inference when deciding whether to start transcription.

**Resolution (Option A):** When `proxyEndpoint` indicates an OpenAI proxy, the component treats the session as agent-only and does not request or create a transcription manager, regardless of `transcriptionOptions` / `endpointConfig`. **Implemented** via TDD; see [TDD-PLAN.md](./TDD-PLAN.md). Tests in `tests/lazy-initialization.test.js` (describe "OpenAI proxy start() contract (Issue #439)"); docs in `docs/BACKEND-PROXY/MIGRATION-GUIDE.md` ("OpenAI proxy (agent-only)").

---

## References

- [TDD-PLAN.md](./TDD-PLAN.md) — RED/GREEN/REFACTOR plan
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` — `start()`, `createTranscriptionManager()`
- Test-app: `test-app/src/App.tsx` — workaround using `start({ agent: true, transcription: false })` when proxy contains `/openai`
