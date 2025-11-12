## 🚀 Release v0.6.5: Patch Release

**Version**: v0.6.5  
**Date**: November 12, 2025  
**Status**: Released  
**Previous Version**: v0.6.4

### Overview

This is a patch release for version v0.6.5 of the Deepgram Voice Interaction React component. This release includes critical bug fixes for component remounting in Strict Mode and a simplified transcript API with no breaking changes.

### 🐛 Key Fixes

- **Issue #276**: Fixed component remounting on transcript updates in React Strict Mode
  - **Root Cause**: Component was remounting on every transcript update due to shallow dependency comparison in `useEffect` hooks
  - **Fix**: 
    - Implemented deep comparison for `useEffect` dependencies to prevent unnecessary re-initialization
    - Ignore context changes in `agentOptions` (context updates dynamically and shouldn't trigger remounts)
    - Fixed cleanup race condition to preserve state during StrictMode re-invocation
    - Consolidated initialization logs to single entry
  - **Impact**: Component now remains stable during transcript updates (0 remounts vs 4 before)
  - **Code Quality**: Added 83 unit tests, fixed memory leaks, improved DRY principles

### ✨ New Features

- **Issue #274**: Added top-level `transcript` field to `TranscriptResponse` interface
  - **New Field**: `transcript.transcript` provides direct access to transcript text
  - **Backward Compatible**: Both `transcript.transcript` and `transcript.alternatives[0].transcript` work
  - **Benefits**: 
    - Ergonomic API: Consumers can now use `transcript.transcript` instead of `channel.alternatives[0].transcript`
    - Type Safe: TypeScript types reflect the actual available fields
    - Better DX: Most common use case (getting transcript text) is now trivial

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.5 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.5/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.5/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#276](https://github.com/Signal-Meaning/dg_react_agent/issues/276) - Component remounting on transcript updates (Strict Mode)
- [#274](https://github.com/Signal-Meaning/dg_react_agent/issues/274) - Add top-level transcript field to TranscriptResponse

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

**New Optional API**: You can now use the simplified `transcript.transcript` field instead of `transcript.alternatives[0].transcript`, but the old API still works.

### 🧪 Testing

- ✅ All unit tests passing (568 passed, 6 skipped)
- ✅ All E2E tests passing
- ✅ Component remount detection test passing (0 remounts during transcription)
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.4...v0.6.5](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.4...v0.6.5)

