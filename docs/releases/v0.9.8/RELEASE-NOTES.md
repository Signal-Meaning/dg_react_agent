# Release Notes - v0.9.8

**Release Date**: March 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.8 is a **patch** release (Issue #489). It fixes a bug (Issue #487) where the component closed the agent WebSocket on idle timeout even when the agent was still busy—specifically, after the app had sent a function result and was waiting for the model to send the next message (e.g. the next function call in a chained flow). The component now treats that window as busy and does not close the connection until the next agent message is received.

## Upgrade

No code changes required for existing consumers. Install `@signal-meaning/voice-agent-react@0.9.8` when published.

See [CHANGELOG.md](./CHANGELOG.md) for details.
