# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-01-21

### Added
- **TTS Mute Functionality**: Complete TTS mute/unmute capability with `toggleTtsMute()` and `setTtsMuted()` methods
- **TTS Mute Callback**: New `onTtsMuteToggle` prop for mute state change notifications
- **TTS Mute State**: New `ttsMuted` state property for tracking mute status
- **VoiceAgent Event Hooks**: New callback props for comprehensive voice interaction events
  - `onAgentSpeaking`: Called when agent starts speaking (TTS begins)
  - `onAgentSilent`: Called when agent finishes speaking (AgentAudioDone)
  - `onUserStoppedSpeaking`: Called when user stops speaking (VAD/endpointing)
  - `onUtteranceEnd`: Called when UtteranceEnd is detected from Deepgram's end-of-speech detection
  - `onSpeechStarted`: Called when SpeechStarted is detected from Deepgram Transcription API
  - `onVADEvent`: Called when VAD events are received from transcription service
- **Enhanced Idle Timeout Management**: Prevents connection timeouts during agent speech
- **Release Process Documentation**: Comprehensive release checklist and documentation standards
- **GitHub Issue Template**: Automated release checklist template for consistent release process
- **Enhanced Test Coverage**: Improved AudioManager mock coverage in test suite
- **Release Documentation Standards**: Established documentation structure for all releases

### Changed
- **Test Infrastructure**: Updated AudioManager mocks to include `setTtsMuted` method
- **Documentation Structure**: Enhanced release documentation with checklist guidance
- **Package Validation**: Improved plugin validation process

### Fixed
- **TTS Mute State**: Fixed TTS mute state not being respected during ongoing agent responses (Issue #127)
- **Idle Timeout**: Fixed idle timeout firing during agent speech (Issue #124)
- **VAD Callbacks**: Fixed onUserStoppedSpeaking callback functionality (Issue #95)
- **AudioContext Timing**: Fixed AudioContext exposure timing issues (Issue #90)
- **Test Failures**: Fixed missing `setTtsMuted` method in AudioManager test mocks
- **Release Process**: Standardized release process with comprehensive checklist

### Documentation
- **Release Checklist**: Created comprehensive v0.4.0 release checklist
- **Issue Template**: Added GitHub issue template for release process
- **Documentation Standards**: Updated release documentation with checklist guidance

### Internal
- **Dependencies**: Updated 12 packages to latest versions
- **Build Process**: Enhanced build and validation pipeline
- **Test Coverage**: Improved test mock coverage for AudioManager

---

## Previous Releases

### [0.3.2] - 2025-01-15
- VAD Timeout Fix Release
- Fixed critical bug causing voice connections to timeout during active speech
- Added comprehensive test coverage for VAD timeout behavior

### [0.3.1] - 2025-01-10
- Minor bug fixes and improvements
- Enhanced error handling and logging

### [0.3.0] - 2025-01-05
- Major feature release
- Added VAD (Voice Activity Detection) support
- Enhanced audio management capabilities
- Improved WebSocket connection handling

---

## Migration Guide

### From v0.3.x to v0.4.0

This is a minor version release with no breaking changes. No migration is required.

**What's New:**
- **TTS Mute Control**: Complete mute/unmute functionality for TTS audio
- **VoiceAgent Event Hooks**: Comprehensive callback system for voice interaction events
- **Enhanced Timeout Management**: Prevents connection timeouts during agent speech
- **Enhanced release process documentation**
- **Improved test coverage**
- **Better development workflow tools**

**No Action Required:**
- All existing APIs remain unchanged
- No configuration changes needed
- Backward compatible with all previous versions

---

## Support

For questions about this release:

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](README.md)
- **Migration Guide**: See [migration documentation](../../migration/README.md)

---

**Full Documentation**: [docs/releases/v0.4.0/](./)  
**Migration Guide**: [docs/migration/README.md](../../migration/README.md)  
**GitHub Repository**: [Signal-Meaning/dg_react_agent](https://github.com/Signal-Meaning/dg_react_agent)
