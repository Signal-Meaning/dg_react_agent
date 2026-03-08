# TDD: Transcription events when server VAD is disabled

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 2a)

**Goal:** Confirm whether `conversation.item.input_audio_transcription.completed` and `.delta` are expected when server VAD is disabled (`turn_detection: null`). If not, document and optionally gate or skip mapping so we don’t rely on them in that configuration.

---

## Context

- We use `turn_detection: null` so the proxy controls commit and response.create (Issue #414, #462).
- Transcription events are tied to input audio; the question was whether the API still emits them when server VAD is off.

## Research outcome (Issue #495)

**Conclusion:** `input_audio_transcription.completed` and `.delta` **are expected** when server VAD is disabled (`turn_detection: null`), as long as **transcription is enabled** in the session (`session.audio.input.transcription` with a model) and the client/proxy **commits** the input audio buffer.

- **Source:** [Realtime transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription/): *"You can also disable VAD by setting the audio.input.turn_detection property to null, and control when to commit the input audio on your end."* Transcription is *"Optional asynchronous transcription of input audio"* — it runs on committed audio. Turn detection only controls **who** commits (server vs client); it does not gate whether transcription runs.
- **Implication:** With `turn_detection: null`, the proxy commits the buffer manually; once committed, the API creates a conversation item and runs transcription on that audio (if `transcription` is configured). So we **do** expect `.completed` and `.delta` in our configuration when the proxy has enabled transcription in `session.update`. No gate or special handling needed; mapping stays as-is.

## TDD steps

1. **Research:** Check OpenAI Realtime API docs for when `input_audio_transcription.completed` / `.delta` are emitted (VAD on vs off, or always when transcription is enabled). **Done:** see Research outcome above.
2. **Document:** In UPSTREAM-EVENT-COMPLETE-MAP.md or this doc, state under what session config these events are expected. **Done:** see below and event map note.
3. **Test (if needed):** No change required; existing transcription tests (e.g. Issue #497 delta accumulator) already cover the flow. No crash when events are absent (e.g. if transcription is disabled) — we simply don’t receive them.
4. **Gate (optional):** Not needed; transcription events are expected when transcription is enabled regardless of `turn_detection`.

## References

- [UPSTREAM-EVENT-COMPLETE-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md)
- [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription/) — turn_detection null + manual commit; transcription runs on committed audio when enabled
- PROTOCOL-AND-MESSAGE-ORDERING.md §3.6 (Server VAD, turn_detection)
