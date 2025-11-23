## 🚀 Release v0.6.8: Patch Release - Enhanced Function Call Handling

**Version**: v0.6.8  
**Date**: January 2025  
**Status**: Released  
**Previous Version**: v0.6.7

### Overview

This is a patch release that enhances function call handling with improved developer experience and fixes state management for client-side function calls. This release includes no breaking changes and maintains full backward compatibility.

### ✨ New Features

#### sendResponse Callback Parameter
- **Enhanced API**: The `onFunctionCallRequest` callback now receives a `sendResponse` function as its second parameter
  - Eliminates the need for component refs and null checks
  - More ergonomic API for handling function calls
  - Maintains backward compatibility with ref-based `sendFunctionCallResponse` method
  - Exported `FunctionCallRequest` and `FunctionCallResponse` types for better TypeScript support

### 🐛 Bug Fixes

#### Thinking State for Client-Side Function Calls
- **Fixed**: Component now correctly emits 'thinking' state when `FunctionCallRequest` is received for client-side functions
  - Provides consistent state management across all function call types
  - Improved code organization with extracted helper function
  - Enhanced type safety

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.8 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- [Changelog](docs/releases/v0.6.8/CHANGELOG.md)
- [API Changes](docs/releases/v0.6.8/API-CHANGES.md)
- [Package Structure](docs/releases/v0.6.8/PACKAGE-STRUCTURE.md)

### 🔗 Related Issues

- [#293](https://github.com/Signal-Meaning/dg_react_agent/issues/293) - Add sendResponse callback parameter to onFunctionCallRequest
- [#294](https://github.com/Signal-Meaning/dg_react_agent/issues/294) - Emit thinking state for client-side function calls
- [#296](https://github.com/Signal-Meaning/dg_react_agent/pull/296) - Add sendResponse callback parameter to onFunctionCallRequest
- [#297](https://github.com/Signal-Meaning/dg_react_agent/pull/297) - Fix Issue #294: Emit thinking state for client-side function calls

### 📋 Migration Notes

This is a **patch release** with **no breaking changes**. All existing APIs remain unchanged and fully compatible.

### 🧪 Testing

- ✅ Function call response tests passing (13/13 tests)
- ✅ Thinking state tests passing (6/6 tests)
- ✅ All unit tests passing (615 passed, 6 skipped)
- ✅ No linting errors
- ✅ Build successful

---

**Full Changelog**: [v0.6.7...v0.6.8](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.7...v0.6.8)

