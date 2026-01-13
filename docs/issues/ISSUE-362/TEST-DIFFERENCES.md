# Issue #362: Test Differences Analysis

**Date**: January 12, 2026  
**Issue**: We're running our own test, not the customer's test

---

## Key Finding

**We are NOT running the customer's test.** We created our own test, which may be testing a different scenario or using different conditions than what the customer is experiencing.

---

## Customer's Reported Behavior

**Customer Issue #587** (voice-commerce team):

### Actual Behavior (Customer Report):
1. User sends: "I'm looking for running shoes"
2. Connection disconnects/reconnects
3. User asks: "What were we just talking about?"
4. **Agent responds**: "I'm unable to recall previous conversations" ❌

**Key Characteristics**:
- ✅ **Consistent failure** - Not flaky/intermittent
- ✅ **Specific error message** - "I'm unable to recall previous conversations"
- ✅ **Reproducible** - Customer can consistently reproduce

---

## Our Test Behavior

**Our Test**: `test-app/tests/e2e/context-retention-agent-usage.spec.js`

### Actual Behavior (Our Test):
1. User sends: "I am looking for running shoes"
2. Connection disconnects/reconnects
3. User asks: "Provide a summary of our conversation to this point."
4. **Agent responds**: 
   - Sometimes: "Hello!" or greeting
   - Sometimes: Continues previous response
   - Sometimes: References context correctly ✅

**Key Characteristics**:
- ⚠️ **Flaky/intermittent** - Sometimes passes, sometimes fails
- ⚠️ **Different responses** - Not the specific "I'm unable to recall" message
- ⚠️ **Different question** - We changed from "What were we just talking about?" to "Provide a summary..."

---

## Differences

### 1. Test Location

**Customer's Test**:
- `frontend/tests/e2e/context-retention-across-disconnect.e2e.test.js` (voice-commerce repo)
- `frontend/test-app/context-retention-test.jsx` (voice-commerce test app)

**Our Test**:
- `test-app/tests/e2e/context-retention-agent-usage.spec.js` (dg_react_agent repo)

### 2. Question Asked

**Customer**: "What were we just talking about?"  
**Our Test**: "Provide a summary of our conversation to this point."

### 3. Expected Response

**Customer**: Agent should say "We were talking about running shoes"  
**Customer Actual**: "I'm unable to recall previous conversations"

**Our Test**: Agent should mention "running shoes" or reference previous conversation  
**Our Test Actual**: Sometimes "Hello!", sometimes continues previous response, sometimes works

### 4. Behavior Pattern

**Customer**: ✅ **Consistent failure** - Always gets "I'm unable to recall"  
**Our Test**: ⚠️ **Flaky** - Sometimes passes, sometimes fails

---

## Why This Matters

1. **Different scenarios** - We may not be testing the same conditions the customer is experiencing
2. **Different environments** - Customer's test runs in voice-commerce app, ours runs in test-app
3. **Different question** - The question phrasing might affect agent behavior
4. **Different failure mode** - Customer gets consistent "can't recall" message, we get flaky behavior

---

## What We Need to Do

1. **Run customer's test** - Use their exact test scenario
2. **Match their question** - Use "What were we just talking about?" not "Provide a summary"
3. **Match their environment** - If possible, test in their voice-commerce app
4. **Verify consistent failure** - If customer reports consistent failure, we should see consistent failure too

---

## Next Steps

1. ⏳ **Get customer's test** - Obtain their exact test file or scenario
2. ⏳ **Run customer's test** - Reproduce their exact scenario
3. ⏳ **Match their question** - Use "What were we just talking about?" 
4. ⏳ **Verify behavior** - Confirm if we see the same consistent "I'm unable to recall" message

---

**End of Test Differences Analysis**
