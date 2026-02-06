# Test App Documentation

**Version**: 0.5.0+  
**Last Updated**: October 2025

## 🎯 Purpose

This documentation directory contains comprehensive guides and examples for integrating the `@signal-meaning/deepgram-voice-interaction-react` component into React applications. The documentation is organized by release version and covers real-world integration patterns, best practices, and advanced use cases.

## 📁 Documentation Structure

### Core Documentation

- **[Proxy Server: Purpose, Design, Operation, and Tests](./PROXY-SERVER.md)** - Complete explanation of the test-app proxy server: purpose, design, operation, and tests (Deepgram + OpenAI on one port)
- **[Transcript DOM Structure](./TRANSCRIPT-DOM-STRUCTURE.md)** - How the test-app displays transcribed speech in the DOM for E2E testing
- **[OpenAI Proxy and Issue #381](./OPENAI-PROXY-AND-ISSUE-381.md)** - OpenAI Realtime proxy backend, test-app and proxy improvements, env, and E2E with the proxy
- **Conversation storage** - See [Conversation storage (docs)](../../docs/CONVERSATION-STORAGE.md). The component is intended to own persistence *logic*; the application provides the storage implementation (so conversations can use encrypted or custom storage). The **test-app demonstrates** this pattern using **localStorage** as the storage medium (key `dg_voice_conversation`, last 50 messages). When the component gains an injected storage interface, the test-app will provide a localStorage-backed implementation.

### Current Release

- **[v0.5.0 Documentation](./releases/v0.5.0/)** - Latest release documentation
  - [Context Handling Guide](./releases/v0.5.0/CONTEXT-HANDLING.md) - Conversation context management patterns
  - [Integration Examples](./releases/v0.5.0/INTEGRATION-EXAMPLES.md) - Real-world integration examples
  - [Session Management Guide](./releases/v0.5.0/SESSION-MANAGEMENT.md) - Application-layer session management

## 🔗 Relationship: Test App ↔ Component

### The Component
The `@signal-meaning/deepgram-voice-interaction-react` component is a **headless React component** that provides:
- Real-time voice transcription via Deepgram's API
- AI agent interaction capabilities
- WebSocket connection management
- Audio buffer handling
- Voice Activity Detection (VAD)

**Component Location**: `../src/components/DeepgramVoiceInteraction/`

### The Test App
The test app (`test-app/`) serves as:
- **Reference Implementation** - Demonstrates proper component integration
- **Feature Showcase** - Exercises all component features and APIs
- **Testing Ground** - Validates new features and edge cases
- **Living Documentation** - Provides working examples of best practices

**Test App Location**: `../test-app/src/App.tsx`

### Key Relationships

```
┌─────────────────────────────────────────────────────────┐
│                    Component Package                     │
│  (@signal-meaning/deepgram-voice-interaction-react)     │
│                                                          │
│  - Headless React component                             │
│  - WebSocket management                                 │
│  - Audio handling                                       │
│  - Voice Activity Detection                             │
│  - Type definitions                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ imports & uses
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                      Test App                            │
│                   (test-app/)                           │
│                                                          │
│  - Reference implementation                              │
│  - UI/UX patterns                                       │
│  - State management examples                            │
│  - Error handling patterns                              │
│  - Feature demonstrations                               │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ documents & demonstrates
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Test App Documentation                      │
│               (test-app/docs/)                          │
│                                                          │
│  - Integration patterns                                 │
│  - Best practices                                       │
│  - Real-world examples                                  │
│  - Version-specific guides                              │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Test App Objectives

### 1. **Demonstrate Component Capabilities**

Show developers how to:
- Initialize and configure the component
- Handle events and state changes
- Manage voice interactions
- Implement error handling
- Use advanced features (VAD, context injection, etc.)

### 2. **Validate Component Behavior**

The test app serves as a testing ground for:
- End-to-end integration testing (Playwright)
- Manual testing and QA
- Feature validation before release
- Regression testing
- Performance validation

### 3. **Provide Reference Implementation**

Demonstrate best practices for:
- **State Management** - How to track conversation state
- **Context Preservation** - How to maintain conversation history
- **Session Management** - How to handle multiple sessions
- **Error Recovery** - How to handle connection issues
- **User Experience** - How to provide visual feedback
- **Audio Control** - How to manage TTS playback

### 4. **Document Real-World Patterns**

Show practical examples of:
- Multi-session applications
- Context-aware interactions
- Dynamic instruction updates
- Text-only mode integration
- Auto-connect patterns
- Production-ready architectures

### 5. **Support Developer Onboarding**

Help developers:
- Understand component architecture
- Learn integration patterns quickly
- Avoid common pitfalls
- Implement features correctly
- Debug issues effectively

## 📚 Documentation Philosophy

### Application-Layer Concerns

The component is **intentionally minimal** and does not handle:
- ❌ Session management
- ❌ Conversation history storage
- ❌ Context persistence
- ❌ User preferences
- ❌ UI/UX patterns

These are **application concerns** that should be handled by your application code. The test app documentation shows you how.

### Component Responsibilities

The component focuses on:
- ✅ WebSocket connection management
- ✅ Audio capture and playback
- ✅ Message protocol handling
- ✅ Event notifications
- ✅ Error reporting

## 🚀 Using This Documentation

### For New Developers

1. **Start with [Integration Examples](./releases/v0.5.0/INTEGRATION-EXAMPLES.md)** - See basic integration patterns
2. **Review [Session Management Guide](./releases/v0.5.0/SESSION-MANAGEMENT.md)** - Understand application-layer responsibilities
3. **Study [Context Handling Guide](./releases/v0.5.0/CONTEXT-HANDLING.md)** - Learn conversation context patterns
4. **Explore the test app source** (`../src/App.tsx`) - See a complete implementation

### For Experienced Developers

- Use the guides as reference for specific patterns
- Compare your implementation against test app examples
- Validate your understanding of component architecture
- Find solutions to common integration challenges

### For Contributors

- Update documentation when adding new features
- Ensure test app demonstrates new capabilities
- Keep examples aligned with component API
- Maintain version-specific documentation

## 🔄 Version Alignment

### Current Status: v0.5.0 Development

The documentation in `releases/v0.5.0/` represents the **target API** for the v0.5.0 release. This is forward-looking documentation that guides implementation work.

**Important**: Some documented features may not be fully implemented yet. The documentation serves as:
- API specification for v0.5.0
- Implementation guidance
- Integration targets
- Testing requirements

### Documentation Updates

When updating documentation:
1. Create version-specific directories (`releases/vX.Y.Z/`)
2. Document target API, not just current implementation
3. Align examples with component type definitions
4. Validate code examples for correctness
5. Update this README when structure changes

## 📖 Related Documentation

### Component Documentation
- [Main Documentation](../../docs/) - Core component documentation
- [API Reference](../../docs/releases/v0.5.0/API-REFERENCE.md) - Complete API specification
- [Integration Guide](../../docs/releases/v0.5.0/INTEGRATION-GUIDE.md) - Technical integration guide
- [Development Guide](../../docs/DEVELOPMENT.md) - Development workflow

### Test App Resources
- [Test App README](../README.md) - Test app setup and usage
- [Environment Variables](../ENVIRONMENT_VARIABLES.md) - Configuration guide
- [Test App Source](../src/App.tsx) - Reference implementation

## 🤝 Contributing

When contributing to test app documentation:

1. **Accuracy** - Ensure code examples actually work
2. **Completeness** - Cover edge cases and error handling
3. **Clarity** - Write for developers new to the component
4. **Consistency** - Follow existing documentation patterns
5. **Validation** - Test examples before documenting them

## 📞 Support

### Getting Help
- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check component and test app docs
- **Test App**: Run the test app to see working examples
- **Source Code**: Review `App.tsx` for implementation details

### Common Questions
- "How do transcripts appear in the DOM?" → [Transcript DOM Structure](./TRANSCRIPT-DOM-STRUCTURE.md)
- "How do I manage sessions?" → [Session Management Guide](./releases/v0.5.0/SESSION-MANAGEMENT.md)
- "How do I preserve context?" → [Context Handling Guide](./releases/v0.5.0/CONTEXT-HANDLING.md)
- "How do I integrate the component?" → [Integration Examples](./releases/v0.5.0/INTEGRATION-EXAMPLES.md)
- "Where's the reference implementation?" → [Test App Source](../src/App.tsx)

---

**Last Updated**: October 2025  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+

