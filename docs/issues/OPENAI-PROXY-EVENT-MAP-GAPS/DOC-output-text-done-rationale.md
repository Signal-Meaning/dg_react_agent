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

## Upstream (OpenAI) requirement

**Requirement:** Use **conversation.item** for the **finalized assistant message** and **conversation history**. Use **response.output** (e.g. `response.output_text.delta` / `.done`) for **real-time streaming display** only.

We **map and implement** this requirement: assistant **ConversationText** is derived **only** from `conversation.item.created` / `.added` / `.done` (and from greeting). We do **not** use `response.output_text.done` (or other control events) as a source for ConversationText.

### What the API provides

- **`response.output_text.done`** (server event): Schema includes **`text: string`** — “The final text content.” Also includes `item_id`, `response_id`, `content_index`, `output_index`. Emitted when the text content part is done streaming, and also when a response is interrupted, incomplete, or cancelled.  
  Reference: [Realtime server events – response.output_text.done](https://platform.openai.com/docs/api-reference/realtime-server-events) (ResponseTextDoneEvent).
- **`response.output_text.delta`**: Incremental text chunks for real-time streaming.
- **`conversation.item.added`** / **`.created`** / **`.done`**: Full conversation items (including assistant messages with `content`). The API states that when the model generates a response, “Items will be appended to the conversation history by default” and the server sends “events for Items and content created, and finally a `response.done` event.”

### Upstream guidance: conversation.item for finalized message and history

- **Response events** (`response.output_text.delta` / `.done`): Used for **real-time streaming display** — showing the assistant’s reply as it is generated and the final text when done.
- **Conversation item events** (`conversation.item.*`): Used for **finalized assistant message** and **conversation history** — the canonical list of messages in the conversation.

We treat this as a **definitive requirement**: the proxy **must** use conversation.item for finalized message and history. We implement accordingly and do not map `response.output_text.done` (or other control events) to ConversationText.

## Best practice (implements upstream requirement)

- **Do** use **conversation.item.*** as the only source for assistant **ConversationText** (finalized message and history). We map and implement this.
- **Do not** use control events (`response.output_text.done`, `response.output_audio_transcript.done`, `response.function_call_arguments.done`) as content sources for ConversationText.
- If the API sometimes sends assistant text **only** in output_text.done (e.g. no item.added for that turn), that would be an API gap; we could then consider a fallback that maps output_text.done to ConversationText only when we have not already sent that content from an item event. Not implemented today.

## References

- **OpenAI:** [Realtime API – Server events](https://platform.openai.com/docs/api-reference/realtime-server-events) (ResponseTextDoneEvent: `response.output_text.done` with `text`; ResponseTextDeltaEvent; conversation.item.*).
- Issue #489, DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md
- PROTOCOL-AND-MESSAGE-ORDERING.md §5, §7a
- UPSTREAM-EVENT-COMPLETE-MAP.md (response.output_text.done row)
