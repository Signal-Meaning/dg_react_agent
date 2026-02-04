# Changelog - v0.7.15

**Release Date**: February 2026  
**Release Type**: Patch Release

## Fixed (Issue #399)

### SETTINGS_ALREADY_APPLIED — connection no longer closes after first Settings

- **Send Settings only once per connection**: The component no longer re-sends a Settings message when `agentOptions` changes after the first Settings has been sent for that WebSocket connection. Re-sending caused the server to respond with `SETTINGS_ALREADY_APPLIED` and close the connection (observed in proxy mode with functions configured).
- **Behavior**: When the agent is connected and Settings have already been sent, the `agentOptions` useEffect still runs and keeps `agentOptionsRef.current` up to date, but it no longer resets `hasSentSettingsRef` / `globalSettingsSent` or calls `sendAgentSettings()`. Debug mode logs: "skipping re-send (Issue #399: send Settings only once per connection)".
- **Tests**: New test `tests/settings-sent-once-issue399.test.tsx`; all tests that previously expected re-send when `agentOptions` changed now assert a single Settings per connection.

## Backward Compatibility

✅ **Fully backward compatible** — Behavior change only: mid-connection Settings updates (when `agentOptions` changed after connect) are no longer sent. If your app relied on updating agent options (e.g. adding functions) after the first connection and expected a second Settings message, you will need to establish a new connection with the desired options instead. This aligns with the Deepgram API behavior (sending Settings again results in `SETTINGS_ALREADY_APPLIED` and connection close).
