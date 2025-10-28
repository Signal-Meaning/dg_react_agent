# Missing Agent State Handlers Cause Idle Timeout Regression

## 🚨 **Critical Bug**

Agent conversations fail due to missing state transition handlers, causing idle timeout to fire prematurely and close WebSocket connections before agent responses are received.

## 🔍 **Root Cause**

The component is missing handlers for agent state messages (`AgentStartedSpeaking`, `AgentStoppedSpeaking`, `AgentThinking`), causing:

1. **Agent state doesn't transition properly**: Goes from `listening` → `idle` (skipping `thinking`/`speaking`)
2. **Idle timeout fires prematurely**: Expects `thinking`/`speaking` states to disable timeout
3. **WebSocket closes before agent responds**: Connection closes after 10 seconds, before agent can respond

## 📊 **Evidence**

### **Console Logs Show Missing State Transitions:**
```
🔍 LOG: [DeepgramVoiceInteraction] Notifying parent: agentState changed to listening
🔍 LOG: [DeepgramVoiceInteraction] Notifying parent: agentState changed to idle
```

**Expected:** `listening` → `thinking` → `speaking` → `idle`  
**Actual:** `listening` → `idle` (missing intermediate states)

### **Idle Timeout Logic is Correct:**
```typescript
// src/utils/IdleTimeoutService.ts:98-103
const shouldDisableResets = 
  this.currentState.isUserSpeaking || 
  this.currentState.agentState === 'thinking' || 
  this.currentState.agentState === 'speaking' || 
  this.currentState.isPlaying;
```

But agent never reaches `thinking` or `speaking` states.

## 🧪 **Missing Tests (Critical)**

This regression would have been caught by proper E2E tests. We need:

### **1. Agent State Transition Tests**
```typescript
test('should transition through proper agent states during conversation', async ({ page }) => {
  // Send user message
  await sendTextMessage(page, 'Hello');
  
  // Verify agent state transitions
  await expect(page.locator('[data-testid="agent-state"]')).toHaveText('thinking');
  await expect(page.locator('[data-testid="agent-state"]')).toHaveText('speaking');
  await expect(page.locator('[data-testid="agent-state"]')).toHaveText('idle');
});
```

### **2. Idle Timeout Behavior Tests**
```typescript
test('should disable idle timeout during agent responses', async ({ page }) => {
  // Send message and verify connection stays open during agent response
  await sendTextMessage(page, 'Hello');
  
  // Wait longer than idle timeout (10s) and verify connection still open
  await page.waitForTimeout(12000);
  await expect(page.locator('[data-testid="connection-status"]')).toHaveText('connected');
});
```

### **3. Agent Response Tests**
```typescript
test('should receive agent response within reasonable time', async ({ page }) => {
  await sendTextMessage(page, 'Hello');
  
  // Wait for agent response (not just waiting message)
  await page.waitForFunction(() => {
    const response = document.querySelector('[data-testid="agent-response"]')?.textContent;
    return response && response !== '(Waiting for agent response...)';
  }, { timeout: 15000 });
});
```

## 🔧 **Implementation Plan**

### **Phase 1: Add Missing Agent State Handlers**

**File:** `src/components/DeepgramVoiceInteraction/index.tsx`

Add handlers for agent state messages in `handleAgentMessage()`:

```typescript
// Handle agent state changes
if (data.type === 'AgentStartedSpeaking') {
  dispatch({ type: 'AGENT_STATE_CHANGE', state: 'speaking' });
  onAgentSpeaking?.();
  return;
}

if (data.type === 'AgentStoppedSpeaking') {
  dispatch({ type: 'AGENT_STATE_CHANGE', state: 'idle' });
  onAgentSilent?.();
  return;
}

if (data.type === 'AgentThinking') {
  dispatch({ type: 'AGENT_STATE_CHANGE', state: 'thinking' });
  return;
}
```

### **Phase 2: Add Comprehensive E2E Tests**

**File:** `test-app/tests/e2e/agent-state-transitions.spec.js`

Create tests that verify:
- Agent state transitions during conversation
- Idle timeout behavior during agent responses  
- Agent response timing and content
- Connection stability during agent responses

### **Phase 3: Add Unit Tests**

**File:** `tests/agent-state-handling.test.js`

Test agent state message handling in isolation:
- Verify state transitions for each agent message type
- Test idle timeout service integration
- Mock agent responses and verify state changes

## 🎯 **Success Criteria**

- [ ] Agent state transitions properly: `listening` → `thinking` → `speaking` → `idle`
- [ ] Idle timeout disabled during agent responses
- [ ] Agent responses received within reasonable time
- [ ] E2E tests catch agent state regression
- [ ] Unit tests verify state message handling
- [ ] All existing tests pass

## 🚨 **Impact**

**High Priority** - This bug breaks core agent functionality and affects all voice assistant use cases.

**Regression Source** - Likely introduced during TTS methods removal refactoring (Issue #157) where agent state handling was overlooked.

## 📝 **Related Issues**

- Issue #157: Remove TTS Methods and Refactor Muting Responsibility
- This bug was discovered while investigating E2E test failures after the TTS refactoring

## ⚠️ **Blocker Relationship**

**This issue is a blocker for Issue #157.** Issue #157 cannot be considered complete until this regression is fixed. The status of Issue #157 has been updated to "PARTIAL" until this issue is resolved.

---

**Labels:** `bug`, `high-priority`, `regression`, `agent-state`, `e2e-tests`, `idle-timeout`, `blocker`
