# Changelog: v0.6.14

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: December 3, 2025  
**Previous Version**: v0.6.13

## 🔍 Diagnostic Enhancement

### Entry Point Logging for Issue #311
- **Issue #311**: Added entry point logging to `agentOptions` useEffect to help diagnose why diagnostic logs might not appear
- **Purpose**: Verify that the useEffect is running when `agentOptions` changes
- **Logs Added**:
  - Entry point log when useEffect triggers
  - First render log when skipping change detection
  - Helps identify if useEffect isn't running vs conditions not being met
- **Impact**: 
  - No behavior changes - diagnostic logging only
  - Helps diagnose customer issue where diagnostic logs aren't appearing
  - All tests still passing

## 🔗 Related Issues

- [#311](https://github.com/Signal-Meaning/dg_react_agent/issues/311) - Investigate: Component not re-sending Settings when agentOptions changes after connection

## 📝 Commits Included

- `81d1811` - docs: update Issue #311 with latest customer findings and investigation status
- `6c08a53` - feat: add entry point logging to agentOptions useEffect (Issue #311)

---

**Full Changelog**: [v0.6.13...v0.6.14](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.13...v0.6.14)
