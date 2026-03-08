# Rationale: response.output_text.done not used for ConversationText

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 4)

**Goal:** Document why the proxy does **not** map `response.output_text.done` to **ConversationText** (assistant), and what best practice is.

---

## Current design (Issue #489 Phase 2)

- Assistant text shown to the user comes **only** from **conversation.item.added** (and .created / .done when they carry assistant content).
- `response.output_text.done` is used only for **control**: clear responseInProgress, send AgentStartedSpeaking/AgentAudioDone, flush buffered idle_timeout Error. We do not read any output/text payload from this event for ConversationText.

## Reasons

1. **Single source of truth:** The API can send assistant content in multiple ways (e.g. `response.output_text.done` with an `output` field, or `conversation.item.added` with `item.content`). Using only **conversation.item.added** (and .created/.done) avoids duplicate assistant messages and keeps one canonical source (conversation items).
2. **Echo/duplication:** If we also mapped `response.output_text.done` to ConversationText, we could send the same assistant text twice when both events are present (once from output_text.done, once from item.added). That caused duplicate bubbles in the UI (see Issue #489, DIAGNOSIS-3B).
3. **Ordering and consistency:** Item events are the conversation history; control events (output_text.done) are signals. Treating content as coming only from items keeps history and control separate.

## Best practice

- **Do** use one protocol-defined source for assistant display text (we use conversation.item.*).
- **Do not** use control events (output_text.done, output_audio_transcript.done, function_call_arguments.done) as content sources when the same content is available via conversation.item.*.
- If the API sometimes sends assistant text **only** in output_text.done (e.g. no item.added for that turn), that would be an API gap; we could then consider a fallback that maps output_text.done to ConversationText only when we have not already sent that content from an item event. Not implemented today.

## References

- Issue #489, DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md
- PROTOCOL-AND-MESSAGE-ORDERING.md §5, §7a
- UPSTREAM-EVENT-COMPLETE-MAP.md (response.output_text.done row)
