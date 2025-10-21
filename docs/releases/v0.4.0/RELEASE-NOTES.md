# Release v0.4.0: Manual Publishing Workaround Complete

## 🚀 **Release Summary**

**Version**: v0.4.0  
**Date**: January 21, 2025  
**Status**: ✅ **Published to GitHub Package Registry**

## 📦 **Package Information**

- **Package Name**: `@signal-meaning/deepgram-voice-interaction-react`
- **Version**: `0.4.0`
- **Registry**: GitHub Package Registry (`https://npm.pkg.github.com`)
- **Installation**: `npm install @signal-meaning/deepgram-voice-interaction-react@0.4.0 --registry https://npm.pkg.github.com`

## 🎯 **Key Features**

### **TTS Mute Functionality**
- Complete TTS mute/unmute capability with `toggleTtsMute()` and `setTtsMuted()` methods
- New `onTtsMuteToggle` prop for mute state change notifications
- New `ttsMuted` state property for tracking mute status

### **VoiceAgent Event Hooks**
- `onAgentSpeaking`: Called when agent starts speaking (TTS begins)
- `onAgentSilent`: Called when agent finishes speaking (AgentAudioDone)
- `onUserStoppedSpeaking`: Called when user stops speaking (VAD/endpointing)
- `onUtteranceEnd`: Called when UtteranceEnd is detected from Deepgram's end-of-speech detection
- `onSpeechStarted`: Called when SpeechStarted is detected from Deepgram Transcription API
- `onVADEvent`: Called when VAD events are received from transcription service

### **Enhanced Timeout Management**
- Prevents connection timeouts during agent speech
- Improved idle timeout handling
- Enhanced VAD events and voice activity detection

### **Comprehensive Testing & Documentation**
- Enhanced test suite with E2E and integration tests
- Complete release documentation and migration guides
- Improved development workflow tools

## 🔧 **Technical Improvements**

### **Security**
- Added `.npmrc` to `.gitignore` to prevent token commits
- Enhanced authentication debugging tools
- Improved package configuration

### **Build & Development**
- Enhanced build and validation pipeline
- Improved test mock coverage for AudioManager
- Better development workflow tools

## 📚 **Documentation**

- **[Changelog](CHANGELOG.md)**: Complete list of changes
- **[New Features](NEW-FEATURES.md)**: Detailed feature documentation
- **[API Changes](API-CHANGES.md)**: API surface changes
- **[Migration Guide](MIGRATION.md)**: Migration instructions
- **[Examples](EXAMPLES.md)**: Usage examples and best practices

## 🚨 **Breaking Changes**

**None** - This is a minor version release with no breaking changes. All existing APIs remain unchanged.

## 🔗 **Related Issues**

- **Issue #137**: Manual Release Publishing Workaround ✅ **COMPLETED**
- **Issue #129**: v0.4.0 Release Process ✅ **COMPLETED**
- **Issue #132**: GitHub Package Registry Authentication (workaround implemented)

## 🎉 **Success Metrics**

- ✅ Package successfully published to GitHub Package Registry
- ✅ Voice-commerce team can access the package immediately
- ✅ All tests passing locally
- ✅ Comprehensive documentation completed
- ✅ Security improvements implemented

## 📋 **Next Steps**

1. **Voice-commerce team**: Can now install and use v0.4.0
2. **Future releases**: Continue investigating automated publishing (Issue #132)
3. **Monitoring**: Track package usage and gather feedback

---

**Created**: January 21, 2025  
**Status**: Ready for GitHub Release Creation  
**Package**: Available for immediate use by voice-commerce team
