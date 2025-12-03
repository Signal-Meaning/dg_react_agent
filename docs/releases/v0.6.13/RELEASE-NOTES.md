## 🚀 Release v0.6.13: Patch Release - Fix Diagnostic Logging

**Version**: v0.6.13  
**Date**: December 3, 2025  
**Status**: Released  
**Previous Version**: v0.6.12

### Overview

This is a patch release that fixes a bug in v0.6.12 where diagnostic logs weren't appearing when using the `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` flag. The diagnostic logging feature now works correctly.

### 🐛 Bug Fix

#### Diagnostic Logs Not Appearing
- **Issue #311**: Fixed diagnostic logs not appearing when window flag is set
- **Problem**: Diagnostic logging was checking for `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` but then calling `log()` which requires `props.debug`, causing logs to be suppressed
- **Fix**: Changed diagnostic logging to use `console.log` directly, so logs appear when either `props.debug` OR `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` is set
- **Impact**: 
  - Diagnostic logs now appear correctly
  - Customers can now diagnose why Settings might not re-send
  - No breaking changes

### 🔧 How to Use Diagnostic Logging

#### Enable via Window Flag (Now Works!)

```javascript
window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
```

#### Enable via Debug Prop (Still Works)

```tsx
<DeepgramVoiceInteraction debug={true} agentOptions={agentOptions} />
```

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.13 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.13/CHANGELOG.md)
- [Package Structure](docs/releases/v0.6.13/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#311](https://github.com/Signal-Meaning/dg_react_agent/issues/311) - Investigate: Component not re-sending Settings when agentOptions changes after connection

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ All existing tests passing
- ✅ Diagnostic logging now works with window flag
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.12...v0.6.13](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.12...v0.6.13)

