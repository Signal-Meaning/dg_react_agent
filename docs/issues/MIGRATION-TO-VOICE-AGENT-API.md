# Migration to Voice Agent API

**Related Issues**: #190, #192, #200

## Overview

This document describes the migration from the old Transcription API architecture to the Voice Agent API-only architecture.

This migration was tracked across multiple issues and completed with Issue #192 (PR #200) which implements comprehensive API validation.

## Background

The original `dg_react_agent` component was designed to work with Deepgram's Transcription API, which included separate services for transcription and voice agent interactions. However, the current architecture should use **only** the Voice Agent API for all voice interactions.

## Key Changes

### 1. Removed Transcription API Events

**Removed:** `SpeechStarted` event from Transcription API
- This event was part of the old Transcription API
- Not part of Voice Agent API specification
- References removed from component, types, and constants

**Replaced with:** `UserStartedSpeaking` from Voice Agent API
- Correct event for Voice Agent API
- Properly indicates user voice activity

### 2. Event Mapping

| Old (Transcription API) | New (Voice Agent API) | Status |
|--------------------------|----------------------|--------|
| `SpeechStarted` | `UserStartedSpeaking` | ✅ Replaced |
| `UtteranceEnd` | `UtteranceEnd` | ✅ Same |
| `SpeechStopped` | Not a real event | ❌ Fictional (never existed) |

### 3. Files Modified

#### Component Source (`src/`)
- `src/constants/vad-events.ts` - Removed `SpeechStarted` constant
- `src/types/index.ts` - Removed `onSpeechStarted` callback
- `src/components/DeepgramVoiceInteraction/index.tsx` - Removed `SpeechStarted` handler
- `src/utils/websocket/WebSocketManager.ts` - Updated comments

#### Test Files (`test-app/`)
- All test files updated to use `UserStartedSpeaking` instead of `SpeechStarted`
- Test utilities and helpers updated
- Test app source updated

#### Documentation
- `README.md` - Added project objectives section
- `.cursorrules` - Added Voice Agent API requirements
- Created Issue #192 for API validation tests

## Valid Voice Agent API Events

The component now correctly handles only Voice Agent API events:

1. **User Started Speaking** - User begins speaking
2. **User Stopped Speaking** - User stops speaking (implied by UtteranceEnd)
3. **Utterance End** - End of speech utterance
4. **Agent Thinking** - Agent is processing
5. **Agent Started Speaking** - Agent begins responding
6. **Agent Stopped Speaking** - Agent finishes responding
7. **Conversation Text** - Transcript messages
8. **Welcome** - Connection greeting
9. **Settings Applied** - Configuration confirmation
10. **Error/Warning** - Error handling

## Implementation Guidelines

### For Developers

1. **Never use `SpeechStarted`** - This is from the deprecated Transcription API
2. **Use `UserStartedSpeaking`** - This is the correct Voice Agent API event
3. **Use `UtteranceEnd`** - This is the correct event for speech end detection
4. **Check event sources** - All events should come from Voice Agent API

### For Test Writers

1. Use `UserStartedSpeaking` in test expectations
2. Remove any `SpeechStarted` references
3. Update VAD event arrays to use correct events
4. Verify event sources match Voice Agent API specification

## Testing Strategy

### Current Test Status
- All test files updated to use Voice Agent API events
- Component builds successfully
- Test app ready for E2E testing

### Next Steps
1. Run full E2E test suite
2. Verify all VAD events are correctly captured
3. Validate Voice Agent API event handling
4. Implement Issue #192: API validation tests

## Related Issues

- Issue #190: Missing Agent State Handlers (FIXED) - Partially related migration work
- Issue #191: Idle Timeout Bug during Active Conversation (DUPLICATE of #190, FIXED)
- Issue #192: API Validation Tests (OPEN) - Includes API migration validation
- Issue #200: Two-Layer API Validation Framework (PR OPEN) - Implements validation for migrated API

## References

- Voice Agent API Documentation: https://developers.deepgram.com/docs/voice-agent
- Voice Agent API v1 Migration: https://developers.deepgram.com/docs/voice-agent-v1-migration
- Project Objectives: See `README.md` and `.cursorrules`

## Commit History

Migration work spans multiple issues:
- Issue #190: Fix idle timeout during active conversation (42c535e)
- Issue #192: API validation framework (65cd04d, 051a30d, 14d3c30, 6f02de6, 4525f9c, bdd482c)
- PR #200: Two-Layer API Validation Framework (merged/external)

## Verification Checklist

- [x] Removed `SpeechStarted` from component source
- [x] Removed `SpeechStarted` from types
- [x] Updated test files to use `UserStartedSpeaking`
- [x] Updated test utilities and helpers
- [x] Updated documentation
- [x] Created `.cursorrules` file
- [x] Added project objectives to README
- [x] Created Issue #192 for API validation
- [x] Issue #192 implemented (PR #200)
- [ ] Run E2E tests to verify changes
- [ ] Verify Voice Agent API event handling

