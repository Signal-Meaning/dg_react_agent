# Technical Setup Guide

**Audience**: Frontend developers integrating the `@signal-meaning/deepgram-voice-interaction-react` component

## Overview

This document covers the technical requirements and build configuration needed to integrate the `@signal-meaning/deepgram-voice-interaction-react` component into your React application.

> **For usage patterns and examples**: See [INTEGRATION-GUIDE.md](./releases/v0.5.0/INTEGRATION-GUIDE.md)  
> **For complete API reference**: See [API-REFERENCE.md](./releases/v0.5.0/API-REFERENCE.md)

## Prerequisites

- **React 16.8.0+** (hooks support required)
- **Node.js 16+** (for build tools)
- **Deepgram API Key** (get from [Deepgram Console](https://console.deepgram.com/))

## Installation

### 1. Install the Package

```bash
npm install @signal-meaning/deepgram-voice-interaction-react
```

### 2. Verify React Version

Ensure your project uses React 16.8.0 or higher:

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

## Build Configuration

### Webpack Configuration (CRITICAL)

The component uses peer dependencies for React. You must configure webpack aliases to ensure a single React instance:

```javascript
// webpack.config.js or craco.config.js
module.exports = {
  resolve: {
    alias: {
      'react': 'react',
      'react-dom': 'react-dom'
    }
  }
};
```

### Vite Configuration

```javascript
// vite.config.js
export default {
  resolve: {
    alias: {
      'react': 'react',
      'react-dom': 'react-dom'
    }
  }
};
```

### Create React App (CRA)

If using Create React App, you'll need to eject or use CRACO:

```bash
npm install @craco/craco --save-dev
```

```javascript
// craco.config.js
module.exports = {
  webpack: {
    alias: {
      'react': 'react',
      'react-dom': 'react-dom'
    }
  }
};
```

## Environment Variables

### Required Environment Variables

```bash
# .env
VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here
VITE_DEEPGRAM_PROJECT_ID=your_project_id_here
```

### Optional Environment Variables

```bash
# .env
VITE_TRANSCRIPTION_MODEL=nova-3
VITE_AGENT_VOICE=aura-asteria-en
VITE_AGENT_LANGUAGE=en
```

## Basic Integration

### 1. Import the Component

```tsx
import React, { useRef } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';
```

### 2. Basic Usage

```tsx
function App() {
  const voiceRef = useRef(null);

  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      apiKey={process.env.VITE_DEEPGRAM_API_KEY}
      onReady={() => console.log('Component ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

## Common Issues and Solutions

### 1. "Invalid hook call" Error

**Problem**: Multiple React instances in your application

**Solution**: 
- Check webpack aliases are configured correctly
- Ensure only one React version is installed: `npm ls react`
- Restart your development server after configuration changes

### 2. "Cannot find module" Error

**Problem**: Package not properly installed or externalized

**Solution**:
- Reinstall the package: `npm install @signal-meaning/deepgram-voice-interaction-react`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### 3. Audio Not Playing

**Problem**: Browser security policies blocking audio

**Solution**:
- Ensure user interaction before starting audio
- Check browser console for AudioContext suspension errors
- See [AUDIO-BUFFER-MANAGEMENT.md](./releases/v0.5.0/AUDIO-BUFFER-MANAGEMENT.md) for detailed guidance

### 4. WebSocket Connection Issues

**Problem**: Network or API key issues

**Solution**:
- Verify API key is correct and has proper permissions
- Check network connectivity
- Monitor browser console for connection errors

## Development Tips

### 1. Enable Debug Mode

```tsx
<DeepgramVoiceInteraction
  debug={true} // Enables detailed logging
  // ... other props
/>
```

### 2. Monitor Console Logs

Watch for these common issues:
- "Invalid hook call" errors
- AudioContext suspension warnings
- WebSocket connection errors
- API authentication errors

### 3. Test in Different Browsers

- **Chrome**: Full feature support
- **Firefox**: Good support, may have audio timing differences
- **Safari**: Requires user gesture for audio activation
- **Edge**: Good support

## Production Considerations

These are **best practices for component integrators** to ensure reliable, performant voice interactions in production applications.

### 1. Environment Variables

Ensure production environment has:
- Valid Deepgram API key
- Proper CORS configuration
- HTTPS for audio access

### 2. Error Handling

**Why**: Voice interactions can fail due to network issues, browser restrictions, or API errors. Proper error handling prevents application crashes and provides user feedback.

Implement proper error boundaries:

```tsx
class VoiceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Voice interaction error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Voice interaction failed</h1>
          <p>Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage
<VoiceErrorBoundary>
  <DeepgramVoiceInteraction {...props} />
</VoiceErrorBoundary>
```

### 3. Performance Optimization

**Why**: Voice interactions involve real-time audio processing, WebSocket connections, and state management. Poor performance can cause audio glitches, connection timeouts, and poor user experience.

#### Critical Performance Requirements

**1. Memoize Component Options (CRITICAL)**
```tsx
// ❌ WRONG - Creates new objects on every render
function App() {
  return (
    <DeepgramVoiceInteraction
      agentOptions={{
        language: 'en',
        listenModel: 'nova-3',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
      transcriptionOptions={{
        model: 'nova-3',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        vad_events: true,
        utterance_end_ms: 1000
      }}
    />
  );
}

// ✅ CORRECT - Memoized options prevent re-initialization
function App() {
  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.'
  }), []); // Empty dependency array - options never change

  const transcriptionOptions = useMemo(() => ({
    model: 'nova-3',
    language: 'en-US',
    smart_format: true,
    interim_results: true,
    vad_events: true,
    utterance_end_ms: 1000
  }), []); // Empty dependency array - options never change

  return (
    <DeepgramVoiceInteraction
      agentOptions={agentOptions}
      transcriptionOptions={transcriptionOptions}
    />
  );
}
```

**Why This Matters**: The component re-initializes WebSocket connections and audio contexts when options change. Unmemoized options cause constant re-initialization, leading to:
- Connection instability
- Audio glitches
- Memory leaks
- Poor user experience

**2. Implement Proper Cleanup**
```tsx
function VoiceApp() {
  const voiceRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Component handles internal cleanup, but we can log it
      console.log('Voice component unmounting');
    };
  }, []);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause voice interaction when page is hidden
        voiceRef.current?.stop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <DeepgramVoiceInteraction ref={voiceRef} {...props} />;
}
```

**Why This Matters**: Proper cleanup prevents:
- Memory leaks from audio buffers
- Orphaned WebSocket connections
- Background audio processing
- Battery drain on mobile devices

**3. Monitor Memory Usage**
```tsx
// Development-only memory monitoring
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    const interval = setInterval(() => {
      if (performance.memory) {
        const memory = {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
        };
        
        if (memory.used > 100) { // Alert if using more than 100MB
          console.warn('High memory usage detected:', memory);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }
}, []);
```

**Why This Matters**: Voice interactions can accumulate memory from:
- Audio buffers
- WebSocket message queues
- Conversation history
- Event listeners

**4. Optimize Re-renders**
```tsx
// Memoize event handlers to prevent unnecessary re-renders
const handleTranscriptUpdate = useCallback((transcript) => {
  setTranscript(transcript);
}, []);

const handleAgentUtterance = useCallback((utterance) => {
  setAgentResponse(utterance.text);
}, []);

const handleError = useCallback((error) => {
  console.error('Voice error:', error);
  setError(error.message);
}, []);

return (
  <DeepgramVoiceInteraction
    onTranscriptUpdate={handleTranscriptUpdate}
    onAgentUtterance={handleAgentUtterance}
    onError={handleError}
    // ... other props
  />
);
```

**Why This Matters**: Unmemoized event handlers cause the component to re-render on every parent render, potentially causing:
- Audio interruptions
- Connection instability
- Poor performance

## Support

If you encounter issues:

1. **Check the console** for specific error messages
2. **Verify your configuration** matches the examples above
3. **Test with debug mode** enabled
4. **See the integration guide** for usage patterns: [INTEGRATION-GUIDE.md](./releases/v0.5.0/INTEGRATION-GUIDE.md)
5. **Check the API reference** for complete documentation: [API-REFERENCE.md](./releases/v0.5.0/API-REFERENCE.md)

---

**Last Updated**: October 2025  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+