## 🚀 Release v0.6.9: Patch Release - Regression Tests for Issue #299

**Version**: v0.6.9  
**Date**: November 2024  
**Status**: Released  
**Previous Version**: v0.6.8

### Overview

This is a patch release that adds comprehensive regression tests for Issue #299, documenting the bug where the component incorrectly includes a default `listen` provider even when `listenModel` is omitted from `agentOptions`. This release includes no breaking changes and maintains full backward compatibility.

### ✨ Test Coverage Added

#### Regression Tests for listenModel Conditional Inclusion
- **Test File**: `tests/listen-model-conditional.test.tsx`
- **Total Tests**: 8 test cases
  - **Bug Documentation**: 2 failing tests (expected) document the bug
  - **Regression Tests**: 6 passing tests validate expected behavior
- **Coverage**:
  - Settings message structure validation
  - `injectUserMessage` functionality when `listenModel` is omitted
  - Error handling for `CLIENT_MESSAGE_TIMEOUT`
  - Dynamic `agentOptions` changes (adding/removing `listenModel`)

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.9 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.9/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.9/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#299](https://github.com/Signal-Meaning/dg_react_agent/issues/299) - Component adds default listen provider even when listenModel is omitted
- [#300](https://github.com/Signal-Meaning/dg_react_agent/pull/300) - Add regression tests for Issue #299: listenModel conditional inclusion

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ Regression tests added (8 tests total)
- ✅ All unit tests passing (621 passed, 2 expected failures, 6 skipped)
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.8...v0.6.9](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.8...v0.6.9)

