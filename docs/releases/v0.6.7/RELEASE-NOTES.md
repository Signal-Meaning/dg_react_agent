## 🚀 Release v0.6.7: Patch Release - Fix Functions in Settings Message

**Version**: v0.6.7  
**Date**: November 14, 2025  
**Status**: Released  
**Previous Version**: v0.6.6

### Overview

This is a critical patch release that fixes a bug where functions passed in `agentOptions.functions` were not being included in the Settings message sent to Deepgram. This release resolves customer E2E test failures.

### 🐛 Critical Bug Fix

- **Functions Not Included in Settings Message**: Fixed issue where `agentOptions.functions` were not included in the Settings message
  - **Problem**: Functions passed in `agentOptions.functions` were not being included in the `think` section of the Settings message, causing E2E test failures
  - **Root Cause**: The `sendAgentSettings` function was building the Settings message but omitting `agentOptions.functions` in the `think` section
  - **Fix**: Added functions to the `think` section when provided
  - **Impact**: Functions are now correctly included in Settings message, resolving customer E2E test failures
  - **Test Coverage**: Created comprehensive test suite with 6 tests verifying function inclusion

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.7 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.7/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.7/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- Customer E2E test failures: Functions not included in Settings message
- Commit: `5b033f6` - fix: include functions in Settings message sent to Deepgram

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ Function calling tests passing (6/6 tests)
- ✅ All unit tests passing (588 passed, 6 skipped)
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.6...v0.6.7](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.6...v0.6.7)

