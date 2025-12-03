## 🚀 Release v0.6.11: Patch Release - Functions Not Included in Settings Message Fix

**Version**: v0.6.11  
**Date**: December 2024  
**Status**: Released  
**Previous Version**: v0.6.10

### Overview

This is a patch release that fixes a critical closure issue where functions from `agentOptions.functions` were not being included in the Settings message sent to Deepgram. This prevented client-side function calling from working correctly. This release includes no breaking changes and maintains full backward compatibility.

### 🐛 Bug Fix

#### Functions Not Included in Settings Message - Closure Issue
- **Issue #307**: Fixed closure issue where `sendAgentSettings` captured stale `agentOptions` value
- **Problem**: Component was not including functions in Settings messages due to a closure issue where `sendAgentSettings` captured a stale `agentOptions` value from when the function was created
- **Impact**: 
  - Functions are now correctly included in Settings messages when `agentOptions.functions` is present
  - Functions are included even when `agentOptions` is updated after connection is established
  - Client-side function calling now works correctly
  - Prevents regression where functions were missing from Settings messages

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.11 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.11/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.11/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#307](https://github.com/Signal-Meaning/dg_react_agent/issues/307) - Functions Not Included in Settings Message - Closure Issue
- [#308](https://github.com/Signal-Meaning/dg_react_agent/pull/308) - Fix: Use ref for agentOptions in sendAgentSettings to fix closure issue (Issue #307)

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ Comprehensive test coverage added for closure issue fix (5 tests)
- ✅ All unit tests passing (17/17 closure and function calling tests)
- ✅ All existing tests passing (632 passed, 6 skipped)
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.10...v0.6.11](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.10...v0.6.11)

