## 🚀 Release v0.6.12: Patch Release - Diagnostic Logging for agentOptions Re-send

**Version**: v0.6.12  
**Date**: December 3, 2025  
**Status**: Released  
**Previous Version**: v0.6.11

### Overview

This is a patch release that adds diagnostic logging to help identify why Settings might not re-send when `agentOptions` changes after connection is established. This addresses Issue #311 where a customer reported the component wasn't re-sending Settings, but our tests show this functionality works correctly.

### ✨ New Feature

#### Diagnostic Logging for agentOptions Re-send
- **Issue #311**: Added diagnostic logging to help identify why re-send might not trigger
- **Problem**: Customer reported component wasn't re-sending Settings when `agentOptions` changes after connection
- **Solution**: Added comprehensive diagnostic logging that shows all conditions required for re-send
- **Impact**: 
  - Developers can now diagnose why re-send isn't triggering
  - Helps identify if issue is with object mutation, connection state, or settings flag
  - No breaking changes - logging only enabled when explicitly requested

### 🔧 How to Use Diagnostic Logging

#### Enable via Debug Prop

```tsx
<DeepgramVoiceInteraction debug={true} agentOptions={agentOptions} />
```

#### Enable via Window Flag (for testing)

```javascript
window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
```

#### What Gets Logged

When `agentOptions` changes, the component logs:

1. **Change Detection Diagnostic**:
   - `agentOptionsChanged`: Whether deep comparison detected a change
   - `agentOptionsExists`: Whether agentOptions is defined
   - `agentManagerExists`: Whether agent manager is initialized
   - `connectionState`: Current connection state
   - `isConnected`: Whether connection is 'connected'
   - `hasSentSettingsBefore`: Whether Settings were sent before
   - `willReSend`: Whether all conditions are met for re-send

2. **Re-send Blocked Warning** (if conditions not met):
   - Which condition failed
   - Reason for blocking

3. **Change Detection Info** (if change not detected):
   - Why change detection didn't trigger

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.12 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.12/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.12/PACKAGE-STRUCTURE.md)
- [Issue #311 Investigation](docs/issues/ISSUE-311/ISSUE-311-AGENT-OPTIONS-RESEND.md)

### 🔗 Related Issues

- [#311](https://github.com/Signal-Meaning/dg_react_agent/issues/311) - Investigate: Component not re-sending Settings when agentOptions changes after connection

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible. Diagnostic logging is opt-in only.

### 🧪 Testing

- ✅ All existing tests passing (6/6 agent-options-timing tests)
- ✅ Diagnostic logging doesn't affect normal operation
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.11...v0.6.12](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.11...v0.6.12)

