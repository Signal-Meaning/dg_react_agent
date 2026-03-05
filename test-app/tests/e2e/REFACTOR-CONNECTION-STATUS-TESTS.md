# Refactor or remove: tests targeting STT / TTS connection display

**Context:** The Session pane was rehomed to the Settings panel. The **STT Connection** and **TTS & LLM Connection** properties were removed from the main UI. Their values are still exposed for E2E via `data-testid="connection-status"` and `data-testid="transcription-connection-status"` inside the Settings panel (minimal display) so existing tests continue to pass.

**Action:** Tests that target these should be refactored or removed:

- Prefer asserting on **Session** (e.g. `session-id`, `session-disconnect-button`, or `session-state-inactive`) or on behavior (e.g. disconnect via `session-disconnect-button` then assert connection closed) instead of raw connection status labels.
- Use the helper **`disconnectViaSettingsSession(page)`** (or **`disconnectComponent(page)`**, which uses it) for disconnect flows instead of relying on `stop-button` or the old `disconnect-button`.

## Tests that use `connection-status` or `transcription-connection-status`

Flagged for refactoring or removal (grep for these testids in `test-app/tests/`):

| Spec / area | Notes |
|-------------|--------|
| `test-helpers.js` | `disconnectComponent`, `waitForConnection`, `assertConnectionState`, etc. — keep; they read status for assertions. |
| `context-retention-agent-usage.spec.js` | Waits for connection; uses disconnectComponent. Refactor to use session-disconnect-button path. |
| `deepgram-greeting-idle-timeout.spec.js` | Reads connection-status. Refactor to Session or keep if only reading value. |
| `deepgram-text-session-flow.spec.js` | Disconnect and re-establish. Use disconnectViaSettingsSession. |
| `lazy-initialization-e2e.spec.js` | Reads both connection-status and transcription-connection-status. Refactor or keep. |
| Other specs | Any test that only reads `connection-status` / `transcription-connection-status` for assertions may stay as-is until refactor; prefer Session-centric assertions where possible. |

## New preferred pattern

- **Disconnect:** Use `disconnectViaSettingsSession(page)` or `disconnectComponent(page)` (which clicks `session-disconnect-button` or `stop-button`).
- **Session ID:** Assert or read `[data-testid="session-id"]` when tests need to verify session identity.
- **Connection state:** Reading `[data-testid="connection-status"]` is still supported for now; refactor to Session state or behavior where it makes sense.
