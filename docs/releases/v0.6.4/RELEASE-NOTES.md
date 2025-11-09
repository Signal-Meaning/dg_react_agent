## 🚀 Release v0.6.4: Patch Release

**Version**: v0.6.4  
**Date**: November 8, 2025  
**Status**: Released  
**Previous Version**: v0.6.3

### Overview

This is a patch release for version v0.6.4 of the Deepgram Voice Interaction React component. This release includes a critical bug fix for idle timeout management with no breaking changes.

### 🐛 Key Fixes

- **Issue #262/#430**: Fixed idle timeout not firing due to `ConversationText` messages resetting the timeout
  - **Root Cause**: Assistant `ConversationText` messages were resetting the idle timeout even when agent/user were idle, preventing the timeout from ever completing
  - **Fix**: Removed `ConversationText` messages (both user and assistant) from idle timeout reset logic
  - **Rationale**: 
    - `ConversationText` messages are transcripts, not activity indicators
    - User text activity is already handled via `injectUserMessage()` → `InjectUserMessage` message
    - Agent activity is already tracked via `AgentThinking`, `AgentStartedSpeaking`, `AgentAudioDone` messages and state changes
  - **Impact**: Idle timeout now works correctly even when `ConversationText` messages arrive
  - Connections will now close after configured idle timeout (e.g., 10 seconds) instead of staying open until websocket timeout (~60 seconds)

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.4 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.4/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.4/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#262](https://github.com/Signal-Meaning/dg_react_agent/issues/262) - Idle timeout not restarting after USER_STOPPED_SPEAKING
- [#430 (voice-commerce)](https://github.com/Signal-Meaning/voice-commerce/issues/430) - Idle timeout not firing, connections staying open until websocket timeout

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ All unit tests passing (485 passed, 6 skipped)
- ✅ All E2E tests passing
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.3...v0.6.4](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.3...v0.6.4)

