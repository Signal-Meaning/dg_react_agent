# Issue #362: Context Retention Regression

**GitHub Issue**: #362  
**Customer Issue**: #587 (voice-commerce team)  
**Priority**: 🔴 **CRITICAL** - Blocks release  
**Status**: Regression confirmed - Context sent correctly but agent not using it

---

## Documents

- **[ISSUE-362-CONTEXT-RETENTION-REGRESSION.md](./ISSUE-362-CONTEXT-RETENTION-REGRESSION.md)** - Main tracking document with problem description, evidence, and investigation status
- **[ISSUE-362-TEST-GAPS.md](./ISSUE-362-TEST-GAPS.md)** - Test gaps analysis identifying missing tests that would have caught the regression

---

## Quick Summary

**Problem**: Context is being sent correctly to the Deepgram agent via `agentOptions.context`, but the agent model is **not using the context** to answer questions about previous conversations.

**Regression**: Version `0.7.7` introduced the regression. Version `0.7.6` works correctly.

**Key Finding**: We have tests that validate context is sent correctly, but we do not have tests that validate the agent actually uses the context. This gap allowed the regression to go undetected.

---

## Next Steps

1. Investigate what changed between v0.7.6 (working) and v0.7.7 (broken)
2. Create E2E test that validates agent uses context (see test gaps document)
3. Implement fix
4. Validate fix with E2E test
