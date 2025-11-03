# Changelog: v0.5.1

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: TBD  
**Previous Version**: v0.5.0

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## ✨ Added

### Documentation

- **Package Structure Documentation (Issue #233)**: Added comprehensive package structure documentation template and version-specific documentation for v0.5.1
  - Template: `docs/releases/PACKAGE-STRUCTURE.template.md`
  - Release-specific: `docs/releases/v0.5.1/PACKAGE-STRUCTURE.md`
  - Documents all files included in the published package
  - Includes package entry points, directory purposes, and verification steps

## 🐛 Fixed

### Context Preservation

- **Fixed duplicate greeting on reconnection (Issue #234, PR #236)**: Component was sending a duplicate greeting message on reconnection when conversation context with existing messages was provided
  - Modified `sendAgentSettings()` to conditionally include greeting only when:
    - No context is provided (new conversation), OR
    - Context exists but messages array is empty
  - When `agentOptions.context.messages` has length > 0, greeting is now omitted to prevent duplicate greeting
  - Added `greetingIncluded` flag to settings logging for better debugging
  - Added test case to verify the fix

### Idle Timeout Management

- **Fixed multiple idle timeout handlers (Issue #235, PR #237)**: Multiple idle timeout messages were being fired when component remounted or `debug` prop changed
  - Modified `useIdleTimeoutManager` hook to destroy any existing service BEFORE creating a new one
  - Ensures only one timeout handler exists per session
  - Prevents race conditions during component lifecycle changes
  - Added comprehensive tests for timeout handler management

## 📚 Documentation

- **Package Structure Documentation**: Complete package structure documentation for v0.5.1
  - See [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) for detailed package contents
  - Template available for future releases

## 🔗 Related Links

- Issue #233: [Release v0.5.1: Add Package Structure Documentation](https://github.com/Signal-Meaning/dg_react_agent/issues/233)
- Issue #234: [Duplicate Greeting Sent on Reconnection When Context is Provided](https://github.com/Signal-Meaning/dg_react_agent/issues/234)
- Issue #235: [Multiple Idle Timeout Handlers and Incorrect Timeout Reset Behavior](https://github.com/Signal-Meaning/dg_react_agent/issues/235)
- PR #236: [Fix Issue #234: Omit greeting when context with messages is provided](https://github.com/Signal-Meaning/dg_react_agent/pull/236)
- PR #237: [Fix issue #235: Prevent multiple idle timeout handlers per session](https://github.com/Signal-Meaning/dg_react_agent/pull/237)

