# Release Notes - v0.8.2

**Release Date**: February 2026  
**Type**: Patch

## Summary

Patch release with ref API addition (Issue #429), callback fix for `onSettingsApplied` when `session.created` is received (#428), and CI cleanup (publish-only workflow removed; test-and-publish only).

## Commits in this release

- **Issue #429:** Expose getAgentManager on ref handle for idle-timeout parity (Deepgram + OpenAI proxy)
- **fix:** Invoke onSettingsApplied when session.created is received (fixes #428)
- **chore:** Remove publish-only workflow; use test-and-publish only

## Highlights

- **Ref API:** `getAgentManager()` is now exposed on the component ref for idle-timeout parity with Deepgram and OpenAI proxy.
- **Callback fix:** `onSettingsApplied` is invoked when `session.created` is received (fixes #428).
- **CI:** Single workflow (test-and-publish) for testing and publishing; publish-only workflow removed.

## Installation

**React component:**
```bash
npm install @signal-meaning/voice-agent-react@0.8.2
```

**Voice-agent-backend** (unchanged version; see [packages/voice-agent-backend](../../../packages/voice-agent-backend)):
```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
npm install @signal-meaning/voice-agent-backend@0.1.1
```

## Documentation

- [Changelog](CHANGELOG.md)
