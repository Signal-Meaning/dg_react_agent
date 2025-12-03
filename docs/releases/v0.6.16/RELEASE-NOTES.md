# Release Notes - v0.6.16

**Release Date**: December 3, 2025  
**Release Type**: Patch Release

## Overview

This patch release fixes a critical issue where the `useEffect` hook responsible for re-sending Settings when `agentOptions` changes was not running in minified/production builds.

## Critical Fix

### Issue #318: useEffect Not Running in Minified Builds

**Problem**: The `useEffect` hook that watches `agentOptions` changes was not executing in minified builds, preventing Settings from being re-sent when `agentOptions` changed after initial connection.

**Root Cause**: Destructured variables in React dependency arrays may not work correctly when code is minified. The minified code showed `[S, t.debug]` where `S = props.agentOptions` (destructured), and React's dependency tracking wasn't working correctly with this pattern.

**Solution**: Changed the dependency array from `[agentOptions, props.debug]` to `[props.agentOptions, props.debug]` to use direct property access instead of the destructured variable.

**Impact**: 
- ✅ Settings are now correctly re-sent when `agentOptions` changes, even in production/minified builds
- ✅ Works correctly with `useMemo` patterns for creating `agentOptions`
- ✅ No breaking changes - API remains the same

**Code Change**:
```typescript
// Before (line 1189)
}, [agentOptions, props.debug]);

// After
}, [props.agentOptions, props.debug]);
```

## Other Changes

- Updated release script to create `release/vX.X.X` branch format (matches checklist requirements)
- Fixed lint warning: Replaced `any` with `unknown` in `TranscriptionOptions.metadata` type

## Migration Guide

No migration required. This is a patch release with no breaking changes.

If you were experiencing issues with `agentOptions` changes not triggering Settings re-send in production builds, this release fixes that issue automatically.

## Testing

All tests pass (667 tests, 0 failures). The fix has been verified to work correctly in both development and production builds.

## Related Issues

- Issue #318: useEffect not running when agentOptions changes

## Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.16
```

## Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Detailed changelog
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) - Package contents and structure
- [Issue #318 Fix Documentation](../../ISSUE-318-FIX-IMPLEMENTED.md) - Detailed fix documentation

