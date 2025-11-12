# Changelog: v0.6.5

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 12, 2025  
**Previous Version**: v0.6.4

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Component Remounting in Strict Mode
- **Issue #276**: Fixed component remounting on transcript updates in React Strict Mode
  - **Root Cause**: Component was remounting on every transcript update due to shallow dependency comparison in `useEffect` hooks, causing excessive log spam and potential performance issues
  - **Fix**: 
    - Implemented deep comparison for `useEffect` dependencies to prevent unnecessary re-initialization
    - Ignore context changes in `agentOptions` (context updates dynamically and shouldn't trigger remounts)
    - Fixed cleanup race condition to preserve state during StrictMode re-invocation
    - Consolidated initialization logs to single entry (moved detailed logs to debug level)
  - **Impact**: Component now remains stable during transcript updates (0 remounts vs 4 before)
  - **Code Quality**: 
    - Added comprehensive unit tests for deep-equal utility (61 tests)
    - Added unit tests for option-comparison utilities (22 tests)
    - Fixed `setTimeout` cleanup memory leak
    - Extracted comparison utilities to reusable modules (DRY improvements)

## ✨ Added

### Simplified Transcript API
- **Issue #274**: Added top-level `transcript` field to `TranscriptResponse` interface
  - **New Field**: `transcript.transcript` provides direct access to transcript text
  - **Backward Compatible**: Both `transcript.transcript` and `transcript.alternatives[0].transcript` work
  - **Benefits**: 
    - Ergonomic API: Consumers can now use `transcript.transcript` instead of `channel.alternatives[0].transcript`
    - Type Safe: TypeScript types reflect the actual available fields
    - Better DX: Most common use case (getting transcript text) is now trivial
  - **Implementation**: Component normalizes API response structure before calling `onTranscriptUpdate`

## 📚 Documentation

- **Issue #276**: Added comprehensive documentation for component remounting fix
  - Created `ISSUE-276-CODE-REVIEW.md` with detailed code review
  - Created `ISSUE-276-COMPONENT-REMOUNTING.md` with investigation and solution details
  - Updated component documentation with deep comparison behavior
- **Issue #274**: Updated transcript API documentation
  - Updated `TRANSCRIPT-DOM-STRUCTURE.md` with new simplified API usage
  - Added API Testing section with examples
  - Updated all code examples to use simplified API

## 🔗 Related Issues

- [#276](https://github.com/Signal-Meaning/dg_react_agent/issues/276) - Component remounting on transcript updates (Strict Mode)
- [#274](https://github.com/Signal-Meaning/dg_react_agent/issues/274) - Add top-level transcript field to TranscriptResponse

---

**Full Changelog**: [v0.6.4...v0.6.5](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.4...v0.6.5)

