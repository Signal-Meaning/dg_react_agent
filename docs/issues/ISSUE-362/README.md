# Issue #362: Context Retention Regression

**GitHub Issue**: #362  
**Customer Issue**: #587 (voice-commerce team)  
**Priority**: 🔴 **CRITICAL** - Blocks release  
**Status**: Regression confirmed - Context sent correctly but agent not using it

---

## Documents

- **[ISSUE-362-CONTEXT-RETENTION-REGRESSION.md](./ISSUE-362-CONTEXT-RETENTION-REGRESSION.md)** - Main tracking document with problem description, evidence, and investigation status
- **[ISSUE-362-TEST-GAPS.md](./ISSUE-362-TEST-GAPS.md)** - Test gaps analysis identifying missing tests that would have caught the regression
- **[ROOT-CAUSE-ANALYSIS.md](./ROOT-CAUSE-ANALYSIS.md)** - Root cause investigation findings
- **[TEST-RESULTS.md](./TEST-RESULTS.md)** - E2E test results confirming the regression

---

## Quick Summary

**Problem**: Context is being sent correctly to the Deepgram agent via `agentOptions.context`, but the agent model is **not using the context** to answer questions about previous conversations.

**Regression**: Version `0.7.7` introduced the regression. Version `0.7.6` works correctly.

**Key Finding**: We have tests that validate context is sent correctly, but we do not have tests that validate the agent actually uses the context. This gap allowed the regression to go undetected.

---

## Current Status

✅ **Regression Confirmed**: E2E test validates that context is sent correctly but agent doesn't use it
- Context is being sent: ✅ Verified (4 messages including user message)
- Agent uses context: ❌ Agent responds with "Hello!" instead of referencing previous conversation

## Next Steps

1. ✅ Investigate what changed between v0.7.6 (working) and v0.7.7 (broken) - No code changes found
2. ✅ Create E2E test that validates agent uses context - Test created and working
3. ⏳ Investigate root cause (possible Deepgram API-side issue)
4. ⏳ Implement fix
5. ⏳ Validate fix with E2E test (should PASS when fixed)
