# Changelog: v0.6.11

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: December 2, 2025  
**Previous Version**: v0.6.10

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Functions Not Included in Settings Message - Closure Issue
- **Issue #307**: Fixed closure issue where `sendAgentSettings` captured stale `agentOptions` value, preventing functions from being included in Settings messages
  - **Problem**: Component was not including functions from `agentOptions.functions` in the Settings message sent to Deepgram, even when functions were correctly passed. This was due to a closure issue where `sendAgentSettings` captured a stale `agentOptions` value from when the function was created.
  - **Root Cause**: `sendAgentSettings` used `agentOptions` directly from closure, capturing a stale value even when functions were present when the component rendered. This prevented functions from being included in Settings messages, breaking client-side function calling.
  - **Fix**: 
    - Added `agentOptionsRef` to hold latest `agentOptions` value (similar to existing `stateRef` pattern)
    - Updated `sendAgentSettings` to use `agentOptionsRef.current` instead of closure value
    - Added `useEffect` to update ref when `agentOptions` changes
    - Ensures `sendAgentSettings` always uses the latest `agentOptions` value, even when called from callbacks with stale closures
  - **Impact**: 
    - Functions are now correctly included in Settings messages when `agentOptions.functions` is present
    - Functions are included even when `agentOptions` is updated after connection is established
    - Client-side function calling now works correctly
    - No breaking changes - existing code continues to work
  - **Test Coverage**: Added comprehensive tests in `tests/closure-issue-fix.test.tsx` (5 tests, all passing)

## 🔗 Related Issues

- [#307](https://github.com/Signal-Meaning/dg_react_agent/issues/307) - Functions Not Included in Settings Message - Closure Issue
- [#308](https://github.com/Signal-Meaning/dg_react_agent/pull/308) - Fix: Use ref for agentOptions in sendAgentSettings to fix closure issue (Issue #307)

## 📝 Commits Included

- `44de5b5` - Merge pull request #308 from Signal-Meaning/issue307
- `e34e140` - docs: update Issue #307 with implementation status
- `9c25d29` - test: fix multiple updates test - all closure issue tests now passing
- `951792f` - fix: use ref for agentOptions in sendAgentSettings to fix closure issue (Issue #307)
- `795ffc6` - test: add closure issue tests for Issue #307 (TDD)

---

**Full Changelog**: [v0.6.10...v0.6.11](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.10...v0.6.11)

