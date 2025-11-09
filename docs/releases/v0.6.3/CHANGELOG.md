# Changelog: v0.6.3

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 8, 2025  
**Previous Version**: v0.6.2

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Idle Timeout Management
- **Issue #262**: Fixed idle timeout not restarting after `USER_STOPPED_SPEAKING` event
  - Idle timeout now correctly restarts when user stops speaking and all conditions are idle (agent idle, user not speaking, not playing)
  - Added `updateTimeoutBehavior()` call after `enableResets()` in `USER_STOPPED_SPEAKING` case handler
  - Matches the pattern used in `UTTERANCE_END` for consistent behavior
  - Connections will now close after configured idle timeout (e.g., 10 seconds) instead of waiting for Deepgram's internal timeout (~60 seconds)
  - Fixes regression where connections stayed open indefinitely after user stopped speaking

## 🔧 Code Quality

- **DRY Refactoring**: Extracted `enableResetsAndUpdateBehavior()` helper method
  - Eliminates code duplication between `USER_STOPPED_SPEAKING` and `UTTERANCE_END` handlers
  - Single source of truth for enabling resets and updating timeout behavior
  - Improved maintainability and consistency

## 📚 Documentation

- **Issue #262**: Added comprehensive internal record and customer-facing documentation
  - Complete investigation summary and root cause analysis
  - Unit tests and E2E tests added to prevent regression
  - Troubleshooting guide for idle timeout diagnostics

## 🔗 Related Issues

- [#262](https://github.com/Signal-Meaning/dg_react_agent/issues/262) - Idle timeout not restarting after USER_STOPPED_SPEAKING
- [#430 (voice-commerce)](https://github.com/Signal-Meaning/voice-commerce/issues/430) - Customer report with detailed diagnostics

---

**Full Changelog**: [v0.6.2...v0.6.3](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.2...v0.6.3)

