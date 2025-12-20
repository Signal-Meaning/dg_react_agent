# Release Notes - v0.7.0

**Release Date**: December 20, 2025  
**Release Type**: Minor Release

## Overview

v0.7.0 introduces two major new features: **Declarative Props API** and **Backend Proxy Support**, along with internal improvements and bug fixes. This release is fully backward compatible - all existing code continues to work without changes.

## 🎯 New Features

### Declarative Props API (Issue #305)

A comprehensive set of declarative props that allow you to control the component using React-friendly patterns, eliminating the need for imperative refs in many common use cases.

**New Props**:
- `userMessage` - Declaratively send user messages
- `autoStartAgent` / `autoStartTranscription` - Automatically start services
- `connectionState` - Declaratively control connection state
- `interruptAgent` - Declaratively interrupt agent speech
- `startAudioCapture` - Declaratively start audio capture

**Benefits**:
- Better React integration patterns
- Easier state management
- Full TypeScript support
- Backward compatible with existing imperative APIs

**Documentation**: See [NEW-FEATURES.md](./NEW-FEATURES.md) and [Issue #305 Documentation](../../issues/ISSUE-305-REFACTORING-ANALYSIS.md)

### Backend Proxy Support (Issue #242)

Secure API key management through backend proxy, allowing you to keep your Deepgram API key on your backend server instead of exposing it in the frontend JavaScript bundle.

**New Props**:
- `proxyEndpoint` - Backend proxy WebSocket endpoint URL
- `proxyAuthToken` - Authentication token for proxy endpoint

**Benefits**:
- API keys never exposed in client-side code
- Better cost control and security
- Meets compliance requirements
- Uses your existing backend infrastructure

**Documentation**: See [NEW-FEATURES.md](./NEW-FEATURES.md) and [Issue #242 Documentation](../../issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md)

## 🔧 Improvements

### Removed lazyLog Feature (Issue #185)
- Replaced all 32 `lazyLog()` calls with standard `console.log()` statements
- All logging now consistently controlled by `props.debug` prop
- Simplifies codebase and removes unnecessary abstraction layer

### Debug-Only Console Logs (Issue #306)
- All `[DEBUG]` prefixed console.log statements now properly guarded by `props.debug` checks
- Prevents debug logs from appearing in production console

## 📝 Changes

### API Changes
- `apiKey` prop is now optional when `proxyEndpoint` is provided
- All new declarative props are optional and backward compatible
- See [API-CHANGES.md](./API-CHANGES.md) for complete details

## 🐛 Bug Fixes

- Fixed failing tests for v0.7.0 release
  - Updated module-exports test to expect optional `apiKey`
  - Fixed WebSocket tests to use `close()` instead of `disconnect()`
  - Added missing `apiKey` prop to error-handling tests

## 📊 Statistics

- **22 commits** since v0.6.16
- **4 major PRs** merged
- **698 tests passing** (20 skipped)
- **0 breaking changes** - fully backward compatible

## 🔄 Migration Guide

**No migration required!** v0.7.0 is fully backward compatible. All existing code continues to work without changes.

### Optional: Adopt New Features

You can optionally adopt the new declarative props or backend proxy support:

**Declarative Props Example**:
```typescript
// Before (Imperative)
const ref = useRef<DeepgramVoiceInteractionHandle>(null);
ref.current?.injectUserMessage('Hello');

// After (Declarative) - Optional
const [userMessage, setUserMessage] = useState('');
<DeepgramVoiceInteraction userMessage={userMessage} />
```

**Backend Proxy Example**:
```typescript
// Before (Direct Mode)
<DeepgramVoiceInteraction apiKey={apiKey} />

// After (Proxy Mode) - Optional
<DeepgramVoiceInteraction proxyEndpoint={proxyEndpoint} />
```

See [EXAMPLES.md](./EXAMPLES.md) for more examples.

## 📚 Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Complete list of all 22 commits
- [NEW-FEATURES.md](./NEW-FEATURES.md) - Detailed feature documentation
- [API-CHANGES.md](./API-CHANGES.md) - Complete API reference
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples and best practices
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) - Package contents

## 🔗 Related Issues and PRs

- **Issue #305**: Declarative Props API - [PR #325](https://github.com/Signal-Meaning/dg_react_agent/pull/325)
- **Issue #242**: Backend Proxy Support - [PR #322](https://github.com/Signal-Meaning/dg_react_agent/pull/322)
- **Issue #185**: Remove lazyLog feature - [PR #326](https://github.com/Signal-Meaning/dg_react_agent/pull/326)
- **Issue #306**: Make console.log statements debug-only - [PR #323](https://github.com/Signal-Meaning/dg_react_agent/pull/323)

## 🧪 Testing

- ✅ All 698 tests passing (20 skipped)
- ✅ Linting clean (2 warnings, no errors)
- ✅ Build successful
- ✅ Backward compatibility verified

## 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.7.0
```

## 🎉 What's Next

This release sets the foundation for:
- Better React integration patterns
- Enhanced security with backend proxy support
- Continued improvements to developer experience

We welcome feedback and contributions! See [DEVELOPMENT.md](../../DEVELOPMENT.md) for contribution guidelines.

---

**Previous Release**: [v0.6.16](./../v0.6.16/RELEASE-NOTES.md)
