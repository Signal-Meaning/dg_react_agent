# Issue #362: Test Gaps Analysis

**Date**: January 12, 2026  
**GitHub Issue**: #362  
**Customer Issue**: #587 (voice-commerce team)  
**Status**: Test gaps identified

---

## Summary

After reviewing existing tests, we have identified a **critical gap**: We have tests that validate context is **sent correctly**, but we **do not have tests** that validate the agent **actually uses the context** to answer questions about previous conversations.

This gap explains why the regression went undetected - our tests passed because context was being sent, but we didn't test whether the agent model actually used it.

---

## Existing Tests

### 1. `tests/context-preservation-validation.test.js` ✅

**What it tests**:
- ✅ Context format matches Deepgram API specification
- ✅ Context is included in Settings message
- ✅ Context structure is correct (`{ context: { messages: [...] } }`)
- ✅ Context messages have correct format (`type: 'History'`, `role: 'user'|'assistant'`, `content: string`)

**What it does NOT test**:
- ❌ Whether agent actually uses context to answer questions
- ❌ Whether agent references previous conversation
- ❌ End-to-end flow: send context → ask question → verify agent uses context

**Test Type**: Jest unit test with mocked WebSocketManager

**Status**: ✅ **PASSING** - Validates context format and sending

---

## Missing Tests

### 1. E2E Test: Agent Uses Context to Answer Questions ❌

**What we need**:
- E2E test that validates agent actually uses context
- Test flow:
  1. Establish connection
  2. Send message: "I'm looking for running shoes"
  3. Wait for agent response
  4. Disconnect agent
  5. Reconnect with context (context sent in Settings)
  6. Ask: "What were we just talking about?"
  7. **Assert**: Agent response references "running shoes" from context

**Where it should be**:
- `test-app/tests/e2e/context-retention-agent-usage.spec.js` (new file)

**Test Type**: Playwright E2E test with real Deepgram API

**Status**: ❌ **MISSING** - This is the test that would have caught the regression

---

### 2. Unit Test: Context Passed Through Component ✅ (Partial)

**What we have**:
- Tests validate context format
- Tests validate context is included in Settings message

**What we're missing**:
- Test that validates `agentOptions.context` is passed through component correctly
- Test that validates context is included in Settings message sent to WebSocket
- Test that validates context is NOT dropped during component re-renders

**Where it should be**:
- `tests/context-preservation-validation.test.js` (enhance existing)

**Test Type**: Jest unit test with mocked WebSocketManager

**Status**: ⚠️ **PARTIAL** - Validates format but not full component integration

---

## Test Coverage Gaps

### Gap 1: Agent Usage Validation ❌ **CRITICAL**

**Problem**: We test that context is sent, but not that agent uses it.

**Impact**: Regression went undetected because tests passed (context was sent correctly).

**Solution**: Create E2E test that validates agent actually references previous conversation.

**Priority**: 🔴 **HIGH** - This would have caught the regression.

---

### Gap 2: Component Integration Testing ⚠️ **MEDIUM**

**Problem**: We test context format in isolation, but not full component integration.

**Impact**: May miss issues where context is dropped during component lifecycle.

**Solution**: Enhance existing tests to validate context passes through component correctly.

**Priority**: 🟡 **MEDIUM** - Would help catch integration issues.

---

### Gap 3: Reconnection Context Flow ⚠️ **MEDIUM**

**Problem**: We don't have comprehensive tests for context during reconnection scenarios.

**Impact**: May miss edge cases in reconnection flow.

**Solution**: Add tests for various reconnection scenarios with context.

**Priority**: 🟡 **MEDIUM** - Would improve test coverage.

---

## Recommended Test Additions

### 1. E2E Test: Agent Uses Context (NEW) 🔴 **CRITICAL**

**File**: `test-app/tests/e2e/context-retention-agent-usage.spec.js`

**Test Cases**:
1. Agent references previous conversation after reconnection
2. Agent uses context to answer questions about previous messages
3. Agent maintains context across multiple reconnections

**Requirements**:
- Real Deepgram API (not mocked)
- Full E2E flow: connect → send message → disconnect → reconnect → ask question → verify response
- Validates agent response content (not just that context was sent)

**Status**: ❌ **MISSING** - Should be created to validate fix

---

### 2. Unit Test: Component Context Integration (ENHANCE) 🟡 **MEDIUM**

**File**: `tests/context-preservation-validation.test.js`

**Enhancements**:
1. Test that `agentOptions.context` is passed through component
2. Test that context is included in Settings message sent to WebSocket
3. Test that context is preserved during component re-renders
4. Test that context is NOT included when agent is connected (Issue #589)

**Status**: ⚠️ **PARTIAL** - Can be enhanced

---

### 3. Unit Test: Reconnection Context Scenarios (NEW) 🟡 **MEDIUM**

**File**: `tests/context-reconnection-scenarios.test.js` (new file)

**Test Cases**:
1. Context included on first connection (if provided)
2. Context included on reconnection after disconnect
3. Context NOT included when agent is already connected
4. Context format validation for various message types

**Status**: ❌ **MISSING** - Would improve coverage

---

## Test Strategy for Fix Validation

### Phase 1: Create E2E Test (Before Fix) 🔴 **CRITICAL**

1. Create `test-app/tests/e2e/context-retention-agent-usage.spec.js`
2. Test should:
   - Establish connection
   - Send message: "I'm looking for running shoes"
   - Wait for agent response
   - Disconnect agent
   - Reconnect with context
   - Ask: "What were we just talking about?"
   - **Assert**: Agent response contains "running shoes" or similar reference
3. **Expected**: Test should FAIL (regression confirmed)
4. This test will validate the fix when implemented

### Phase 2: Implement Fix

1. Investigate what changed between v0.7.6 and v0.7.7
2. Fix the issue
3. Run E2E test - should now PASS

### Phase 3: Enhance Unit Tests (After Fix) 🟡 **MEDIUM**

1. Enhance `tests/context-preservation-validation.test.js`
2. Add component integration tests
3. Add reconnection scenario tests

---

## Conclusion

**Critical Finding**: We have tests that validate context is sent correctly, but we **do not have tests** that validate the agent actually uses the context. This gap allowed the regression to go undetected.

**Immediate Action**: Create E2E test that validates agent uses context to answer questions about previous conversations. This test should:
- Use real Deepgram API
- Test full flow: connect → send message → disconnect → reconnect → ask question → verify response
- Validate agent response content (not just that context was sent)

**Long-term**: Enhance unit tests to validate component integration and reconnection scenarios.

---

**End of Test Gaps Analysis**
