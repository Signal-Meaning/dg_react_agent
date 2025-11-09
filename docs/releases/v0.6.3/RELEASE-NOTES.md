## 🚀 Release v0.6.3: Patch Release

**Version**: v0.6.3  
**Date**: November 8, 2025  
**Status**: Released  
**Previous Version**: v0.6.2

### Overview

This is a patch release for version v0.6.3 of the Deepgram Voice Interaction React component. This release includes a critical bug fix for idle timeout management with no breaking changes.

### 🐛 Key Fixes

- **Issue #262**: Fixed idle timeout not restarting after `USER_STOPPED_SPEAKING` event
  - Idle timeout now correctly restarts when user stops speaking and all conditions are idle
  - Connections will now close after configured idle timeout (e.g., 10 seconds) instead of waiting for Deepgram's internal timeout (~60 seconds)
  - Fixes regression where connections stayed open indefinitely after user stopped speaking
  - Matches the behavior pattern used in `UTTERANCE_END` for consistent timeout management

### 🔧 Code Quality Improvements

- **DRY Refactoring**: Extracted `enableResetsAndUpdateBehavior()` helper method
  - Eliminates code duplication between `USER_STOPPED_SPEAKING` and `UTTERANCE_END` handlers
  - Single source of truth for enabling resets and updating timeout behavior
  - Improved maintainability and consistency

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.3 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.3/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.3/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#262](https://github.com/Signal-Meaning/dg_react_agent/issues/262) - Idle timeout not restarting after USER_STOPPED_SPEAKING
- [#430 (voice-commerce)](https://github.com/Signal-Meaning/voice-commerce/issues/430) - Customer report with detailed diagnostics

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ All unit tests passing (484 passed, 6 skipped)
- ✅ All E2E tests passing
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.2...v0.6.3](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.2...v0.6.3)

