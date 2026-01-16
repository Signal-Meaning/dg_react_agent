# Issue #362: Greeting Regression Hypothesis

**Date**: January 12, 2026  
**Status**: 🔴 **INVESTIGATING**

---

## Hypothesis

The context retention regression (Issue #362) may be **related to the greeting regression** where greetings are being sent on reconnections even when context is present.

**Theory**: If a greeting is sent in Settings or ConversationText when context is present, it may:
1. Interfere with the agent's ability to process context
2. Cause the agent to respond with greeting instead of using context
3. Reset the agent's conversation state, ignoring the provided context

---

## Evidence

### From Test Results

**Agent Response**: "Hello!" when asked "What were we just talking about?"

This suggests the agent is responding with a greeting instead of using context.

### Code Analysis

**Current Logic** (line 1821-1823):
```typescript
...(currentAgentOptions.context?.messages && currentAgentOptions.context.messages.length > 0 
  ? {} 
  : { greeting: currentAgentOptions.greeting }),
```

**Expected Behavior**:
- When `context.messages.length > 0`: Greeting should NOT be included (`{}`)
- When `context.messages.length === 0`: Greeting should be included

**Potential Issues**:
1. Is `currentAgentOptions.context?.messages` correctly populated when reconnecting?
2. Is the greeting check happening at the right time?
3. Could there be a race condition where context isn't available when Settings is constructed?

### Known Issues

**Issue #234**: Duplicate Greeting Sent on Reconnection When Context is Provided
- Fixed: Greeting should be omitted when context.messages.length > 0

**Issue #238**: Duplicate greeting still sent on reconnection with context
- Note: Deepgram may send greeting in ConversationText even when omitted from Settings

---

## Investigation Steps

### Step 1: Verify Greeting in Settings Message ✅

**Test Enhancement**: Added check to verify greeting is NOT in Settings when context is present.

**Expected**: `settings.agent.greeting` should be `undefined` when context.messages.length > 0

**If greeting IS present**: This would indicate a bug in the greeting omission logic.

### Step 2: Check for ConversationText with Greeting ⏳

**Test Enhancement**: Added check for ConversationText messages with greeting after reconnection.

**Known Behavior** (Issue #238): Deepgram may send greeting in ConversationText even when omitted from Settings.

**Question**: Could this ConversationText greeting interfere with context processing?

### Step 3: Check Timing of Context vs Greeting ⏳

**Potential Issue**: Context might not be available when Settings is constructed, causing greeting to be included.

**Investigation**: Check when `currentAgentOptions.context` is populated relative to when Settings is sent.

---

## Possible Root Causes

### Scenario 1: Greeting Included in Settings (Bug in Logic)

**If**: Greeting is incorrectly included in Settings when context is present

**Then**: Agent receives both greeting and context, may prioritize greeting

**Fix**: Fix greeting omission logic

### Scenario 2: ConversationText Greeting Interferes

**If**: Deepgram sends greeting in ConversationText (Issue #238) and this interferes with context

**Then**: Agent processes greeting first, ignores context

**Fix**: Filter greeting ConversationText when context is present, or investigate Deepgram API behavior

### Scenario 3: Timing Issue

**If**: Context isn't available when Settings is constructed

**Then**: Greeting is included, context is sent later (or not at all)

**Fix**: Ensure context is available before Settings is sent

### Scenario 4: Agent Model Issue

**If**: Agent model prioritizes greeting over context when both are present

**Then**: This is a Deepgram API-side issue

**Fix**: Contact Deepgram support

---

## Code Analysis

### Greeting Omission Logic

**Location**: `src/components/DeepgramVoiceInteraction/index.tsx` lines 1821-1823

```typescript
...(currentAgentOptions.context?.messages && currentAgentOptions.context.messages.length > 0 
  ? {} 
  : { greeting: currentAgentOptions.greeting }),
```

**Logic**: 
- If `context.messages.length > 0`: Omit greeting (`{}`)
- If `context.messages.length === 0`: Include greeting

**Ref Update**: `agentOptionsRef.current` is updated in `useEffect` when `agentOptions` changes (line 1401-1403)

**Potential Timing Issue**: 
- `sendAgentSettings` uses `agentOptionsRef.current` 
- Ref is updated in `useEffect` which runs after render
- If Settings is sent before useEffect runs, ref might have stale value

### Test Evidence

From earlier test run (retry #1):
- Context was sent correctly: 4 messages including user message
- Agent responded with: "Hello!" (greeting)
- This suggests greeting might be interfering with context usage

## Next Steps

1. ✅ Add greeting verification to E2E test
2. ⏳ Run test and check if greeting is in Settings message
3. ⏳ Check for ConversationText greeting messages after reconnection
4. ⏳ If greeting is present in Settings, investigate why (timing, logic bug, etc.)
5. ⏳ If greeting is not present but agent still responds with greeting, investigate:
   - Deepgram API sending greeting in ConversationText (Issue #238)
   - Agent model prioritizing greeting over context
   - Timing issue with context processing

---

**End of Greeting Hypothesis**
