# Deepgram Voice Interaction React

A React component for real-time transcription and voice agent interactions using Deepgram APIs.

## 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react
```

## 🚀 Quick Start

```tsx
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function MyApp() {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-deepgram-api-key"
      agentOptions={{
        greeting: "Hello! How can I help you today?",
        instructions: "You are a helpful voice assistant.",
        voice: "aura-asteria-en",
      }}
    />
  );
}
```

## 📚 Documentation

### **Latest Version (v0.5.0)**
- **[API Reference](releases/v0.5.0/API-REFERENCE.md)** - Complete API documentation
- **[Integration Guide](releases/v0.5.0/INTEGRATION-GUIDE.md)** - Detailed integration patterns
- **[Migration Guide](releases/v0.5.0/MIGRATION.md)** - Migrating from v0.4.x

### **Previous Versions**
- **[v0.4.1](releases/v0.4.1/)** - Previous stable release
- **[v0.4.0](releases/v0.4.0/)** - Feature releases
- **[v0.3.x](releases/v0.3.0/)** - Legacy versions

### **Migration Guides**
- **[v0.2.1 → v0.3.0](migration/v0.2.1-to-v0.3.0.md)** - Legacy migration

## 🔧 Development

For development setup, testing, and internal documentation, see:
- **[Development Guide](development/DEVELOPMENT.md)**
- **[Technical Setup](development/TECHNICAL-SETUP.md)**
- **[Testing Guide](development/TESTING-QUICK-START.md)**

## 🐛 Issues & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Comprehensive docs in `/docs` directory
- **Test Suite**: 90%+ test coverage with Jest and Playwright

## 📄 License

Private package - Signal-Meaning organization only.

---

**Current Version**: v0.5.0  
**Last Updated**: December 2024  
**Status**: ✅ Production Ready