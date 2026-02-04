# Release Notes - v0.7.15

**Release Date**: February 2026  
**Type**: Patch

## Summary

This patch release fixes **Issue #399**: in proxy mode with functions configured, the server was responding with `SETTINGS_ALREADY_APPLIED` and closing the connection when a second Settings message was sent (e.g. after the user enabled the microphone or when `agentOptions` changed). The component now sends Settings **only once per WebSocket connection**, so the connection stays open and voice interactions can complete.

## Change

- **Settings sent once per connection**: When `agentOptions` changes after the first Settings has been sent for that connection, the component no longer re-sends Settings. This avoids the server `SETTINGS_ALREADY_APPLIED` response and connection close. If you need different agent options, establish a new connection with the desired options.

## References

- **Issue**: [#399](https://github.com/Signal-Meaning/dg_react_agent/issues/399) — SETTINGS_ALREADY_APPLIED, connection closes after second Settings send
- **PR**: [#400](https://github.com/Signal-Meaning/dg_react_agent/pull/400)
- **Tracking**: `docs/issues/ISSUE-399/README.md`
