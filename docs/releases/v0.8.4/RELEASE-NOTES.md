# Release Notes - v0.8.4

**Release Date**: February 2026  
**Type**: Patch

## Summary

Patch release for **Issue #439**: when using an OpenAI proxy and calling `ref.current.start()` with no arguments, the component now treats the session as agent-only and does not request or create a transcription manager. This fixes "Failed to create transcription manager" / "Failed to start voice interaction" in the OpenAI proxy scenario.

## Highlights

- **OpenAI proxy agent-only:** If `proxyEndpoint` indicates an OpenAI proxy (URL contains `/openai`), the component does not request or create a transcription manager when `start()` is called with no options, regardless of `transcriptionOptions` or `endpointConfig`.

## Installation

**React component:**
```bash
npm install @signal-meaning/voice-agent-react@0.8.4
```

**Voice-agent-backend** (see [packages/voice-agent-backend](../../../packages/voice-agent-backend) for version):
```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
npm install @signal-meaning/voice-agent-backend
```

## Documentation

- [Changelog](CHANGELOG.md)
- [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439)
- [BACKEND-PROXY/MIGRATION-GUIDE.md](../../BACKEND-PROXY/MIGRATION-GUIDE.md) — OpenAI proxy (agent-only)
