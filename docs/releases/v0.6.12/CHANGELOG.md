# Changelog: v0.6.12

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: December 3, 2025  
**Previous Version**: v0.6.11

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## ✨ Added

### Diagnostic Logging for agentOptions Re-send
- **Issue #311**: Added diagnostic logging to help identify why Settings might not re-send when `agentOptions` changes after connection
  - **Problem**: Customer reported that component wasn't re-sending Settings when `agentOptions` changes after connection, but our tests show this functionality works. Needed diagnostic tools to identify which condition is preventing re-send.
  - **Solution**: 
    - Added comprehensive diagnostic logging that shows all conditions required for re-send
    - Logs change detection, connection state, and settings flag status
    - Can be enabled via `debug={true}` prop or `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` flag
    - Provides actionable information to identify root cause
  - **Impact**: 
    - Developers can now diagnose why re-send isn't triggering
    - Helps identify if issue is with object mutation, connection state, or settings flag
    - No breaking changes - logging only enabled when explicitly requested
    - All existing tests still passing (6/6 agent-options-timing tests)

## 🔗 Related Issues

- [#311](https://github.com/Signal-Meaning/dg_react_agent/issues/311) - Investigate: Component not re-sending Settings when agentOptions changes after connection

## 📝 Commits Included

- `4019f94` - Merge diagnostic logging feature for Issue #311
- `450dbef` - docs: update Issue #311 with diagnostic logging implementation
- `8b1d71b` - feat: add diagnostic logging for agentOptions re-send (Issue #311)
- `0b4c336` - docs: add Issue #311 investigation document

---

**Full Changelog**: [v0.6.11...v0.6.12](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.11...v0.6.12)

