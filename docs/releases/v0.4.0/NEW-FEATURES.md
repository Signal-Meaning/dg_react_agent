# New Features - v0.4.0

## 🎤 TTS Mute Functionality

### Complete Audio Control
- **Toggle Method**: `toggleTtsMute()` - Toggle TTS mute state on/off
- **Set Method**: `setTtsMuted(muted: boolean)` - Explicitly set mute state
- **State Property**: `ttsMuted` - Track current mute state
- **Callback**: `onTtsMuteToggle(isMuted: boolean)` - React to mute state changes

### Usage Examples
```typescript
// Basic usage
const ref = useRef<DeepgramVoiceInteractionHandle>(null);

const handleMuteToggle = () => {
  ref.current?.toggleTtsMute();
};

// Explicit control
const handleMuteChange = (shouldMute: boolean) => {
  ref.current?.setTtsMuted(shouldMute);
};

// React to changes
<DeepgramVoiceInteraction
  onTtsMuteToggle={(isMuted) => {
    console.log('TTS muted:', isMuted);
    setMuteButtonText(isMuted ? '🔇 MUTED' : '🔊 ENABLED');
  }}
/>
```

## 🎯 VoiceAgent Event Hooks

### Comprehensive Voice Interaction Events
- **Agent Events**: `onAgentSpeaking()` / `onAgentSilent()` - Track when agent starts/stops speaking
- **User Events**: `onUserStoppedSpeaking()` - Detect when user stops speaking
- **VAD Events**: `onUtteranceEnd()`, `onSpeechStarted()`, `onVADEvent()` - Voice Activity Detection
- **Real-time Data**: Access to Deepgram's voice activity detection data

### Event Callback Examples
```typescript
<DeepgramVoiceInteraction
  // Agent speaking events
  onAgentSpeaking={() => {
    console.log('Agent started speaking');
    setAgentStatus('Speaking...');
  }}
  onAgentSilent={() => {
    console.log('Agent finished speaking');
    setAgentStatus('Listening...');
  }}
  
  // User speech events
  onUserStoppedSpeaking={() => {
    console.log('User stopped speaking');
    setUserStatus('Processing...');
  }}
  
  // VAD events with data
  onUtteranceEnd={(data) => {
    console.log('Utterance ended:', data);
    // data: { channel: number[]; lastWordEnd: number }
  }}
  onSpeechStarted={(data) => {
    console.log('Speech started:', data);
    // data: { channel: number[]; timestamp: number }
  }}
  onVADEvent={(data) => {
    console.log('VAD event:', data);
    // data: { speechDetected: boolean; confidence?: number; timestamp?: number }
  }}
/>
```

## ⏱️ Enhanced Idle Timeout Management

### Smart Connection Management
- **Agent Speech Protection**: Prevents timeouts during agent responses
- **Intelligent Timing**: Only times out during actual idle periods
- **Connection Stability**: Maintains stable connections during voice interactions

### How It Works
```typescript
// Automatic timeout management
// - Disables timeouts when agent starts speaking
// - Re-enables timeouts when agent finishes
// - Prevents mid-sentence disconnections
```

## 🚀 Release Process Enhancement

### Comprehensive Release Checklist
- **Automated Release Process**: New GitHub issue template for consistent release management
- **Documentation Standards**: Established comprehensive documentation structure for all releases
- **Quality Assurance**: Enhanced testing and validation pipeline

### GitHub Issue Template
- **Release Checklist Template**: Pre-configured issue template with complete release process
- **Automated Labeling**: Automatic assignment of release and version labels
- **Process Standardization**: Ensures consistent release process across all versions

## 🔧 Development Workflow Improvements

### Enhanced Test Coverage
- **Improved AudioManager Mocks**: Fixed missing `setTtsMuted` method in test mocks
- **Better Test Reliability**: Enhanced test stability and coverage
- **Mock Consistency**: Standardized mock implementations across test files

### Documentation Infrastructure
- **Release Documentation Standards**: Comprehensive documentation structure
- **Checklist Guidance**: Step-by-step release process documentation
- **Template System**: Reusable templates for consistent documentation

## 📚 Documentation Enhancements

### Release Documentation Structure
```
docs/releases/v0.4.0/
├── CHANGELOG.md           # Detailed change log
├── MIGRATION.md           # Breaking changes & migration guide
├── NEW-FEATURES.md        # New features documentation
├── API-CHANGES.md         # API surface changes
├── EXAMPLES.md            # Usage examples
└── RELEASE-CHECKLIST.md   # Release process checklist
```

### Documentation Standards
- **Keep a Changelog Format**: Standardized changelog format
- **Comprehensive Coverage**: All changes documented with proper categorization
- **Migration Guidance**: Clear migration steps for breaking changes
- **Example Documentation**: Working code examples for all features

## 🛠️ Build and Validation Improvements

### Enhanced Package Validation
- **Plugin Validation**: Improved validation process for React plugin compatibility
- **Dependency Updates**: Updated 12 packages to latest versions
- **Build Pipeline**: Enhanced build and packaging process

### Quality Assurance
- **Test Coverage**: Improved test coverage for AudioManager functionality
- **Mock Consistency**: Standardized mock implementations
- **Validation Pipeline**: Enhanced package validation and testing

## 🎯 Benefits

### For Developers
- **Consistent Process**: Standardized release process reduces errors
- **Better Documentation**: Comprehensive documentation improves understanding
- **Enhanced Testing**: Improved test coverage increases reliability

### For Teams
- **Process Standardization**: Consistent release process across all versions
- **Quality Assurance**: Enhanced testing and validation pipeline
- **Documentation Standards**: Comprehensive documentation for all releases

### For Users
- **No Breaking Changes**: Backward compatible with all previous versions
- **Improved Reliability**: Enhanced test coverage increases stability
- **Better Documentation**: Comprehensive documentation improves usability

## 🔗 Related Information

- **GitHub Issue**: [#129](https://github.com/Signal-Meaning/dg_react_agent/issues/129)
- **Release Checklist**: [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)
- **Documentation Standards**: [docs/releases/README.md](../README.md)
- **Migration Guide**: [docs/migration/README.md](../../migration/README.md)

---

**Next Steps**: See [API-CHANGES.md](./API-CHANGES.md) for detailed API changes and [EXAMPLES.md](./EXAMPLES.md) for usage examples.
