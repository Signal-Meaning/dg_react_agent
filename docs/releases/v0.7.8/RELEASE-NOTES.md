# Release Notes - v0.7.8

**Release Date**: January 10, 2026  
**Release Type**: Patch Release

## Overview

v0.7.8 is a patch release that fixes Issue #357/#769: Component remounting during reconnection. This fix prevents unnecessary component remounts during reconnection scenarios, which was causing performance issues, memory leaks, and page crashes.

## 🎯 Release Highlights

### Critical Bug Fix

- **Issue #357/#769**: Fixed component remounting during reconnection ✅
  - **Status**: Implemented and tested
  - **Impact**: High - Prevents remount loops that cause crashes and performance issues
  - **Test Coverage**: E2E test added for remount detection during multiple reconnection cycles

## 🐛 Fixed

### Issue #357/#769: Component Remounting During Reconnection

**Problem**: The component was re-initializing unnecessarily when `isReady` became `false` during cleanup/reconnection, even when props hadn't changed. This caused remount loops during reconnection scenarios, leading to:
- Loss of internal component state
- Re-initialization of connections
- Memory leaks
- Performance issues
- Page crashes during reconnection

**Solution**: Removed the `isReady` state check from the initialization condition. The component now only re-initializes when:
1. It's the first mount (refs are undefined), OR
2. Dependencies actually changed (detected via deep comparison)

**Impact**: High - This bug was causing component remounts during reconnection, leading to crashes and performance degradation.

**Location**: `src/components/DeepgramVoiceInteraction/index.tsx` - Initialization logic (line ~860)

**Test Coverage**:
- ✅ E2E test for remount detection during multiple reconnection cycles (PASSING)
- ✅ Existing remount detection test still passes (PASSING)
- ✅ All Jest unit tests passing

## 📦 What's Included

### Code Changes
- `src/components/DeepgramVoiceInteraction/index.tsx` - Updated initialization logic
  - Removed `isReady` state from initialization decision logic
  - Component only re-initializes based on actual prop changes, not internal state changes
  - Added better debug logging to show why initialization occurs

### Tests
- `test-app/tests/e2e/component-remount-reconnection.spec.js` - E2E test for remount detection
  - Tests multiple disconnect/reconnect cycles
  - Verifies component remains stable (≤2 mounts: initial + StrictMode)
  - Detects remount loops during second reconnection (where the bug occurred)

### Documentation
- `docs/issues/ISSUE-357/` - Issue tracking and resolution documentation
- `docs/releases/v0.7.8/` - Release documentation

## 🔒 Code Quality

- **Initialization Logic**: Component now only re-initializes when necessary
- **Debug Logging**: Enhanced logging shows reason for initialization
- **Test Coverage**: Comprehensive E2E test ensures fix works correctly

## 🔄 Backward Compatibility

✅ **Fully backward compatible** - No breaking changes
- Component behavior improved without API changes
- All existing functionality preserved
- No changes required to existing code

## 📊 Test Results

- ✅ **Jest Unit Tests**: All passing
- ✅ **Playwright E2E Test**: PASSING (remount detection during reconnection)
- ✅ **Existing Remount Test**: PASSING (remount detection during transcript updates)
- ✅ **No Linter Errors**: All code passes linting

## 🔗 Related Issues

- Fixes #357
- Fixes #769 (customer report)
- Related to #276 (component remounting bug)

## 📝 Migration Guide

**No migration required** - This is a transparent bug fix with no API changes.

The fix is automatic and requires no changes to your code. The component will now remain stable during reconnection scenarios without unnecessary remounts.

## 🙏 Acknowledgments

Reported by: Customer (Issue #769)  
Fixed by: davidrmcgee
