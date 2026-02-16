# Issue #459 – Investigation: session.update and active response

## Where session/config updates are sent

### voice-agent-backend (OpenAI proxy)

- **File:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts`
- **Path:** Client sends `Settings` (JSON) → proxy parses in `forwardClientMessage` → `mapSettingsToSessionUpdate(settings)` → `upstream.send(JSON.stringify(sessionUpdate))` (single `session.update` to OpenAI).
- **Gating today:** Proxy only forwards the **first** Settings per connection (`hasForwardedSessionUpdate`). Duplicate Settings get `SettingsApplied` to the client and **no** second `session.update` (lines 234–246). So a second Settings message does not trigger a second session.update.
- **Gap:** `session.update` is sent whenever the first Settings is received. There is **no** check that the OpenAI Realtime API is idle (no active response). If the first Settings arrives after the conversation already has an active response (e.g. late Settings, or Settings after we already sent `response.create` from another path), we would still send `session.update` and can hit `conversation_already_has_active_response`.

### responseInProgress and response.create

- **Variable:** `responseInProgress` (server.ts ~133–134). Intended: true after we send `response.create` until the response is done.
- **Set true:** Only in the **audio** path when we send `input_audio_buffer.commit` + `response.create` (scheduleAudioCommit, ~182).
- **Set false:** Only on `response.output_text.done` (~421).
- **Not set true** when we send `response.create` in:
  - **FunctionCallResponse** path (~262): `upstream.send(JSON.stringify(itemCreate)); upstream.send(JSON.stringify({ type: 'response.create' }));` — `responseInProgress` is never set true.
  - **InjectUserMessage** path (~578, 585): after `conversation.item.added` / `conversation.item.done` we send `response.create` but do not set `responseInProgress = true`.
- **Not set false** on: `response.output_audio.done`, or any `response.done`-style event (only `response.output_text.done` clears it).

So during a **function-call or text-message** flow, the proxy sends `response.create` to upstream but never marks “response in progress.” Any logic that might later send `session.update` (e.g. if we deferred the first Settings or introduced a retry) would not be gated. The defect asks to **gate session.update on “no active response.”**

## Root cause (concise)

1. **session.update** is sent on the first Settings only, with no check for “active response.”
2. **responseInProgress** is only set for the audio path and only cleared on `response.output_text.done`. All other `response.create` paths (FunctionCallResponse, InjectUserMessage) do not set/clear it, so we do not have a reliable “response in progress” signal for gating.
3. If the client ever sends Settings at a time when the API already has an active response (e.g. late first Settings, or a bug allowing a second Settings that we treated as “first”), we would send `session.update` and can get `conversation_already_has_active_response`.

## Suggested fix (for TRACKING Phase 3)

- **Gate session.update on “no active response”:**
  - Treat “active response” as: we have sent `response.create` and have not yet seen a response-completion event.
- **Track response in progress for all paths:**
  - Set `responseInProgress = true` whenever we send `response.create` (audio path, FunctionCallResponse path, and after item.added for InjectUserMessage).
  - Set `responseInProgress = false` when we receive any of: `response.output_text.done`, `response.output_audio.done`, and (if present) `response.done`.
- **When handling Settings:**
  - If we would send `session.update` (first Settings, `!hasForwardedSessionUpdate`) but `responseInProgress` is true: **do not** send `session.update` to upstream. Either:
    - **Option A:** Defer: queue the Settings/session.update and send it after the next `response.*.done` (then send `SettingsApplied` after upstream applies it), or
    - **Option B:** Treat like duplicate: send `SettingsApplied` to the client immediately and do not send `session.update` (session already configured; avoid updating mid-response).
- Prefer **Option B** for simplicity unless product needs “apply new settings after this turn”; document behavior either way.

## Component (no change required for this bug)

- **Settings send:** Component sends Settings once per connection (on connect after WebSocket open). Issue #399: it explicitly does **not** re-send Settings when `agentOptions` change while connected (see e.g. index.tsx ~1396–1410, 1443–1456). So the component is not repeatedly sending Settings during a function-call flow.
- **Conclusion:** The race is in the proxy: we must not send `session.update` while the API has an active response. No component change needed for #459.

## References

- server.ts: `hasForwardedSessionUpdate`, `responseInProgress`, `forwardClientMessage` (Settings), upstream `message` handler (`response.output_text.done`, etc.).
- Integration test: `tests/integration/openai-proxy-integration.test.ts` — “forwards only first Settings per connection” (single session.update per connection).
