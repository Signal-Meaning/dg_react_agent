# Changelog: v0.6.7

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 14, 2025  
**Previous Version**: v0.6.6

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Functions Not Included in Settings Message
- **Critical Bug Fix**: Fixed issue where `agentOptions.functions` were not included in the Settings message sent to Deepgram
  - **Problem**: Functions passed in `agentOptions.functions` were not being included in the `think` section of the Settings message, causing E2E test failures
  - **Root Cause**: The `sendAgentSettings` function was building the Settings message but omitting `agentOptions.functions` in the `think` section
  - **Fix**: Added functions to the `think` section when provided:
    ```typescript
    ...(agentOptions.functions && agentOptions.functions.length > 0 ? {
      functions: agentOptions.functions
    } : {})
    ```
  - **Impact**: Functions are now correctly included in Settings message, resolving customer E2E test failures
  - **Test Coverage**: Created comprehensive test suite (`tests/function-calling-settings.test.tsx`) with 6 tests:
    - Functions included when provided
    - Functions not included when not provided
    - Functions not included when empty array
    - Functions included with other think settings (endpoint, prompt, etc.)
    - Server-side functions with endpoint
    - Extra properties preserved in functions

## 🔗 Related Issues

- Customer E2E test failures: Functions not included in Settings message
- Commit: `5b033f6` - fix: include functions in Settings message sent to Deepgram

---

**Full Changelog**: [v0.6.6...v0.6.7](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.6...v0.6.7)

