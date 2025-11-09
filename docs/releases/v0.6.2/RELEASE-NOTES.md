## 🚀 Release v0.6.2: Patch Release

**Version**: v0.6.2  
**Date**: TBD  
**Status**: In Progress  
**Previous Version**: v0.6.1

### Overview

This is a patch release for version v0.6.2 of the Deepgram Voice Interaction React component. This release includes a critical bug fix for agent state management with no breaking changes.

### 🐛 Key Fixes

- **Issue #262**: Fixed agent state not transitioning to idle after audio playback stops
  - Agent state now correctly transitions from `'speaking'` to `'idle'` when TTS audio playback completes
  - Ensures proper state synchronization and triggers `onAgentStateChange('idle')` callback
  - Fixes idle timeout behavior where connections were not closing after 10 seconds of inactivity

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.2 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.2/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.2/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#262](https://github.com/Signal-Meaning/dg_react_agent/issues/262) - Idle timeout regression: Agent state transition to idle after playback stops

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

---

**Full Changelog**: [v0.6.1...v0.6.2](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.1...v0.6.2)

