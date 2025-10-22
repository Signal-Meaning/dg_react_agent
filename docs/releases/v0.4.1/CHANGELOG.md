# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2025-01-21

### Fixed
- **Issue #139**: Comprehensive idle timeout management fixes
  - Fixed race condition where idle timeout starts while audio is playing
  - Refactored idle timeout and speech detection architecture (Phases 1-3)
  - Implemented proper end-of-speech detection using Deepgram best practices
  - Consolidated useEffect hooks and extracted custom hook for better maintainability
  - Fixed idle timeout during agent activity
  - Resolved failing E2E tests related to idle timeout behavior

- **Issue #138**: Debug logging improvements
  - Moved VAD and keepalive debug logs to debug mode only
  - Reduced log noise in production environments

- **Issue #132**: GitHub Package Registry authentication fixes
  - Resolved persistent 401 authentication errors
  - Updated workflows to use NPM_PACKAGES_TOKEN for authentication
  - Added comprehensive debugging tools for authentication issues
  - Cleaned up duplicate test publishing workflows

- **Issue #130**: Test stability improvements
  - Fixed test failures that were blocking v0.4.0 release
  - Enhanced test reliability and coverage

### Changed
- **Security**: Added .npmrc to .gitignore for improved security
- **Workflows**: Enhanced debug workflow with better error handling
- **Documentation**: Improved release documentation structure

### Internal
- **Dependencies**: Updated dependencies to latest versions
- **Build Process**: Enhanced build and validation pipeline
- **Test Coverage**: Improved test reliability and error handling

---

## Previous Releases

### [0.4.0] - 2025-01-21
- **TTS Mute Functionality**: Complete mute/unmute capability with `toggleTtsMute()` and `setTtsMuted()` methods
- **TTS Mute Callback**: New `onTtsMuteToggle` prop for mute state change notifications
- **TTS Mute State**: New `ttsMuted` state property for tracking mute status
- **VoiceAgent Event Hooks**: New callback props for comprehensive voice interaction events
- **Enhanced Idle Timeout Management**: Prevents connection timeouts during agent speech
- **Release Process Documentation**: Comprehensive release checklist and documentation standards

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

### From v0.4.0 to v0.4.1

This is a patch version release with no breaking changes. No migration is required.

**What's Fixed:**
- **Idle Timeout Management**: Fixed race conditions and improved timeout behavior
- **Debug Logging**: Reduced log noise in production environments
- **Authentication**: Resolved GitHub Package Registry authentication issues
- **Test Stability**: Enhanced test reliability and coverage

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

**Full Documentation**: [docs/releases/v0.4.1/](./)  
**Migration Guide**: [docs/migration/README.md](../../migration/README.md)  
**GitHub Repository**: [Signal-Meaning/dg_react_agent](https://github.com/Signal-Meaning/dg_react_agent)
