# Issue #172 - Test-App Panel Refactor Tracking Document

**Issue**: [Refactor: Optimize test-app panel for developer experience](https://github.com/Signal-Meaning/dg_react_agent/issues/172)  
**Branch**: `davidrmcgee/issue172`  
**Created**: December 2024

## Overview

This document tracks the removal of deprecated features and remnants from the test-app based on the v0.5.0 API changes documented in `API-REFERENCE.md` and `INTEGRATION-GUIDE.md`.

## Deprecated Features Identified for Removal

### 1. Auto-Connect Related Features ❌ REMOVE

**Status**: ⚠️ **HIGH PRIORITY** - These are explicitly deprecated in v0.5.0

#### Props to Remove:
- `autoConnect={true}` (line 638)
- `microphoneEnabled={micEnabled}` (line 639) 
- `onMicToggle={handleMicToggle}` (line 640)
- `onConnectionReady={handleConnectionReady}` (line 641)
- `onAgentSpeaking={handleAgentSpeaking}` (line 642)
- `onAgentSilent={handleAgentSilent}` (line 643)

#### State Variables to Remove:
- `micEnabled` (line 53)
- `connectionReady` (line 54)
- `agentSpeaking` (line 55)
- `agentSilent` (line 56)

#### Event Handlers to Remove:
- `handleMicToggle` (lines 353-365)
- `handleConnectionReady` (lines 413-416)
- `handleAgentSpeaking` (lines 418-422)
- `handleAgentSilent` (lines 424-428)

#### UI Elements to Remove:
- Auto-connect dual mode status section (lines 844-875)
- Auto-connect dual mode states display (lines 697-703)
- Microphone toggle button (lines 773-792)

### 2. TTS Mute Functionality ❌ REMOVE

**Status**: ⚠️ **HIGH PRIORITY** - Replaced with `interruptAgent()` method

#### Props to Remove:
- `ttsMuted={isTtsMuted}` (line 645)
- `onTtsMuteToggle={handleTtsMuteToggle}` (line 646)

#### State Variables to Remove:
- `isTtsMuted` (line 88)

#### Event Handlers to Remove:
- `handleTtsMuteToggle` (lines 430-433)
- `toggleTtsMute` (lines 557-570)

#### UI Elements to Remove:
- TTS Mute button (lines 821-841)
- TTS Muted status display (line 695)

### 3. Deprecated Methods ❌ REMOVE

**Status**: ⚠️ **HIGH PRIORITY** - These methods are deprecated in v0.5.0

#### Methods to Remove:
- `resumeWithText()` (line 385) - Use `injectMessage('user', text)` instead
- `resumeWithAudio()` (line 531) - Use `start()` method instead
- `toggleMicrophone()` (line 546) - Not a component responsibility
- `injectAgentMessage()` (line 506) - Use `injectMessage('agent', message)` instead

#### Functions to Update:
- `handleTextSubmit` (lines 367-411) - Replace `resumeWithText()` with `injectMessage()`
- `toggleMicrophone` (lines 513-555) - Replace `resumeWithAudio()` with `start()`
- `injectMessage` (lines 502-511) - Update to use new `injectMessage()` method

### 4. Deprecated VAD Events ❌ REMOVE

**Status**: ⚠️ **MEDIUM PRIORITY** - Some VAD events are deprecated

#### Props to Remove:
- `onSpeechStarted={handleSpeechStarted}` (line 650) - Use `onUserStartedSpeaking` instead

#### Event Handlers to Remove:
- `handleSpeechStarted` (lines 335-348)

#### State Variables to Remove:
- `speechStarted` (line 81)

#### UI Elements to Remove:
- Speech Started display (line 715)

### 5. Redundant State Management ❌ CLEANUP

**Status**: ⚠️ **MEDIUM PRIORITY** - Simplify state management

#### Redundant States to Remove:
- `isRecording` (line 38) - Can be derived from connection states
- `isPlaying` (line 39) - Can be derived from agent state
- `isSleeping` (line 40) - Can be derived from agent state

#### Simplify Connection State Display:
- Remove redundant connection state displays (lines 660-661)
- Consolidate into single connection status

### 6. Deprecated Text Input Pattern ❌ UPDATE

**Status**: ⚠️ **LOW PRIORITY** - Update to use new API

#### Current Pattern (Deprecated):
```tsx
await deepgramRef.current.resumeWithText(textInput);
```

#### New Pattern (v0.5.0):
```tsx
deepgramRef.current.injectMessage('user', textInput);
```

## New Features to Implement

### 1. Explicit Control Pattern ✅ IMPLEMENT

**Status**: 🎯 **HIGH PRIORITY** - Core v0.5.0 pattern

#### Required Changes:
- Remove auto-connect behavior
- Implement explicit `start()`/`stop()` control
- Add proper service configuration validation

#### Implementation:
```tsx
// Remove autoConnect prop
// Add explicit start/stop buttons
// Validate transcriptionOptions and agentOptions are provided
```

### 2. Unified Audio Control ✅ IMPLEMENT

**Status**: 🎯 **HIGH PRIORITY** - Replace TTS mute with interruptAgent

#### Implementation:
- Replace TTS mute button with "Interrupt Agent" button
- Use `interruptAgent()` method for audio control
- Remove TTS mute state management

### 3. Simplified Event Handling ✅ IMPLEMENT

**Status**: 🎯 **MEDIUM PRIORITY** - Use new event callbacks

#### New Event Callbacks to Use:
- `onAgentStartedSpeaking` / `onAgentStoppedSpeaking` - Simplified agent speaking detection
- `onUserStartedSpeaking` / `onUserStoppedSpeaking` - User VAD events
- `onUtteranceEnd` - End-of-speech detection

### 4. Panel Organization Improvements ✅ IMPLEMENT

**Status**: 🎯 **HIGH PRIORITY** - Core issue requirement

#### Priority-Based Layout:
1. **Connection Status** (highest priority)
2. **Controls/Inputs/Outputs**
3. **Agent Status**
4. **User Status (VAD)** (lowest priority)

#### Event Log Improvements:
- Single Event Log panel
- Search functionality
- Time-based reordering (Newest/Oldest)
- Collapsible panels
- Panel management system

## Implementation Plan

### Phase 1: Remove Deprecated Features
1. ✅ Remove auto-connect props and handlers
2. ✅ Remove TTS mute functionality
3. ✅ Remove deprecated methods
4. ✅ Clean up redundant state

### Phase 2: Implement New Patterns
1. ✅ Add explicit control pattern
2. ✅ Implement unified audio control
3. ✅ Update event handling
4. ✅ Simplify state management

### Phase 3: UI/UX Improvements
1. ✅ Reorganize panels by priority
2. ✅ Improve Event Log functionality
3. ✅ Add search and filtering
4. ✅ Implement collapsible panels

## Success Criteria

- [ ] All deprecated features removed
- [ ] New v0.5.0 patterns implemented
- [ ] Clean, organized panel layout
- [ ] Improved Event Log with search/filtering
- [ ] Collapsible panel system
- [ ] Developer experience significantly improved

## Notes

- The test-app currently uses many deprecated patterns from v0.4.x
- v0.5.0 introduces breaking changes that require significant refactoring
- Focus on maintaining functionality while improving UX
- Preserve existing test capabilities during refactor

---

**Last Updated**: December 2024  
**Next Review**: After Phase 1 completion
