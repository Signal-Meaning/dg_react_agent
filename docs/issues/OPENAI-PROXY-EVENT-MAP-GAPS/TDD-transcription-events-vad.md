# TDD: Transcription events when server VAD is disabled

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 2a)

**Goal:** Confirm whether `conversation.item.input_audio_transcription.completed` and `.delta` are expected when server VAD is disabled (`turn_detection: null`). If not, document and optionally gate or skip mapping so we don’t rely on them in that configuration.

---

## Context

- We use `turn_detection: null` so the proxy controls commit and response.create (Issue #414, #462).
- Transcription events are tied to input audio; it’s unclear whether the API still emits them when server VAD is off.

## TDD steps

1. **Research:** Check OpenAI Realtime API docs for when `input_audio_transcription.completed` / `.delta` are emitted (VAD on vs off, or always when transcription is enabled).
2. **Document:** In UPSTREAM-EVENT-COMPLETE-MAP.md or this doc, state under what session config these events are expected.
3. **Test (if needed):** If the API does not send these when VAD is disabled, add a note in the map and optionally add a test that verifies behavior (e.g. no crash when they’re absent).
4. **Gate (optional):** If we only want to map transcription when we know the API will send it, add a conditional or document “transcription mapping only when …”.

## References

- [UPSTREAM-EVENT-COMPLETE-MAP.md](../../packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md)
- PROTOCOL-AND-MESSAGE-ORDERING.md §3.6 (Server VAD, turn_detection)
