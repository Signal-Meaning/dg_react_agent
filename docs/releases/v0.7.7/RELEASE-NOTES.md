# Release Notes - v0.7.7

**Release Date**: January 3, 2026  
**Release Type**: Patch Release

## Overview

v0.7.7 is a patch release that fixes Issue #353: Component should handle binary JSON messages. This fix ensures that `FunctionCallRequest` and other agent messages work correctly when Deepgram sends them as binary WebSocket messages instead of text messages.

## 🎯 Release Highlights

### Critical Bug Fix

- **Issue #353**: Fixed binary JSON message handling for FunctionCallRequest and other agent messages ✅
  - **Status**: Implemented and tested
  - **Impact**: High - Fixes callback not being invoked when messages arrive as binary JSON
  - **Test Coverage**: Comprehensive unit tests (12 tests) and E2E test added

## 🐛 Fixed

### Issue #353: Binary JSON Message Handling

**Problem**: Deepgram sends `FunctionCallRequest` messages as **binary WebSocket messages** (not text), but the component expected JSON messages to be **text WebSocket messages**. When the component received a binary message containing JSON, it treated it as audio data instead of parsing it as a FunctionCallRequest, causing the `onFunctionCallRequest` callback to never be invoked.

**Solution**: Implemented binary JSON detection in `WebSocketManager.ts`:
- Added `handleBinaryData()` method to detect and parse JSON in binary ArrayBuffer/Blob
- Validates message types against `AgentResponseType` enum for security
- Routes agent messages (FunctionCallRequest, SettingsApplied, ConversationText, etc.) correctly
- Maintains backward compatibility with text JSON messages

**Impact**: High - This bug was preventing function calling from working when messages arrived as binary JSON, which is how Deepgram sends them in some scenarios.

**Location**: `src/utils/websocket/WebSocketManager.ts` - `handleBinaryData()` method

**Test Coverage**:
- ✅ 12 comprehensive Jest unit tests (all passing)
- ✅ Playwright E2E test for Blob binary JSON handling (PASSING)
- ✅ Type validation tests verify unknown types are rejected
- ✅ Backward compatibility tests verify text JSON still works

## 📦 What's Included

### Code Changes
- `src/utils/websocket/WebSocketManager.ts` - Binary JSON detection and validation
  - Type validation against `AgentResponseType` enum
  - Handles both ArrayBuffer and Blob binary data
  - Comprehensive JSDoc documentation

### Tests
- `tests/websocket-binary-json.test.ts` - 12 comprehensive Jest unit tests
  - ArrayBuffer binary JSON scenarios
  - Type validation tests
  - Error handling and edge cases
- `test-app/tests/e2e/issue-353-binary-json-messages.spec.js` - Playwright E2E test
  - Blob binary JSON handling in real browser
  - Full integration flow verification

### Documentation
- `docs/issues/ISSUE-353-BINARY-JSON-MESSAGES.md` - Main tracking document
- `docs/issues/ISSUE-353/CODE-REVIEW.md` - Code review findings and fixes
- `docs/issues/ISSUE-353/TEST-STRATEGY.md` - Test strategy documentation
- `docs/issues/ISSUE-353/TEST-IMPLEMENTATION-PLAN.md` - Implementation plan

## 🔒 Security & Code Quality

- **Type Validation**: Message types are validated against `AgentResponseType` enum
  - Prevents non-agent JSON from being incorrectly routed as messages
  - Security/robustness improvement
- **Type Safety**: Uses enum constants instead of string literals
- **DRY Principle**: Extracted duplicate code to helper function
- **Documentation**: Comprehensive JSDoc and test documentation

## 🔄 Backward Compatibility

✅ **Fully backward compatible** - No breaking changes
- Text JSON messages continue to work exactly as before
- Existing code requires no changes
- All existing functionality preserved

## 📊 Test Results

- ✅ **Jest Unit Tests**: 12/12 passing
- ✅ **Playwright E2E Test**: PASSING (verified with real Deepgram API)
- ✅ **Type Validation**: Tests verify unknown types are rejected
- ✅ **No Linter Errors**: All code passes linting

## 🔗 Related Issues

- Fixes #353
- Related to #351 (root cause identified as this issue)

## 📝 Migration Guide

**No migration required** - This is a transparent bug fix with no API changes.

The fix is automatic and requires no changes to your code. Function calling will now work correctly whether messages arrive as text or binary JSON.

## 🙏 Acknowledgments

Reported by: Voice-commerce team  
Fixed by: davidrmcgee

