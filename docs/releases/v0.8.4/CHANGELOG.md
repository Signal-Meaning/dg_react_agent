# Changelog - v0.8.4

**Release Date**: February 2026  
**Release Type**: Patch Release

## Fixed

- **Issue #439:** OpenAI proxy — `start()` with no options must not request transcription. When the host uses an OpenAI proxy (`proxyEndpoint` URL containing `/openai`) and calls `ref.current.start()` with no arguments, the component no longer requests or creates a transcription manager; the session is agent-only. Previously the component could throw "Failed to create transcription manager" when `transcriptionOptions` or `endpointConfig` were also passed.

## Backward Compatibility

✅ **Fully backward compatible** — Behavioral fix for OpenAI proxy (agent-only) path. Patch release.

## References

- Issue #439: OpenAI proxy start() with no options must not request transcription
- docs/issues/ISSUE-439/
- docs/BACKEND-PROXY/MIGRATION-GUIDE.md (OpenAI proxy agent-only)
