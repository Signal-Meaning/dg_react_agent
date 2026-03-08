# TDD: Map input_audio_buffer.speech_stopped payload to UtteranceEnd

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 1)

**Goal:** Map upstream `input_audio_buffer.speech_stopped` payload fields (`channel`, `last_word_end`, and any word timings the API provides) to the component **UtteranceEnd** message instead of sending fixed defaults.

---

## Current behavior

- Proxy sends fixed `{ type: 'UtteranceEnd', channel: [0, 1], last_word_end: 0 }` for every `input_audio_buffer.speech_stopped`.
- No upstream payload fields are read (see [UPSTREAM-EVENT-COMPLETE-MAP.md](../../packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md)).

## Target behavior

- Read from upstream event: `channel` (or equivalent), `last_word_end` (or word-end timing), and any documented word-level data.
- Send **UtteranceEnd** with actuals when present; fall back to current defaults only when API omits fields.
- Component contract: `UtteranceEnd` with `channel: number[]`, `last_word_end: number` (see COMPONENT-PROXY-INTERFACE-TDD.md §2.1).

## TDD steps

1. **Red:** Add integration test: mock sends `input_audio_buffer.speech_stopped` with specific `channel` and `last_word_end`; assert client receives **UtteranceEnd** with those values.
2. **Green:** In server.ts (and translator if we add a mapper), read upstream fields and pass through to **UtteranceEnd**; use defaults when absent.
3. **Refactor:** Extract mapping to translator if useful; keep server thin.
4. Document API shape in UPSTREAM-EVENT-COMPLETE-MAP.md (and OpenAI Realtime server events reference).

## References

- [OpenAI Realtime: input_audio_buffer.speech_stopped](https://platform.openai.com/docs/api-reference/realtime-server-events/input_audio_buffer/speech_stopped)
- [COMPONENT-PROXY-INTERFACE-TDD.md](../../issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md) §2.1
