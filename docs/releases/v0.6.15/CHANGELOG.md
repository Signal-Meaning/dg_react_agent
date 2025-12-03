# Changelog: v0.6.15

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: December 3, 2025  
**Previous Version**: v0.6.14

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Issue #311 - agentOptions Re-send Timing Race Condition
- **Root Cause**: Fixed timing race condition where `agentManagerRef.current` was null when `agentOptions` changed after connection
- **Fix**: Added setTimeout retry mechanism (100ms) to wait for manager recreation before re-sending Settings
- **Impact**: Component now correctly re-sends Settings when `agentOptions` changes after connection is established
- **Test Fixes**: Fixed 3 failing Issue #311 tests to ensure proper test coverage

### Memory Leak Fixes
- **setTimeout Cleanup**: Added proper cleanup function to prevent memory leaks when `agentOptions` changes rapidly or component unmounts
- **Closure Variable Fix**: Updated setTimeout callback to use `agentOptionsRef.current` instead of closure variable to ensure latest value is used
- **Cleanup Function Registration**: Fixed cleanup function to be registered before early return to ensure it's always called

### Code Quality Fixes
- **React Hooks Violation**: Fixed Rules of Hooks violation in test-app by moving conditional rendering after all hooks
- **Duplicate Test File**: Removed duplicate test file `test-option-comparison.ts` (kept `.test.ts` version)

### TypeScript Type Safety Improvements (Issue #310)
- **Window Global Properties**: Created `WindowWithDeepgramGlobals` interface to properly type all window global properties
- **AgentOptions Type Assertions**: Replaced `as any` with proper `AgentOptions` type usage
- **Message Data Handling**: Improved type safety for message data handling using proper type guards and `unknown` instead of `any`
- **Type Definitions**: Updated type definitions to use `unknown` instead of `any` where appropriate
- **Impact**: Reduced TypeScript linting warnings from 64 to 1 (remaining in different file)

## 🔗 Related Issues

- [#311](https://github.com/Signal-Meaning/dg_react_agent/issues/311) - Component not re-sending Settings when agentOptions changes after connection
- [#310](https://github.com/Signal-Meaning/dg_react_agent/issues/310) - Fix TypeScript 'any' type warnings in DeepgramVoiceInteraction component
- [#315](https://github.com/Signal-Meaning/dg_react_agent/issues/315) - Quick Release v0.6.15: Patch Release - Issue #311 Fixes

## 📝 Commits Included

- `e44f1ac` - fix: Fix failing Issue #311 tests before release
- `7ac1f31` - fix: Address TypeScript 'any' type warnings (Issue #310)

---

**Full Changelog**: [v0.6.14...v0.6.15](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.14...v0.6.15)

