# TDD: function_call part in assistant items (Deepgram parity)

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 5)

**Goal:** Decide whether we need to surface **function_call** content parts from assistant **conversation.item.\*** (e.g. for parity with Deepgram or for UI “agent is calling a function”). Document or implement.

---

## Current behavior

- `extractTextFromContentPart` in translator returns text only from `text`, `transcript`, `output_text`, `input_text`, `content`. It does **not** return anything for a content part with `type: "function_call"` (no user-facing text).
- So assistant items that contain both a function_call part and an output_text part only show the output_text in **ConversationText**; function_call-only parts yield no ConversationText.

## Open questions

1. **Deepgram:** Does the Deepgram/component path show something for “agent requested a function call” (e.g. a placeholder or “Calling get_current_time…”)? If yes, we may want parity: e.g. map function_call parts to a short ConversationText line or a dedicated message type.
2. **UX:** Do we want the UI to show “Agent is calling get_current_time” (or similar) for assistant items that are only function_call? Today the user sees **FunctionCallRequest** from `response.function_call_arguments.done` and then the backend result; we might also want the item’s function_call part reflected in history.
3. **API shape:** What does the API send for a function_call content part (name, arguments, call_id)? We already send **FunctionCallRequest** from `response.function_call_arguments.done`; the item content part might be redundant or complementary.

## TDD steps

1. **Document:** In this file or UPSTREAM-EVENT-COMPLETE-MAP.md, state that function_call-only parts currently yield no ConversationText and list the options (no change vs. add a line like “Function call: name(args)” vs. new message type).
2. **Compare with Deepgram:** Check component/Deepgram path for how function-call turns are shown; note any gap.
3. **Red (if we want parity):** Add test: upstream sends conversation.item.added with item.content containing only a function_call part; assert client receives a defined behavior (e.g. ConversationText with “Function call: …” or a new type).
4. **Green:** Implement mapping for function_call parts per decision.
5. Update UPSTREAM-EVENT-COMPLETE-MAP.md table row for conversation.item.* to mention function_call parts.

## References

- translator.ts: `extractTextFromContentPart`, `mapConversationItemAddedToConversationText`
- Component: FunctionCallRequest handling, history display
