# Changelog: v0.6.13

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: December 3, 2025  
**Previous Version**: v0.6.12

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Diagnostic Logs Not Appearing When Using Window Flag
- **Issue #311**: Fixed diagnostic logs not appearing when `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` is set
  - **Problem**: Diagnostic logging was implemented in v0.6.12, but logs weren't appearing when using the window flag. The `log()` function only outputs when `props.debug` is true, but diagnostic logging should work independently via the window flag.
  - **Root Cause**: Diagnostic logging checked for `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` but then called `log()` which requires `props.debug`, causing logs to be suppressed.
  - **Fix**: 
    - Changed diagnostic logging to use `console.log` directly instead of `log()` function
    - Diagnostic logs now appear when either `props.debug` OR `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` is set
    - Maintains backward compatibility - `props.debug` still works as before
  - **Impact**: 
    - Diagnostic logs now appear correctly when window flag is set
    - Customers can now diagnose why Settings might not re-send
    - No breaking changes - existing behavior unchanged
    - All tests still passing

## 🔗 Related Issues

- [#311](https://github.com/Signal-Meaning/dg_react_agent/issues/311) - Investigate: Component not re-sending Settings when agentOptions changes after connection

## 📝 Commits Included

- `5f362d4` - fix: diagnostic logs not appearing when using window flag (Issue #311)

---

**Full Changelog**: [v0.6.12...v0.6.13](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.12...v0.6.13)

