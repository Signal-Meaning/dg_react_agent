# Release Notes - v0.10.2

**Release Date**: March 2026  
**Type**: Patch release

## Summary

v0.10.2 patches the OpenAI proxy and release process for **voice-commerce #908**: unmapped upstream events no longer cause fatal errors or retry loops (#512, #517); release gate and documentation for upstream event coverage (#513); no duplicate function calls on success (#514). No API changes.

## Fixes included

- **#512:** Unmapped upstream events → log warning only; no Error to client.
- **#513:** Event-coverage regression test and release checklist item; supported/ignored/unknown docs.
- **#514:** Integration test: one FunctionCallRequest per successful function call; no retry on success.
- **#517:** Explicit handler branches for all known OpenAI Realtime server event types; unmapped = unknown future only.

## Packages

- **@signal-meaning/voice-agent-react** — 0.10.2
- **@signal-meaning/voice-agent-backend** — 0.2.7 (includes OpenAI proxy fixes #512, #513, #514, #517)

## See also

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) — Package contents and entry points
- docs/issues/ISSUE-512-515/RELEASE-CHECKLIST-515.md — Pre-release and publish steps
