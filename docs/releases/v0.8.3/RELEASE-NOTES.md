# Release Notes - v0.8.3

**Release Date**: February 2026  
**Type**: Patch

## Summary

Patch release with channel-ready enforcement (Issue #433) and log-level reporting. The component no longer sends user messages until the channel has reported ready; messages are queued and sent when SettingsApplied or session.created is received. Backend and component report LOG_LEVEL when set.

## Highlights

- **No send until ready:** `injectUserMessage` is queued when the channel is not ready and is sent when SettingsApplied (Deepgram) or session.created (OpenAI proxy) is received.
- **Log level reporting:** Backend and proxy log `LOG_LEVEL` when set; component logger reports resolved level once on first use.

## Installation

**React component:**
```bash
npm install @signal-meaning/voice-agent-react@0.8.3
```

**Voice-agent-backend** (see [packages/voice-agent-backend](../../../packages/voice-agent-backend) for version):
```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
npm install @signal-meaning/voice-agent-backend
```

## Documentation

- [Changelog](CHANGELOG.md)
