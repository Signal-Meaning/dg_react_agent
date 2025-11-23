# Changelog: v0.6.9

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 2024  
**Previous Version**: v0.6.8

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## ✨ Added

### Regression Tests for Issue #299
- **Issue #299 / PR #300**: Added comprehensive regression tests for `listenModel` conditional inclusion
  - **Test Coverage**: Added `tests/listen-model-conditional.test.tsx` with 8 test cases
  - **Regression Tests**: All 8 tests validate expected behavior:
    - Settings message structure validation (with/without `listenModel`)
    - `injectUserMessage` works correctly when `listenModel` is omitted
    - Multiple `injectUserMessage` calls work correctly
    - `CLIENT_MESSAGE_TIMEOUT` errors are handled gracefully
    - Dynamic `agentOptions` changes (adding/removing `listenModel`)
  - **Impact**: Tests validate that text-only input via `injectUserMessage` works correctly
  - **Test Results**: All 8 tests passing

## 🐛 Fixed

### Conditional listen Provider Inclusion
- **Issue #299**: Fixed component incorrectly including default `listen` provider when `listenModel` is omitted
  - **Problem**: Component always included `listen` provider with default model 'nova-2' even when `listenModel` was not provided in `agentOptions`, causing `CLIENT_MESSAGE_TIMEOUT` errors for text-only input
  - **Root Cause**: Settings message construction always included `listen` provider regardless of whether `listenModel` was provided
  - **Fix**: 
    - Conditionally include `listen` provider only when `listenModel` is explicitly provided
    - Uses same pattern as other optional Settings fields (functions, endpoint, greeting)
    - Allows text-only agent interactions via `injectUserMessage` without timeout errors
  - **Impact**: 
    - Text-only input now works without `CLIENT_MESSAGE_TIMEOUT` errors
    - Component correctly supports text-only mode when `listenModel` is omitted
    - No breaking changes - existing code with `listenModel` continues to work
  - **Test Coverage**: All regression tests now pass (8/8 tests)

## 🔗 Related Issues

- [#299](https://github.com/Signal-Meaning/dg_react_agent/issues/299) - Component adds default listen provider even when listenModel is omitted
- [#300](https://github.com/Signal-Meaning/dg_react_agent/pull/300) - Add regression tests for Issue #299: listenModel conditional inclusion

## 📝 Commits Included

- `19121f4` - Merge pull request #300 from Signal-Meaning/davidrmcgee/issue299
- `207b2b2` - Add additional regression tests for Issue #299
- `a017ef3` - Add regression tests for Issue #299: listenModel conditional inclusion

---

**Full Changelog**: [v0.6.8...v0.6.9](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.8...v0.6.9)

