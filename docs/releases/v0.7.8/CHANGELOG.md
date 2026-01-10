# Changelog - v0.7.8

**Release Date**: January 10, 2026  
**Release Type**: Patch Release

## Fixed

- **Issue #357/#769**: Fixed component remounting during reconnection
  - Removed `isReady` state check from initialization condition
  - Component now only re-initializes on first mount or when dependencies actually change
  - Prevents remount loops during reconnection scenarios
  - Added E2E test for remount detection during multiple reconnection cycles

## Changed

- `src/components/DeepgramVoiceInteraction/index.tsx`: Updated initialization logic to prevent unnecessary re-initialization
  - Removed `isReady` state from initialization decision logic
  - Component only re-initializes based on actual prop changes, not internal state changes
  - Added better debug logging to show why initialization occurs

## Added

- `test-app/tests/e2e/component-remount-reconnection.spec.js`: E2E test for remount detection during multiple reconnection cycles
