# Issue #362: Root Cause Analysis

**Date**: January 12, 2026  
**Status**: 🔴 **IN PROGRESS**

---

## Type Definition Mismatch Found

### Issue

There's a **type definition mismatch** between what the component expects and what the TypeScript types define:

1. **Component Code** (line 1824):
   ```typescript
   context: currentAgentOptions.context // Context is already in Deepgram API format
   ```
   Comment says "Context is already in Deepgram API format" which is `{ messages: [{ type: "History", role: "...", content: "..." }] }`

2. **AgentOptions Type** (lines 394-400):
   ```typescript
   context?: {
     messages: Array<{
       type: string;
       role: ConversationRole;
       content: string;
     }>;
   };
   ```
   ✅ This matches what the component expects

3. **AgentSettingsMessage Type** (line 123):
   ```typescript
   context?: ConversationMessage[]; // Array of ConversationMessage
   ```
   ❌ This says `ConversationMessage[]` which is `[{ role, content }]` - **NO `type` field!**

4. **ConversationMessage Type** (lines 53-57):
   ```typescript
   export interface ConversationMessage {
     role: ConversationRole;
     content: string;
     timestamp?: number;
   }
   ```
   ❌ Does NOT have `type: "History"` field

### Impact

This is a **TypeScript type definition bug**, but it shouldn't cause a runtime issue since TypeScript types are erased at runtime. However, it could indicate that:

1. The type definition is wrong and needs to be fixed
2. There might be runtime code that's incorrectly handling the context format
3. The Deepgram API might be expecting a different format than what we're sending

---

## Investigation Steps

### Step 1: Verify What's Actually Being Sent

Need to check:
1. What format is `currentAgentOptions.context` when it reaches `sendAgentSettings()`?
2. What format is actually sent in the Settings message?
3. Does the WebSocketManager transform the context in any way?

### Step 2: Check Deepgram API Specification

Need to verify:
1. What format does Deepgram API actually expect for context?
2. Is it `{ messages: [{ type: "History", role, content }] }` or `[{ role, content }]`?
3. Has the API specification changed between v0.7.6 and v0.7.7?

### Step 3: Check for Runtime Transformations

Need to verify:
1. Is there any code that transforms the context format?
2. Does the binary JSON handling (Issue #353) affect context messages?
3. Are there any validations that might be dropping the context?

---

## Deepgram API Format Verification ✅

**Verified**: The format being sent matches Deepgram API specification:

```json
{
  "context": {
    "messages": [
      { "type": "History", "role": "user", "content": "..." },
      { "type": "History", "role": "assistant", "content": "..." }
    ]
  }
}
```

This is the correct format according to Deepgram's Voice Agent API v1 documentation.

## Key Findings

1. ✅ **Context format is correct** - Matches Deepgram API spec
2. ✅ **Context is being sent** - Verified in customer logs
3. ✅ **Type definition mismatch exists** - But this is TypeScript-only, not runtime
4. ❓ **Agent not using context** - Despite receiving it correctly

## Hypothesis

Since:
- Format is correct
- Context is being sent
- It worked in v0.7.6
- Only major change in v0.7.7 was binary JSON handling (Issue #353)

**Possible causes**:
1. **Deepgram API-side issue** - API might have changed how it processes context
2. **Timing issue** - Context might be sent but agent model doesn't receive it in time
3. **Binary JSON handling side effect** - The binary JSON changes might have affected message processing order
4. **Agent model issue** - The agent model itself might not be using the context (Deepgram-side)

## Next Steps

1. ✅ Check type definitions - **FOUND MISMATCH** (TypeScript-only, not runtime)
2. ✅ Verify actual format being sent - **CONFIRMED CORRECT**
3. ✅ Check Deepgram API specification - **FORMAT MATCHES**
4. ⏳ Compare v0.7.6 vs v0.7.7 context handling code - **NO CHANGES FOUND**
5. ⏳ Test with actual Deepgram API - **NEED TO CREATE E2E TEST**
6. ⏳ Check if binary JSON handling affects context processing
7. ⏳ Contact Deepgram support to verify if API behavior changed

---

**End of Root Cause Analysis**
