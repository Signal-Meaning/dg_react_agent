# Changelog: v0.6.2

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: TBD  
**Previous Version**: v0.6.1

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Agent State Management
- **Issue #262**: Fixed agent state not transitioning to idle after audio playback stops
  - Added `AgentStateService.handleAudioPlaybackChange(false)` call when audio playback ends
  - Ensures proper state synchronization and triggers `onAgentStateChange('idle')` callback
  - Fixes idle timeout behavior where connections were not closing after 10 seconds of inactivity
  - Agent state now correctly transitions from `'speaking'` to `'idle'` when TTS audio playback completes

## 📚 Documentation

- **Issue #262**: Added comprehensive investigation summary and test documentation
  - `ISSUE-262-CUSTOMER-SUMMARY.md`: Complete investigation results and troubleshooting guide
  - Verified idle timeout mechanism working correctly with real API connections
  - Added reference tests demonstrating proper idle timeout behavior

## 🔗 Related Issues

- [#262](https://github.com/Signal-Meaning/dg_react_agent/issues/262) - Idle timeout regression: Agent state transition to idle after playback stops

---

**Full Changelog**: [v0.6.1...v0.6.2](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.1...v0.6.2)

