# Changelog: v0.6.1

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: TBD  
**Previous Version**: v0.6.0

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Transcript Handling
- **Issue #254**: Fixed interim transcripts not being reported via `onTranscriptUpdate` callback
  - Implemented real-time streaming approach with WAV files for reliable interim transcript generation
  - Consolidated audio helpers to always use streaming (removed bulk send option)
  - Updated tests to use `shopping-concierge-question.wav` for reliable interim transcript validation
  - Interim transcripts now properly received and reported for real-time transcription features

### Test App Microphone Control
- **Issue #255**: Fixed microphone button not starting transcription service when agent already connected
  - Updated `toggleMicrophone` to always call `start({ agent: true, transcription: true })`
  - Ensures transcription service starts even when agent is already connected
  - VAD events and transcripts now properly available when microphone is activated
  - Added test validation in `microphone-control.spec.js` to prevent regression

### Test Infrastructure
- **Issue #257**: Removed `window.onConnectionStateChange` global - use DOM instead
  - Removed all window globals for connection state tracking
  - Updated tests to use DOM-based connection state tracking via `data-testid` attributes
  - Connection states now visible in UI for better debugging
  - More maintainable architecture - tests read from visible DOM elements

## 🔧 Changed

### Test App Refactoring
- **Refactoring**: Moved transcript history from window globals to DOM (PR #258)
  - Removed `window.transcriptHistory` global - replaced with DOM-based transcript history display
  - Added transcript history UI with proper contrast colors for debugging
  - Updated tests to read from DOM using `data-testid` attributes
  - Real-time streaming rate calculation - audio samples now stream at correct real-time rate (32KB/s for 16kHz PCM)
  - Better TypeScript types - added `TranscriptHistoryEntry` type

### Audio Helpers
- **Centralization**: Consolidated WAV/JSON detection and PCM extraction in `audio-helpers.js`
  - Added validation for WAV file integrity (32KB minimum)
  - Centralized audio processing logic for better maintainability
  - Improved streaming rate verification logging

## 📚 Documentation

- **Issue #254**: Updated interim transcript documentation
  - `INTERIM-RESULTS-LIMITATION.md`: Updated to reflect successful real-time streaming approach
  - `ISSUE-254-INTERIM-TRANSCRIPTS-VALIDATION.md`: Marked as resolved with working test reference
  - `ISSUES-254-255-RESOLUTION.md`: New document summarizing both resolutions

- **Test Documentation**: Added recording guides for audio samples
  - Updated `samples.json` with `source` field (human vs synthetic)
  - Improved documentation for audio sample creation and usage

## 🔗 Related Issues

- [#254](https://github.com/Signal-Meaning/dg_react_agent/issues/254) - Interim transcripts not being reported
- [#255](https://github.com/Signal-Meaning/dg_react_agent/issues/255) - Microphone button doesn't start transcription service when agent is already connected
- [#257](https://github.com/Signal-Meaning/dg_react_agent/issues/257) - Remove window.onConnectionStateChange global - use DOM instead

---

**Full Changelog**: [v0.6.0...v0.6.1](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.0...v0.6.1)

