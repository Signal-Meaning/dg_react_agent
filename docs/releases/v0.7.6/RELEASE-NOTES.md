# Release Notes - v0.7.6

**Release Date**: January 3, 2026  
**Release Type**: Patch Release

## Overview

v0.7.6 is a patch release that adds enhanced diagnostic logging for Issue #351 (FunctionCallRequest callback not being invoked). This release provides comprehensive debug logging to help diagnose why `onFunctionCallRequest` callbacks may not be invoked in certain environments.

## 🎯 Release Highlights

### Enhanced Diagnostic Logging

- **Issue #351**: Added comprehensive debug logging for FunctionCallRequest handling ✅
  - **Status**: Diagnostic tooling added to help identify root cause
  - **Impact**: Medium - Helps diagnose callback invocation issues
  - **Usage**: Enable `debug={true}` on component to see diagnostic logs

## ➕ Added

### Issue #351: Enhanced Diagnostic Logging for FunctionCallRequest

**Purpose**: Help diagnose why `onFunctionCallRequest` callback may not be invoked in certain environments.

**What's Added**:
- Comprehensive debug logging throughout FunctionCallRequest handling flow
- Logs message detection when FunctionCallRequest is received
- Logs function processing details (array length, function details)
- Logs callback availability status
- Logs callback invocation flow (before, during, after)
- Logs error conditions and early return scenarios

**Diagnostic Messages**:
When `debug={true}` is enabled, the following diagnostic messages will appear:
- `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage` - Confirms message reaches handler
- `🔧 [FUNCTION] FunctionCallRequest received from Deepgram` - Shows full message structure
- `🔧 [FUNCTION] Functions array length: X` - Shows how many functions are in the request
- `🔧 [FUNCTION] onFunctionCallRequest callback available: true/false` - Shows if callback prop is available
- `🔧 [FUNCTION] About to invoke onFunctionCallRequest callback` - Shows callback is about to be called
- `🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...` - Shows callback is being invoked
- `🔧 [FUNCTION] onFunctionCallRequest callback completed` - Shows callback finished
- `🔧 [AGENT] ⚠️` messages for early return conditions (agent manager null, invalid message format, etc.)

**Files Modified**:
- `src/components/DeepgramVoiceInteraction/index.tsx` - Enhanced logging in FunctionCallRequest handler

**Usage**:
```tsx
<DeepgramVoiceInteraction
  debug={true}
  onFunctionCallRequest={handleFunctionCallRequest}
  // ... other props
/>
```

**What the Logs Tell You**:
- If no `FunctionCallRequest detected` log → Message isn't reaching the component handler
- If `agent service is not configured` → Agent manager isn't initialized
- If `Invalid agent message format` → Message format issue
- If `callback available: false` → Callback prop not being passed
- If `About to invoke` but no `Invoking` → Callback check failed
- If `Invoking` but no `completed` → Callback threw an error

## 📦 What's Included

### Code Changes
- `src/components/DeepgramVoiceInteraction/index.tsx` - Enhanced logging in FunctionCallRequest handler (lines ~1928-2298)

### Tests
- `test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js` - Reproduction test (passes in our environment)

### Documentation
- `docs/issues/ISSUE-351-FUNCTION-CALL-REQUEST-CALLBACK.md` - Full issue tracking and investigation
- `docs/issues/ISSUE-352-V0.7.6-RELEASE.md` - Release checklist

## 🔄 Migration Guide

**No migration required!** v0.7.6 is fully backward compatible. All existing code continues to work without changes.

### For Users Experiencing FunctionCallRequest Callback Issues

If you're experiencing issues where `onFunctionCallRequest` callback is not being invoked:

1. **Update to v0.7.6**:
   ```bash
   npm install @signal-meaning/deepgram-voice-interaction-react@0.7.6
   ```

2. **Enable Debug Mode**:
   ```tsx
   <DeepgramVoiceInteraction
     debug={true}
     onFunctionCallRequest={handleFunctionCallRequest}
     // ... other props
   />
   ```

3. **Capture Console Logs**: 
   - Open browser DevTools (F12)
   - Go to Console tab
   - Filter by `[FUNCTION]` or `[AGENT]`
   - Reproduce the issue and capture all logs

4. **Report Back**: Share the diagnostic logs to help identify the root cause

## 📊 Test Results

- **Jest Tests**: 69 test suites passed, 737 tests passed, 10 skipped ✅
- **E2E Tests**: Reproduction test created and passing ✅
- **Linting**: Clean (4 warnings, acceptable - no errors) ✅

## 🔗 Related Issues

- **Issue #351**: FunctionCallRequest callback not being invoked (diagnostic logging added)
- **Issue #352**: Release v0.7.6: FunctionCallRequest Diagnostic Logging

## 🙏 Acknowledgments

Thank you to the voice-commerce team for:
- Reporting the issue with detailed information
- Providing backend logs for analysis
- Helping improve component diagnostics

## 📚 Documentation

For more information, see:
- [CHANGELOG.md](./CHANGELOG.md) - Complete list of changes
- [Issue #351 Documentation](../../issues/ISSUE-351-FUNCTION-CALL-REQUEST-CALLBACK.md) - Full issue tracking

---

**Previous Release**: [v0.7.5](../v0.7.5/RELEASE-NOTES.md)

