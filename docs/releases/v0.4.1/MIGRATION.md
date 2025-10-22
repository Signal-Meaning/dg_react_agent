# Migration Guide: v0.4.0 to v0.4.1

## Overview

This is a **patch release** with critical bug fixes and stability improvements. No breaking changes are introduced.

## What's Fixed

### Idle Timeout Management (Issue #139)
- **Fixed**: Race condition where idle timeout starts while audio is playing
- **Fixed**: Improved idle timeout during agent activity
- **Improved**: End-of-speech detection using Deepgram best practices
- **Refactored**: Consolidated useEffect hooks and extracted custom hook

### Debug Logging (Issue #138)
- **Fixed**: Moved VAD and keepalive debug logs to debug mode only
- **Improved**: Reduced log noise in production environments

### Authentication (Issue #132)
- **Fixed**: Resolved persistent 401 authentication errors
- **Fixed**: Updated workflows to use NPM_PACKAGES_TOKEN for authentication
- **Added**: Comprehensive debugging tools for authentication issues

### Test Stability (Issue #130)
- **Fixed**: Test failures that were blocking v0.4.0 release
- **Improved**: Enhanced test reliability and coverage

## Migration Steps

### ✅ No Action Required

This is a patch release with no breaking changes:

1. **Update Package**: Simply update to the new version
   ```bash
   npm install @signal-meaning/deepgram-voice-interaction-react@0.4.1 --registry https://npm.pkg.github.com
   ```

2. **No Code Changes**: All existing code will continue to work without modification

3. **No Configuration Changes**: No configuration updates needed

4. **Backward Compatible**: Fully compatible with all previous versions

## What You Get

### Improved Stability
- More reliable idle timeout behavior
- Better handling of audio playback states
- Enhanced error handling and recovery

### Better Development Experience
- Cleaner debug output in production
- Improved authentication debugging tools
- More reliable test suite

### Security Improvements
- Enhanced .npmrc handling for better security
- Improved authentication token management

## Verification

After updating to v0.4.1, verify the following:

1. **Idle Timeout**: Test that idle timeouts work correctly during agent speech
2. **Debug Logs**: Verify debug logs only appear when debug mode is enabled
3. **Authentication**: Confirm package installation works correctly
4. **Existing Features**: All existing functionality should work as before

## Support

If you encounter any issues during migration:

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](../README.md)
- **Previous Migration Guides**: See [migration documentation](../../migration/README.md)

---

**Previous Version**: [v0.4.0 Migration Guide](../v0.4.0/MIGRATION.md)  
**Next Version**: TBD  
**Full Documentation**: [docs/releases/v0.4.1/](./)  
**GitHub Repository**: [Signal-Meaning/dg_react_agent](https://github.com/Signal-Meaning/dg_react_agent)
