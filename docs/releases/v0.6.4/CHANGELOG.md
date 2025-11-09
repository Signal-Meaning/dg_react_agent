# Changelog: v0.6.4

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 8, 2025  
**Previous Version**: v0.6.3

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Idle Timeout Management
- **Issue #262/#430**: Fixed idle timeout not firing due to `ConversationText` messages resetting the timeout
  - **Root Cause**: Assistant `ConversationText` messages were resetting the idle timeout even when agent/user were idle, preventing the timeout from ever completing
  - **Fix**: Removed `ConversationText` messages (both user and assistant) from idle timeout reset logic because:
    - `ConversationText` messages are transcripts, not activity indicators
    - User text activity is already handled via `injectUserMessage()` → `InjectUserMessage` message
    - Agent activity is already tracked via `AgentThinking`, `AgentStartedSpeaking`, `AgentAudioDone` messages and state changes
  - **Impact**: Idle timeout now works correctly even when `ConversationText` messages arrive, as they no longer interfere with timeout management
  - Connections will now close after configured idle timeout (e.g., 10 seconds) instead of staying open until websocket timeout (~60 seconds)

## 📚 Documentation

- **Issue #262**: Added follow-up fix documentation explaining `ConversationText` redundancy
  - Updated `WebSocketManager.ts` with inline documentation explaining why `ConversationText` messages don't reset timeout
  - Updated component documentation clarifying user text activity handling
  - Updated test documentation in `agent-state-handling.test.ts`

## 🔗 Related Issues

- [#262](https://github.com/Signal-Meaning/dg_react_agent/issues/262) - Idle timeout not restarting after USER_STOPPED_SPEAKING
- [#430 (voice-commerce)](https://github.com/Signal-Meaning/voice-commerce/issues/430) - Idle timeout not firing, connections staying open until websocket timeout

---

**Full Changelog**: [v0.6.3...v0.6.4](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.3...v0.6.4)

