# Changelog: v0.6.0

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: TBD  
**Previous Version**: v0.5.1

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🎉 Added

### Echo Cancellation Support (Issue #243)

#### Phase 1 - Echo Cancellation Detection
- **New Utility**: `EchoCancellationDetector` class for detecting browser echo cancellation support
  - Automatic detection of `echoCancellation`, `autoGainControl`, and `noiseSuppression` constraints
  - Browser detection and version identification
  - Verification of active echo cancellation status via `MediaTrackSettings`
  - Comprehensive unit tests for detection logic

#### Phase 2 - Configurable Audio Constraints
- **New Utility**: `AudioConstraintValidator` class for validating and applying audio constraints
  - Validation of audio constraint values before applying to `getUserMedia`
  - Support for `echoCancellation`, `autoGainControl`, `noiseSuppression`, `sampleRate`, and `channelCount`
  - Browser compatibility checking
  - Integration tests for constraint validation and application

- **New Component Prop**: `audioConstraints` - Configurable audio constraints for echo cancellation
  ```typescript
  interface AudioConstraints {
    echoCancellation?: boolean;
    autoGainControl?: boolean;
    noiseSuppression?: boolean;
    sampleRate?: number;
    channelCount?: number;
  }
  ```

- **New TypeScript Types**: `AudioConstraints` interface exported from component types
- **E2E Tests**: Comprehensive test suite for echo cancellation evaluation
  - Echo cancellation effectiveness test (agent TTS should not trigger itself)
  - Constraint validation tests with condition-based waits
  - Browser compatibility verification

### Testing Infrastructure
- Enhanced E2E test utilities for echo cancellation testing
- Improved constraint validation tests replacing arbitrary timeouts with condition-based waits
- Test validation for context preservation (Issue #238)
- Unified timeout coordination tests (Issue #235)

## 🐛 Fixed

### Audio Management
- **Issue #246**: Fixed MediaStream tracks not being properly stopped when `stopRecording()` is called
  - Improved cleanup in `AudioManager` to ensure all tracks are stopped
  - Prevents memory leaks and lingering audio connections

- **Issue #239**: Fixed critical race condition where audio tracks could hang after connection close
  - Comprehensive fix with 939 lines of test coverage
  - Proper cleanup sequence to prevent audio tracks from hanging
  - Ensures audio tracks are always properly released

- **Issue #243**: Fixed undefined `audioConstraints` bug causing microphone errors
  - Improved error handling in `AudioManager`
  - Graceful fallback when audio constraints are undefined

### Context and Greeting Management
- **Issue #234**: Fixed duplicate greeting when context with messages is provided
  - Component now omits greeting when context includes existing messages
  - Added test validation for context preservation

- **Issue #238**: Fixed duplicate greeting with context
  - Added comprehensive test validation to prevent duplicate greetings
  - Improved context handling logic

### Timeout Management
- **Issue #235**: Fixed multiple idle timeout handlers being registered per session
  - Prevents multiple timeout handlers from running simultaneously
  - Added unified timeout coordination tests
  - Improved cleanup of timeout handlers

## 📚 Documentation

- **Issue #243**: Comprehensive echo cancellation plan and evaluation documentation
  - Consolidated echo cancellation documentation into single historical document
  - Phase 1 & 2 completion and evaluation status documented
  - Implementation details and browser compatibility information

- **Issue #233**: Added package structure template to release process
  - Standardized release documentation structure
  - Template for consistent package structure documentation

## 🔧 Changed

- **Linting**: Fixed TypeScript linting errors in `AudioConstraintValidator` and `EchoCancellationDetector`
  - Replaced `MediaTrackSupportedConstraints` type with `ReturnType` approach
  - Improved type safety and ESLint compatibility

- **Test Reliability**: Improved E2E test reliability
  - Replaced arbitrary timeouts with condition-based waits
  - Enhanced test utilities for better test stability

## 🔗 Related Issues

- [#233](https://github.com/Signal-Meaning/dg_react_agent/issues/233) - Package structure template
- [#234](https://github.com/Signal-Meaning/dg_react_agent/issues/234) - Omit greeting when context with messages is provided
- [#235](https://github.com/Signal-Meaning/dg_react_agent/issues/235) - Prevent multiple idle timeout handlers per session
- [#238](https://github.com/Signal-Meaning/dg_react_agent/issues/238) - Duplicate greeting with context
- [#239](https://github.com/Signal-Meaning/dg_react_agent/issues/239) - Audio tracks hanging after connection close
- [#243](https://github.com/Signal-Meaning/dg_react_agent/issues/243) - Echo cancellation support (Phase 1 & 2)
- [#246](https://github.com/Signal-Meaning/dg_react_agent/issues/246) - MediaStream tracks not stopped when stopRecording() is called

## 📦 Migration Notes

This is a **minor release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### New Optional Feature: Echo Cancellation

Echo cancellation is **opt-in** and does not affect existing implementations. To use echo cancellation:

```typescript
<DeepgramVoiceInteraction
  audioConstraints={{
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true
  }}
  // ... other props
/>
```

If `audioConstraints` is not provided, the component behaves exactly as before.

---

**Full Changelog**: [v0.5.1...v0.6.0](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.5.1...v0.6.0)

