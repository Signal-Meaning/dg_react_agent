# TDD: function_call part in assistant items (Deepgram parity)

**Epic:** [OPENAI-PROXY-EVENT-MAP-GAPS](./EPIC.md) (Gap 5)

**Goal:** Decide whether we need to surface **function_call** content parts from assistant **conversation.item.\*** (e.g. for parity with Deepgram or for UI "agent is calling a function"). Document or implement.

---

## Current behavior (after Issue #499)

- `extractTextFromContentPart` in translator returns text from `text`, `transcript`, `output_text`, `input_text`, `content`, and **function_call** parts (Issue #499). For `type: "function_call"` we format as `"Function call: name(args)"` (same as `mapFunctionCallArgumentsDoneToConversationText`) for Deepgram parity.
- Assistant items that contain only a function_call part now produce **ConversationText** (assistant) with that line; items with both function_call and output_text parts show both in ConversationText.

## Decision (parity)

- **Parity:** Surface function_call content parts as ConversationText so conversation history matches what users see with Deepgram (e.g. "Function call: get_current_time()"). No new message type; reuse ConversationText with the same format as the existing FCR→ConversationText helper.

## TDD steps

1. **Document:** **Done.** UPSTREAM-EVENT-COMPLETE-MAP and this file updated.
2. **Compare with Deepgram:** Component shows ConversationText in history; FCR is for invocation. Showing "Function call: name(args)" in history gives parity.
3. **Red:** **Done.** Integration test: upstream sends conversation.item.added with item.content only a function_call part; client receives ConversationText (assistant) with "Function call" and function name.
4. **Green:** **Done.** `extractTextFromContentPart` handles `type === 'function_call'` via `formatFunctionCallPartForConversationText`; mapConversationItemAddedToConversationText unchanged (already iterates parts).
5. **Done.** UPSTREAM-EVENT-COMPLETE-MAP table row for conversation.item.* mentions function_call parts.

## References

- translator.ts: `extractTextFromContentPart`, `formatFunctionCallPartForConversationText`, `mapConversationItemAddedToConversationText`
- Component: FunctionCallRequest handling, history display
- Integration test: `Issue #499: conversation.item.added with only function_call part → ConversationText (assistant) for parity`
