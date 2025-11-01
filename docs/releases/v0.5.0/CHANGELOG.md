# Changelog: v0.5.0

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: October 2024

## 🐛 Bug Fixes

### Issue #190: Missing Agent State Handlers ✅ **RESOLVED**

**Status**: Resolved after v0.5.0 release

**Problem**: Agent conversations failed due to missing state transition handlers, causing idle timeout to fire prematurely and close WebSocket connections before agent responses were received.

**Solution**: Implemented all agent state handlers:
- `AgentThinking` → `thinking` state (disables idle timeout)
- `AgentStartedSpeaking` → `speaking` state (disables idle timeout)
- `AgentStoppedSpeaking` → Not a real Deepgram event (Issue #198). Agent state transitions to idle via `onPlaybackStateChange(false)` when playback completes.
- Playback event fallback → ensures `speaking` state even if `AgentStartedSpeaking` message is delayed

**Impact**: Agent state now transitions properly (`idle → speaking → idle` for text input, `idle → listening → [thinking] → speaking → idle` for voice input), and idle timeout is correctly disabled during agent responses.

**Test Coverage**: Comprehensive E2E and unit tests added to prevent regression.

See [ISSUE-190-MISSING-AGENT-STATE-HANDLERS.md](../../issues/ISSUE-190-MISSING-AGENT-STATE-HANDLERS.md) for complete details.

---

## 🔗 Related Issues

- [#190](https://github.com/Signal-Meaning/dg_react_agent/issues/190): Missing Agent State Handlers ✅ **RESOLVED** (was blocking #157)
- [#157](https://github.com/Signal-Meaning/dg_react_agent/issues/157): TTS Methods Removal ✅ **COMPLETE** (blocker resolved)

---

## 📚 Documentation

- **[Migration Guide](./MIGRATION.md)** - Complete migration from v0.4.x
- **[API Reference](./API-REFERENCE.md)** - Full API documentation
- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Integration patterns and examples
- **[Audio Buffer Management](./AUDIO-BUFFER-MANAGEMENT.md)** - TTS audio stream management

---

**Last Updated**: December 2024  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+

