# Migration - v0.9.0

## Breaking changes

**None.** v0.9.0 is fully backward compatible with v0.8.x.

- **Component:** No props, methods, or callbacks were added, changed, or removed.
- **Backend (0.2.0):** Backward compatible; existing proxy and function-call usage continues to work. See the voice-agent-backend package for any optional new options.

## Upgrading

1. **Component:** Update dependency to `@signal-meaning/voice-agent-react@0.9.0`. No code changes required.
2. **Backend (optional):** If you use `@signal-meaning/voice-agent-backend`, you may upgrade to `0.2.0` for the latest proxy and fixes. No required code changes for existing usage.

## References

- [CHANGELOG.md](./CHANGELOG.md) — Full list of changes
- [API-CHANGES.md](./API-CHANGES.md) — API surface summary (no component changes)
