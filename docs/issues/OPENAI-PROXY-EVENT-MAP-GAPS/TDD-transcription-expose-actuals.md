# TDD: Expose transcription actuals; defaults only when absent

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 2b)

**Goal:** For `conversation.item.input_audio_transcription.completed` (and delta where applicable), pass through API fields (e.g. `alternatives`, `words`, `start`, `duration`, `channel`) when present. Use fixed defaults only when the API omits them.

---

## Current behavior

- **completed:** Only `transcript` is used; **Transcript** is built with fixed `channel: 0`, `channel_index: [0]`, `start: 0`, `duration: 0`, and a single `alternatives` entry with `confidence: 1`, `words: []` (translator.ts `mapInputAudioTranscriptionCompletedToTranscript`).
- **delta:** Only `delta` is used; accumulation is separate (see epic Gap 3).

## Target behavior

- Read from upstream: `transcript`, `alternatives`, `words`, `start`, `duration`, `channel` / `channel_index`, and any other documented fields.
- Map to component **Transcript** shape: use actuals when present; substitute defaults only for missing fields.
- Preserve component contract (Transcript type) so existing handlers keep working.

## TDD steps

1. **Red:** Add unit tests (and/or integration tests) that feed events with partial and full payloads; assert output **Transcript** contains actuals where provided and defaults only where omitted. **Done:** integration test `Issue #496: input_audio_transcription.completed with start/duration/channel → Transcript has actuals`.
2. **Green:** Extend `mapInputAudioTranscriptionCompletedToTranscript` (and delta mapper if needed) to accept and pass through the additional fields; update types/interfaces. **Done:** translator.ts — optional `start`, `duration`, `channel`, `channel_index`, `alternatives` on completed; optional `start`, `duration`, `channel`, `channel_index` on delta; mappers use actuals when present, defaults when absent.
3. **Refactor:** Keep mapper pure; document API shape in UPSTREAM-EVENT-COMPLETE-MAP.md. **Done.**
4. Verify component/onTranscriptUpdate still receives a valid shape. Component expects TranscriptResponse (channel, channel_index, start, duration, alternatives); mapper output matches.

## References

- [OpenAI Realtime: conversation.item.input_audio_transcription](https://platform.openai.com/docs/api-reference/realtime-server-events)
- translator.ts: `OpenAIInputAudioTranscriptionCompleted`, `ComponentTranscript`
