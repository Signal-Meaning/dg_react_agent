# dg_react_agent v0.4.0 Release Notes

## 🎉 Minor Release: v0.4.0

**Release Date**: October 15, 2025  
**Previous Version**: v0.3.0  
**Breaking Changes**: None - Backward compatible

## Overview

dg_react_agent v0.4.0 introduces critical bug fixes and new TTS capabilities, significantly improving the user experience with reliable microphone reconnection and text-to-speech functionality without audio recording requirements.

## 🐛 Bug Fixes

### Microphone Reconnection Fix (Issue #58)
- **Fixed**: Microphone button fails to reconnect after connection timeout
- **Root Cause**: Race condition where connection closes immediately after establishment
- **Solution**: 
  - Added connection stability check in `resumeWithAudio` function
  - Implemented retry logic for unstable connections
  - Enhanced error handling with specific user-friendly messages
  - Prevents "Agent not connected (state: closed)" errors

### Connection Stability Improvements
- **Connection Verification**: Multiple stability checks before enabling microphone
- **Retry Mechanism**: Automatic reconnection attempt if stability check fails
- **Error Messages**: Clear, actionable error messages for different failure scenarios
- **Race Condition Prevention**: Eliminates timing issues in reconnection flow

## ✨ New Features

### TTS without STT Capability (Issue #24)
- **Agent-Only Mode**: Component can operate with only `agentOptions` (no `transcriptionOptions`)
- **connectTextOnly()**: Method enables TTS without any audio recording
- **Auto-Connect Dual Mode**: Establishes connection for TTS with user interaction
- **Text Input Interface**: Users can send text messages and receive audio responses

### Enhanced Audio Capabilities
- **Independent TTS**: Text-to-speech works without speech-to-text dependency
- **Browser Autoplay Compliance**: Proper handling of browser audio policies
- **User Interaction Requirements**: Clear user gesture requirements for audio playback
- **Seamless Integration**: Works with existing auto-connect functionality

## 🔧 Technical Improvements

### Connection Management
- **Stability Verification**: Comprehensive connection stability checks
- **Retry Logic**: Intelligent retry mechanism for failed connections
- **Error Recovery**: Enhanced error handling and recovery mechanisms
- **State Management**: Improved connection state tracking

### Audio Pipeline
- **TTS Independence**: Audio playback without microphone requirements
- **Browser Compatibility**: Proper AudioContext management
- **User Gesture Handling**: Compliance with browser autoplay policies
- **Performance Optimization**: Reduced unnecessary audio initialization

### Testing & Quality
- **Comprehensive Tests**: New test suite for connection stability
- **Error Handling Tests**: Tests for various failure scenarios
- **Integration Tests**: End-to-end testing of new functionality
- **Backward Compatibility**: All existing tests continue to pass

## 📋 What's New

### Added
- `connectTextOnly()` method for TTS without STT
- Connection stability verification system
- Retry mechanism for unstable connections
- Enhanced error messages for microphone reconnection
- Agent-Only Mode documentation
- Comprehensive test coverage for new features

### Fixed
- Microphone reconnection after connection timeout
- Race condition in connection establishment
- Error handling in `resumeWithAudio` function
- Connection stability issues
- User experience with failed reconnections

### Improved
- Error messages for better user feedback
- Connection reliability and stability
- TTS functionality without audio recording
- Browser autoplay policy compliance
- Overall user experience

## 🧪 Testing

### Test Coverage
- **Connection Stability Tests**: Verify reconnection reliability
- **TTS Independence Tests**: Confirm TTS works without STT
- **Error Handling Tests**: Test various failure scenarios
- **Integration Tests**: End-to-end functionality verification
- **Backward Compatibility**: All existing tests pass

### Test Results
- ✅ All existing tests continue to pass
- ✅ New tests verify microphone reconnection fix
- ✅ New tests verify TTS independence functionality
- ✅ Context preservation tests pass
- ✅ Reconnection scenario tests pass

## 📚 Documentation Updates

### Component Documentation
- **Agent-Only Mode**: Updated component usage documentation
- **connectTextOnly()**: Added method documentation
- **TTS Capabilities**: Enhanced audio functionality documentation
- **Migration Guide**: Updated for v0.4.0 changes

### API Documentation
- **New Methods**: Documented `connectTextOnly()` method
- **Configuration Options**: Updated for Agent-Only Mode
- **Error Handling**: Enhanced error message documentation
- **Examples**: Added TTS-only usage examples

## 🔗 Related Issues

- **Closes #58**: Microphone button fails to reconnect after connection timeout
- **Closes #24**: Investigate enabling TTS without audio recording
- **Related to #43**: Greeting audio timing (solution identified)

## 📦 Dependencies

- **No new dependencies added**
- **All changes use existing functionality**
- **Backward compatible with v0.3.0**

## 🚀 Migration Guide

### From v0.3.0 to v0.4.0

No breaking changes - this is a minor version with full backward compatibility.

### New Capabilities

#### TTS without STT
```tsx
// Agent-Only Mode (TTS without STT)
const agentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-2',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful voice assistant.'
}), []);

<DeepgramVoiceInteraction 
  agentOptions={agentOptions}
  // No transcriptionOptions - enables Agent-Only Mode
/>
```

#### Text-Only Connection
```tsx
// Connect for text-only interactions
await deepgramRef.current.connectTextOnly();

// Send text and receive audio response
await deepgramRef.current.resumeWithText("Hello, how are you?");
```

### Enhanced Error Handling
```tsx
// Better error messages for reconnection failures
onError={(error) => {
  if (error.message.includes('Connection failed stability check')) {
    // Handle connection stability issues
  } else if (error.message.includes('Agent not connected')) {
    // Handle connection loss
  }
}}
```

## 🎯 Performance Impact

- **Positive Impact**: Improved connection reliability
- **No Performance Regression**: All existing functionality maintained
- **Enhanced User Experience**: Better error handling and feedback
- **Reduced Support Issues**: Fewer connection-related problems

## 🔮 Future Considerations

- **Enhanced TTS Controls**: More granular TTS management
- **Advanced Error Recovery**: Even more robust error handling
- **Performance Monitoring**: Connection quality metrics
- **User Experience**: Further UX improvements

## 📞 Support

For questions or issues with v0.4.0:
- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check updated component documentation
- **Migration Help**: Refer to migration guide above

---

**Full Changelog**: [v0.3.0...v0.4.0](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.3.0...v0.4.0)
