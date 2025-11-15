## 🚀 Release v0.6.6: Patch Release

**Version**: v0.6.6  
**Date**: November 14, 2025  
**Status**: Released  
**Previous Version**: v0.6.5

### Overview

This is a patch release for version v0.6.6 of the Deepgram Voice Interaction React component. This release includes bug fixes for missing test coverage and documentation for the `onSettingsApplied` callback, along with CI/CD pipeline improvements and build process fixes.

### 🐛 Key Fixes

- **Issue #284 / PR #285**: Added comprehensive test coverage and documentation for `onSettingsApplied` callback API
  - **Problem**: The `onSettingsApplied` callback was part of the component's public API but lacked comprehensive test coverage and was missing from API documentation, leading to customer confusion
  - **Fix**: 
    - Created comprehensive test suite with 9 tests covering all scenarios
    - Added `onSettingsApplied` to API reference documentation
    - Documents when callback is invoked and its purpose
  - **Impact**: Resolves customer issue where callback was not documented, leading to confusion about usage

### 🔧 Improvements

#### CI/CD Pipeline Enhancements
- Implemented CI-safe E2E test strategy
- Added Playwright E2E tests running in parallel with Jest
- Fixed Playwright webServer configuration for Vite
- Improved dev server verification and error visibility
- Fixed Chromium-only browser install and Playwright config
- Added proper skip logic for tests requiring real APIs
- Removed duplicate exports of test utilities
- Made E2E tests blocking (removed continue-on-error)
- Fixed build order and dependency installation for CI

#### Build and Publishing
- Fixed: prevent re-publishing existing versions without force flag
- Fixed: build package before installing test-app deps

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.6 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.6/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.6/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#284](https://github.com/Signal-Meaning/dg_react_agent/issues/284) - onSettingsApplied Callback and Function Calling
- [#285](https://github.com/Signal-Meaning/dg_react_agent/pull/285) - Add comprehensive test coverage for onSettingsApplied callback

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ All unit tests passing (577 passed, 6 skipped)
- ✅ All E2E tests passing
- ✅ onSettingsApplied callback test suite passing (9/9 tests)
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.5...v0.6.6](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.5...v0.6.6)

