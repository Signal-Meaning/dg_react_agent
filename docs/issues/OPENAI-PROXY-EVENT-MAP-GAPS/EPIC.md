# Epic: OpenAI proxy upstream event mapping gaps

**Purpose:** Resolve coverage and contract gaps in the OpenAI proxy’s handling of upstream events so that (1) all relevant payload fields are mapped to the component, (2) unmapped events are treated as warnings and eliminated over time, and (3) behavior is documented and test-driven.

**Source:** Critical review of [UPSTREAM-EVENT-COMPLETE-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md). This epic and its issues are linked from that doc.

---

## Epic issue (GitHub)

- **Epic:** [Issue #493](https://github.com/Signal-Meaning/dg_react_agent/issues/493) — OpenAI proxy upstream event mapping gaps

---

## Sub-issues and TDD docs

| # | Gap | GitHub issue | TDD / doc | Status |
|---|-----|--------------|-----------|--------|
| 1 | **speech_stopped** — map `channel`, `last_word_end` (and word timings) from upstream to **UtteranceEnd**; stop using fixed defaults when API sends actuals | [Issue #494](https://github.com/Signal-Meaning/dg_react_agent/issues/494) | [TDD-speech-stopped-fields.md](./TDD-speech-stopped-fields.md) | **Done** |
| 2a | **Transcription events when VAD disabled** — Confirm whether `input_audio_transcription.completed` / `.delta` are expected when server VAD is disabled; if not, document and optionally gate | [Issue #495](https://github.com/Signal-Meaning/dg_react_agent/issues/495) | [TDD-transcription-events-vad.md](./TDD-transcription-events-vad.md) | **Done** |
| 2b | **Transcription completed/delta — expose actuals** — Use API fields (alternatives, words, start, duration, channel) when present; use defaults only when absent | [Issue #496](https://github.com/Signal-Meaning/dg_react_agent/issues/496) | [TDD-transcription-expose-actuals.md](./TDD-transcription-expose-actuals.md) | **Done** |
| 3 | **Delta accumulator** — Accumulate `conversation.item.input_audio_transcription.delta` per `item_id` and send accumulated interim **Transcript**; DRY with existing translator mapper | [Issue #497](https://github.com/Signal-Meaning/dg_react_agent/issues/497) | (implementation + tests) | **Done** |
| 4 | **response.output_text.done and ConversationText** — Document why we do not use this event for ConversationText; capture best practice and rationale | [Issue #498](https://github.com/Signal-Meaning/dg_react_agent/issues/498) | [DOC-output-text-done-rationale.md](./DOC-output-text-done-rationale.md) | **Done** |
| 5 | **function_call part in assistant items** — Surface function_call content as ConversationText for Deepgram parity (e.g. "Function call: name(args)") | [Issue #499](https://github.com/Signal-Meaning/dg_react_agent/issues/499) | [TDD-function-call-part-assistant.md](./TDD-function-call-part-assistant.md) | **Done** |
| 6 | **conversation.item raw forward** — Remove forwarding of raw upstream JSON for `.created`/`.added`/`.done`; send only mapped **ConversationText** (and control). No motivation for passthrough; treat as bug fix. | [Issue #500](https://github.com/Signal-Meaning/dg_react_agent/issues/500) | (implementation) | **Done** |

---

## Acceptance criteria (epic complete)

- [ ] **Component docs updated:** Documentation that describes the component’s contract with the proxy (e.g. COMPONENT-PROXY-CONTRACT.md, test-app or component README, PROTOCOL-SPECIFICATION.md) is updated to reflect the improvements from this epic. In particular:
  - **UtteranceEnd:** Document that the proxy sends `UtteranceEnd` with `channel` and `last_word_end` from upstream when present (Issue #494); default shape when API omits them.
  - **ConversationText source:** Document that assistant text comes only from `conversation.item.*` (upstream requirement); not from `response.output_text.done` or other control events (Issue #498, #500).
  - **Transcript:** Document that user transcript comes from `conversation.item.input_audio_transcription.completed` and `.delta` (accumulated per item_id, Issue #497); when transcription is enabled and audio is committed, same with `turn_detection: null` (Issue #495).
  - **Raw events:** Document that the proxy does not forward raw upstream events (e.g. `conversation.item.*` as passthrough); only mapped component messages (Issue #500).
- [ ] All sub-issues (#494–#500) resolved or documented as decided.
- [ ] Integration tests and protocol spec reference the above behavior.

---

## Status

- Epic (#493) and sub-issues (#494–#500) created via `gh issue create`.
- **Done:** #494 (speech_stopped), #495 (transcription when VAD disabled: documented), #496 (transcription expose actuals), #497 (delta accumulator), #498 (output_text.done rationale), #499 (function_call part → ConversationText for parity), #500 (raw conversation.item forward removed).
- **Next:** Epic acceptance: update component docs per acceptance criteria; all sub-issues complete.
