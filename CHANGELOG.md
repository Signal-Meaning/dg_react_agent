# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2024-10-22

### Fixed
- **Idle Timeout Management**: Consolidated idle timeout handling across WebSocket services into a single shared service, eliminating race conditions and improving reliability
- **Speech Detection**: Improved end-of-speech detection using Deepgram best practices to prevent premature idle timeouts
- **Agent State Synchronization**: Fixed race conditions where idle timeout could start while audio is playing, ensuring proper state management

### Technical Improvements
- Refactored idle timeout architecture to use a centralized service instead of multiple independent timers
- Enhanced VAD (Voice Activity Detection) event handling for more accurate speech state tracking
- Improved callback-based idle timeout management for better reliability

## [0.4.1] - 2024-10-21

### Fixed
- Resolved race condition in idle timeout management during agent speech
- Fixed microphone reconnection issues after connection timeouts
- Improved TTS mute functionality and state management

## [0.4.0] - 2024-10-20

### Added
- TTS mute button functionality with proper state management
- Enhanced idle timeout handling during agent speech
- Improved microphone control and reconnection capabilities
- Comprehensive VAD (Voice Activity Detection) events support

### Fixed
- Microphone button reconnection after connection timeout
- User injected messages receiving proper responses
- Auto-connect behavior in dual mode
- Various E2E test improvements and stability fixes

### Changed
- Updated default models to use Nova-2 for better performance
- Improved logging and debugging capabilities
- Enhanced error handling and user feedback

## [0.3.2] - 2024-10-15

### Fixed
- Resolved VAD timeout issues with proper idle timeout management
- Fixed microphone functionality in various scenarios
- Improved test reliability and coverage

## [0.3.1] - 2024-10-14

### Fixed
- Critical microphone reconnection issues
- WebSocket connection stability improvements
- Enhanced error handling and recovery

## [0.3.0] - 2024-10-13

### Added
- Comprehensive VAD events implementation
- Keepalive management for connection stability
- Context preservation with conversation history
- Lazy reconnection capabilities
- Enhanced debugging and logging

### Changed
- Improved WebSocket configuration and timeout handling
- Better error handling and user feedback
- Enhanced test coverage and reliability

## [0.2.0] - 2024-10-10

### Added
- DEEPGRAM_INSTRUCTIONS file configuration system
- WebSocket timeout testing and E2E tests
- Enhanced development workflow and packaging

### Fixed
- AudioContext handling in test environments
- Settings duplication and timing issues
- HMR (Hot Module Replacement) related crashes

## [0.1.1] - 2024-10-08

### Added
- Initial release with core functionality
- Real-time transcription capabilities
- Voice agent interaction features
- Microphone handling and audio playback
- Comprehensive test suite

### Features
- Headless React component design
- TypeScript support
- Multiple operation modes (transcription only, agent only, dual mode)
- Event-driven architecture with comprehensive callbacks
