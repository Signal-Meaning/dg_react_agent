# Issue #192: API Validation Tests and Lint Rules

## Objective

Create comprehensive API validation tests to ensure the dg_react_agent component maintains compatibility with:
1. Deepgram Voice Agent API v1 (official spec)
2. The component's public API surface
3. Detect and warn about unauthorized API additions/changes

**Reference Documentation:**
- Voice Agent API: https://developers.deepgram.com/docs/voice-agent
- Migration Guide: https://developers.deepgram.com/docs/voice-agent-v1-migration

## Problem Statement

Currently, the component implements the Deepgram Voice Agent API, but there's no automated validation that:
1. All Voice Agent API events are properly handled
2. No unauthorized API changes have been added outside the official spec
3. New methods/events are properly documented and approved before release

This could lead to:
- Breaking changes introduced without proper documentation
- Unauthorized API additions that create compatibility issues
- Lack of clarity about what's part of the official spec vs. additions

## Solution Approach

### Phase 1: API Validation Tests ✅ COMPLETED

**Created:** `tests/voice-agent-api-validation.test.tsx`

**What it validates:**
- All Voice Agent API events are properly handled
- Component API surface matches published interface
- Event handling logic matches Voice Agent API specification
- Behavioral tests (not just type checks)

**Test Coverage:**
- 33 tests covering Voice Agent API events
- 12 public API methods validated
- API stability (additions, removals, changes)
- Exclusion of deprecated/experimental methods

### Phase 2: Negative Tests for Unauthorized Changes ⏳ IN PROGRESS

**Goal:** Fail tests when:
- New methods are added to `DeepgramVoiceInteractionHandle` that aren't in the official Voice Agent API docs
- New events are handled that aren't part of the Voice Agent API spec
- New callbacks/props are added without documentation

**Implementation Plan:**

#### 2.1: Add API Baseline Snapshot

Create a reference file listing ONLY the official Deepgram Voice Agent API methods/events:

```typescript
// tests/api-baseline/official-voice-agent-api.ts
export const OFFICIAL_VOICE_AGENT_API_METHODS = [
  'start',
  'stop',
  'updateAgentInstructions',
  'interruptAgent',
  'sleep',
  'wake',
  'toggleSleep',
  'injectAgentMessage',
  'injectUserMessage',
  'startAudioCapture',
  'isPlaybackActive',
  'getAudioContext',
] as const;

export const OFFICIAL_VOICE_AGENT_API_EVENTS = [
  'Welcome',
  'SettingsApplied',
  'UserStartedSpeaking',
  'AgentThinking',
  'AgentStartedSpeaking',
  'ConversationText',
  'AgentAudioDone',
  'Error',
  'Warning',
  'UtteranceEnd',
] as const;
```

#### 2.2: Add Negative Validation Tests

```typescript
it('should detect unauthorized API additions', async () => {
  const ref = React.createRef<any>();
  const component = render(<DeepgramVoiceInteraction ... />);
  
  const actualMethods = Object.keys(ref.current).filter(
    key => typeof ref.current[key] === 'function'
  );
  
  const unauthorizedMethods = actualMethods.filter(
    method => !OFFICIAL_VOICE_AGENT_API_METHODS.includes(method as any)
  );
  
  if (unauthorizedMethods.length > 0) {
    throw new Error(
      `Unauthorized API methods detected: ${unauthorizedMethods.join(', ')}\n` +
      `These methods must be either:\n` +
      `1. Removed from the component\n` +
      `2. Added to official Voice Agent API documentation\n` +
      `3. Marked as approved additions with lint overrides\n` +
      `4. Added to ISSUE-192-BREAKING-CHANGES or ISSUE-192-NON-BREAKING-CHANGES\n`
    );
  }
});
```

#### 2.3: Implement Lint Override System

When we need to add approved API additions:

**For Breaking Changes:**
```typescript
// @approved API addition - BREAKING CHANGE
// Issue: ISSUE-XXX
// Documentation: link to PR/issue
// Target Release: vX.Y.Z
export interface DeepgramVoiceInteractionHandle {
  // ... existing methods ...
  newBreakingMethod: () => void; // @approved-breaking
}
```

**For Non-Breaking Changes:**
```typescript
// @approved API addition - NON-BREAKING
// Issue: ISSUE-XXX
// Documentation: link to PR/issue
// Target Release: vX.Y.Z
export interface DeepgramVoiceInteractionHandle {
  // ... existing methods ...
  newMethod: () => void; // @approved-addition
}
```

#### 2.4: Create Tracking Files

Create tracking files for approved changes:
- `docs/issues/ISSUE-192-BREAKING-CHANGES.md`
- `docs/issues/ISSUE-192-NON-BREAKING-CHANGES.md`

These files should contain:
- Method/event name
- Issue reference
- PR reference
- Target release version
- Migration guide (for breaking changes)
- Rationale for the addition

### Phase 3: Automated Validation ⏳ PENDING

**Goal:** Automatically detect API changes and validate them against baseline

**Implementation:**
1. Generate baseline from TypeScript interface at fork point
2. Compare current interface with baseline
3. Fail CI if unauthorized additions detected
4. Require lint overrides for any additions

## Current Status

### ✅ Completed
- [x] Created comprehensive Voice Agent API validation tests
- [x] Tests validate all official Voice Agent API events
- [x] Tests validate public API methods
- [x] Removed deprecated methods from test (connectTextOnly)
- [x] Removed debug methods from test (getState, getConnectionStates)
- [x] Tests pass (33/33)

### ⏳ In Progress
- [ ] Add negative tests for unauthorized API changes
- [ ] Create official API baseline
- [ ] Implement lint override system
- [ ] Create tracking files for approved changes
- [ ] Add ESLint rules for approved additions

### 📋 Pending
- [ ] Automated CI validation
- [ ] Documentation updates
- [ ] Release notes generation from approved changes

## Success Criteria

- [x] All Voice Agent API events are tested
- [x] Component API methods are validated
- [x] No Transcription API references remain
- [ ] Tests catch API incompatibilities automatically
- [ ] Unauthorized API additions cause tests to fail
- [ ] Approved additions have lint overrides with proper documentation
- [ ] Documentation reflects Voice Agent API only

## Files Created/Modified

- ✅ `tests/voice-agent-api-validation.test.tsx` - Comprehensive API validation tests
- ⏳ `tests/api-baseline/official-voice-agent-api.ts` - Official API reference
- ⏳ `docs/issues/ISSUE-192-BREAKING-CHANGES.md` - Track breaking changes
- ⏳ `docs/issues/ISSUE-192-NON-BREAKING-CHANGES.md` - Track non-breaking additions

## Priority

**High** - Ensures component maintains compatibility with Voice Agent API and prevents unauthorized changes that could cause regressions.

