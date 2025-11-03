## 🚀 Release v0.5.1: Bug Fixes and Documentation

**Version**: v0.5.1  
**Date**: TBD  
**Status**: Ready for Release  
**Previous Version**: v0.5.0

### ✅ Release Summary

v0.5.1 is a patch release that includes important bug fixes and adds comprehensive package structure documentation. This release improves reliability and developer experience.

### 🐛 Bug Fixes

#### Context Preservation Fix (Issue #234)

**Problem**: The component was sending a duplicate greeting message on reconnection when conversation context with existing messages was provided.

**Solution**: 
- Modified `sendAgentSettings()` to conditionally include greeting only when no context is provided or context messages array is empty
- When `agentOptions.context.messages` has length > 0, greeting is now omitted to prevent duplicate greeting on reconnection

**Impact**: Prevents duplicate greetings when reconnecting with existing conversation context, providing a smoother user experience.

#### Idle Timeout Handler Fix (Issue #235)

**Problem**: Multiple idle timeout messages were being fired when:
- Component remounted (e.g., React StrictMode)
- `debug` prop changed
- Multiple `IdleTimeoutService` instances existed simultaneously

**Solution**:
- Modified `useIdleTimeoutManager` hook to destroy any existing service BEFORE creating a new one
- Ensures only one timeout handler exists per session
- Prevents race conditions during component lifecycle changes

**Impact**: 
- Eliminates multiple timeout messages
- Ensures timeout fires correctly only once per idle period
- Prevents premature connection closures

### 📚 Documentation

#### Package Structure Documentation (Issue #233)

Added comprehensive package structure documentation:
- **Template**: `docs/releases/PACKAGE-STRUCTURE.template.md` - Reusable template for all future releases
- **Release-specific**: `docs/releases/v0.5.1/PACKAGE-STRUCTURE.md` - Version-specific package contents
- **Details**: Documents all files included in published package, entry points, directory purposes, and verification steps

This documentation helps developers understand exactly what files are included in the published package and how to verify installation.

### ✨ Improvements

- **Better Debugging**: Added `greetingIncluded` flag to settings logging for easier troubleshooting
- **Test Coverage**: Added comprehensive tests for both bug fixes
- **Documentation**: Enhanced release documentation suite with package structure details

### 📦 Package Contents

See [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) for complete details on included files and directories.

### 🔄 Migration Guide

**No breaking changes** in this release. This is a patch release with bug fixes and documentation improvements.

If upgrading from v0.5.0:
- No API changes
- No behavior changes (only bug fixes)
- All existing code continues to work

### 🧪 Testing

All tests passing:
- ✅ Existing test suite: All passing
- ✅ Issue #234 test: Verifies greeting omission when context exists
- ✅ Issue #235 tests: 3 comprehensive tests for timeout handler management

### 📝 Related Issues and PRs

- **Issue #233**: Release v0.5.1: Add Package Structure Documentation
- **Issue #234**: Duplicate Greeting Sent on Reconnection When Context is Provided → Fixed in PR #236
- **Issue #235**: Multiple Idle Timeout Handlers and Incorrect Timeout Reset Behavior → Fixed in PR #237

### 🚀 Next Steps

1. Install: `npm install @signal-meaning/deepgram-voice-interaction-react@v0.5.1`
2. Review: [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) for package contents
3. Verify: No code changes needed (bug fixes only)

