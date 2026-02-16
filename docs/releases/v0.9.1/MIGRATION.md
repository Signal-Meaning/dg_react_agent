# Migration - v0.9.1

## Breaking changes

**None.** v0.9.1 is fully backward compatible with v0.9.0 and v0.8.x.

- **Component:** No props, methods, or callbacks were added, changed, or removed.
- **Backend (0.2.1):** Backward compatible; internal message ordering fix only. Existing proxy and function-call usage continues to work.

## Upgrading

1. **Component:** Update dependency to `@signal-meaning/voice-agent-react@0.9.1`. No code changes required.
2. **Backend (optional):** If you use `@signal-meaning/voice-agent-backend`, you may upgrade to `0.2.1` for the session.update gating fix (Issue #459). No required code changes for existing usage.

## References

- [CHANGELOG.md](./CHANGELOG.md) — Full list of changes
- [API-CHANGES.md](./API-CHANGES.md) — API surface summary (no component changes)
