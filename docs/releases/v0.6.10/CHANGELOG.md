# Changelog: v0.6.10

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: November 2024  
**Previous Version**: v0.6.9

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🐛 Fixed

### Keepalive During Thinking State for Function Calls
- **Issue #302**: Fixed component not sending keepalive messages during thinking state, causing CLIENT_MESSAGE_TIMEOUT errors
  - **Problem**: Component was not sending keepalive messages when agent entered "thinking" state (processing function calls), causing connection timeouts for text-only input
  - **Root Cause**: Keepalive mechanism was not active during thinking state, allowing connection to timeout before agent could respond after function call completion
  - **Fix**: 
    - Component now maintains keepalive messages during thinking state
    - Keepalive continues until agent exits thinking state
    - Prevents CLIENT_MESSAGE_TIMEOUT errors during function call processing
    - Allows agent to respond successfully after receiving FunctionCallResponse
  - **Impact**: 
    - Text-only input with function calls now works without timeout errors
    - Agent can successfully respond after function call execution
    - Connection remains alive during function call processing
    - No breaking changes - existing code continues to work
  - **Test Coverage**: Added comprehensive tests in `tests/function-call-thinking-state.test.tsx` (295 lines, multiple test cases)

## 🔗 Related Issues

- [#302](https://github.com/Signal-Meaning/dg_react_agent/issues/302) - Component not performing keepalive during thinking state
- [#303](https://github.com/Signal-Meaning/dg_react_agent/pull/303) - fix: Maintain keepalive during thinking state for function calls (Issue #302)

## 📝 Commits Included

- `5168285` - Merge pull request #303 from Signal-Meaning/davidrmcgee/issue302
- `6fa271b` - fix: Maintain keepalive during thinking state for function calls (Issue #302)

---

**Full Changelog**: [v0.6.9...v0.6.10](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.9...v0.6.10)

