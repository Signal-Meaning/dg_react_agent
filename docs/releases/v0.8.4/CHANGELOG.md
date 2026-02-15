# Changelog - v0.8.4

**Release Date**: February 2026  
**Release Type**: Patch Release

## Changed

- **Issue #448:** CI/CD no longer runs on push to main. The Test and Publish workflow (`.github/workflows/test-and-publish.yml`) now runs only on GitHub release creation (`release: published`) and manual `workflow_dispatch`. Merging to `main` no longer triggers automated test/publish; publishing is unchanged via creating a release or running the workflow manually.

## Fixed

- **Issue #439:** OpenAI proxy — `start()` with no options must not request transcription. When the host uses an OpenAI proxy (`proxyEndpoint` URL containing `/openai`) and calls `ref.current.start()` with no arguments, the component no longer requests or creates a transcription manager; the session is agent-only. Previously the component could throw "Failed to create transcription manager" when `transcriptionOptions` or `endpointConfig` were also passed.

## Backward Compatibility

✅ **Fully backward compatible** — Workflow trigger change and behavioral fix for OpenAI proxy (agent-only) path. Patch release.

## References

- Issue #448: Release v0.8.4 (CI/CD on push disabled)
- Issue #439: OpenAI proxy start() with no options must not request transcription
- docs/issues/ISSUE-439/
- docs/BACKEND-PROXY/MIGRATION-GUIDE.md (OpenAI proxy agent-only)
