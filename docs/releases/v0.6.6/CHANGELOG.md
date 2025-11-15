# Changelog: v0.6.6

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 14, 2025  
**Previous Version**: v0.6.5

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### onSettingsApplied Callback Test Coverage and Documentation
- **Issue #284 / PR #285**: Added comprehensive test coverage and documentation for `onSettingsApplied` callback API
  - **Problem**: The `onSettingsApplied` callback was part of the component's public API but lacked comprehensive test coverage and was missing from API documentation, leading to customer confusion
  - **Fix**: 
    - Created comprehensive test suite with 9 tests covering all scenarios:
      - Basic callback invocation
      - Optional callback behavior
      - Multiple events handling
      - Timing and order verification
      - Edge cases (unmount, reconnection)
      - Integration with other callbacks
    - Added `onSettingsApplied` to API reference documentation:
      - Added to interface definition
      - Added to Agent Events table with description
      - Documents when callback is invoked and its purpose
  - **Impact**: Resolves customer issue where callback was not documented, leading to confusion about usage
  - **Test Coverage**: All 9 tests passing ✅

## 🔧 Improved

### CI/CD Pipeline Enhancements
- **E2E Test Strategy**: Implemented CI-safe E2E test strategy
  - Added Playwright E2E tests running in parallel with Jest
  - Fixed Playwright webServer configuration for Vite
  - Improved dev server verification and error visibility
  - Fixed Chromium-only browser install and Playwright config
  - Added proper skip logic for tests requiring real APIs
  - Removed duplicate exports of test utilities
  - Made E2E tests blocking (removed continue-on-error)
  - Fixed build order and dependency installation for CI

### Build and Publishing
- **Publishing Safety**: Fixed to prevent re-publishing existing versions without force flag
- **Build Process**: Fixed build package before installing test-app deps

## 📚 Documentation

- **Issue #284**: Added comprehensive documentation for `onSettingsApplied` callback
  - Created `ISSUE-284-ON-SETTINGS-APPLIED-TEST-COVERAGE.md` with test coverage details
  - Updated API reference documentation with callback details
- **CI/CD**: Updated CI/CD pipeline documentation
  - Updated release checklist template
  - Added note about GitHub UI branch selector limitation

## 🔗 Related Issues

- [#284](https://github.com/Signal-Meaning/dg_react_agent/issues/284) - onSettingsApplied Callback and Function Calling
- [#285](https://github.com/Signal-Meaning/dg_react_agent/pull/285) - Add comprehensive test coverage for onSettingsApplied callback

---

**Full Changelog**: [v0.6.5...v0.6.6](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.5...v0.6.6)

