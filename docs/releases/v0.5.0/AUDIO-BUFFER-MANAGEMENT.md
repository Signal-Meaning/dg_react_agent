# Audio Buffer Management Guide

**Version**: 0.5.0+  
**Audience**: Frontend developers integrating TTS audio streams

## 🎯 Overview

This document provides comprehensive guidance on managing TTS audio buffers in frontend applications using the `DeepgramVoiceInteraction` component. Proper audio buffer management is critical to prevent memory leaks, audio glitches, and connection issues.

## ⚠️ Critical Issues We've Discovered

### 1. **Audio Queue Buildup**
- **Problem**: Audio buffers can accumulate in the Web Audio API queue
- **Symptoms**: Memory leaks, delayed audio playback, connection timeouts
- **Impact**: Can cause `CLIENT_MESSAGE_TIMEOUT` errors and component crashes

### 2. **TTS Mute State Issues**
- **Problem**: Audio continues playing even when TTS is "muted"
- **Root Cause**: Audio buffers already in queue continue processing
- **Impact**: User experience issues, unexpected audio playback
- **Critical Discovery**: Mute button sometimes failed on first press due to race conditions

### 3. **Race Condition Issues**
- **Problem**: `isPlaybackActive()` can be inaccurate due to timing mismatches
- **Symptoms**: Mute button fails to work on first press, inconsistent audio state
- **Root Cause**: Discrepancy between `isPlaying` flag and actual `activeSourceNodes`
- **Impact**: Unreliable audio control, poor user experience

### 4. **Component Unmounting Crashes**
- **Problem**: Audio cleanup fails when component unmounts during playback
- **Symptoms**: `Cannot read properties of undefined` errors
- **Impact**: Application crashes, poor user experience
- **Root Cause**: Component bug - improper cleanup ordering during unmount
- **Status**: [Issue #166](https://github.com/Signal-Meaning/dg_react_agent/issues/166) - Component should handle cleanup internally

## 🔧 Audio Buffer Management Strategies

### 1. **Always Use `interruptAgent()` for Immediately Interrupting them, any thinking, and their TTS Playback**

**Critical Lesson**: Always call `interruptAgent()` regardless of current playback state to prevent race conditions.

```tsx
function AudioControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopAudio = useCallback(() => {
    // CRITICAL: Always call interruptAgent() regardless of playback state
    // This prevents race conditions where mute button fails on first press
    voiceRef.current?.interruptAgent();
    setIsPlaying(false);
  }, []);

  const handlePlaybackStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <div>
      <button onClick={stopAudio}>
        Stop Audio
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        onPlaybackStateChange={handlePlaybackStateChange}
        // ... other props
      />
    </div>
  );
}
```

### 2. **Monitor Audio State for Cleanup**

**Why This Is Necessary**: The component currently requires parent applications to monitor audio state for cleanup due to [Issue #167](https://github.com/Signal-Meaning/dg_react_agent/issues/167). This is a component responsibility that should be handled internally.

```tsx
function AudioStateManager() {
  const [audioState, setAudioState] = useState({
    isPlaying: false,
    isReady: false,
    hasError: false
  });

  const handlePlaybackStateChange = useCallback((isPlaying: boolean) => {
    setAudioState(prev => ({ ...prev, isPlaying }));
    console.log('Audio playback state:', isPlaying);
  }, []);

  const handleError = useCallback((error: DeepgramError) => {
    if (error.message.includes('audio') || error.message.includes('buffer')) {
      setAudioState(prev => ({ ...prev, hasError: true }));
      console.error('Audio error detected:', error);
    }
  }, []);

  return (
    <DeepgramVoiceInteraction
      onPlaybackStateChange={handlePlaybackStateChange}
      onError={handleError}
      // ... other props
    />
  );
}
```

**Note**: This workaround should not be necessary - the component should handle its own audio state management internally.

### 3. **Handle Connection State Changes**

**Why This Is Necessary**: When WebSocket connections close unexpectedly (network issues, server restarts, etc.), ongoing audio playback should be interrupted to prevent orphaned audio streams and provide proper user feedback.

```tsx
function ConnectionAwareAudio() {
  const [connectionState, setConnectionState] = useState('closed');
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
    setConnectionState(state);
    
    // If connection closes unexpectedly, interrupt any ongoing audio
    if (state === 'closed' && service === 'agent') {
      voiceRef.current?.interruptAgent();
    }
  }, []);

  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      onConnectionStateChange={handleConnectionStateChange}
      // ... other props
    />
  );
}
```

## 🚨 Common Pitfalls and Solutions

### **Pitfall 1: Not Using `interruptAgent()`**
```tsx
// ❌ WRONG - This doesn't clear audio buffers
const stopAudio = () => {
  voiceRef.current?.stop(); // Only stops connection, not audio
};

// ✅ CORRECT - This clears audio buffers immediately
const stopAudio = () => {
  voiceRef.current?.interruptAgent(); // Stops audio and clears buffers
};
```

### **Pitfall 2: Ignoring Playback State**

**Why This Is Problematic**: Without monitoring playback state, applications cannot provide proper user feedback (loading states, button states, visual indicators) or handle audio-related errors gracefully.

```tsx
// ❌ WRONG - No feedback on audio state
<DeepgramVoiceInteraction
  // Missing onPlaybackStateChange
/>

// ✅ CORRECT - Monitor audio state for proper UX
<DeepgramVoiceInteraction
  onPlaybackStateChange={(isPlaying) => {
    console.log('Audio playing:', isPlaying);
    // Update UI state, show loading indicators, etc.
  }}
/>
```

### **Pitfall 3: Not Handling Errors**
```tsx
// ❌ WRONG - No error handling
<DeepgramVoiceInteraction
  // Missing onError
/>

// ✅ CORRECT - Handle audio errors
<DeepgramVoiceInteraction
  onError={(error) => {
    if (error.message.includes('audio')) {
      // Handle audio-specific errors
      console.error('Audio error:', error);
    }
  }}
/>
```

### **Pitfall 4: Browser Security and AudioContext Suspension**

**Critical Issue**: Browser security policies can suspend AudioContext, preventing TTS playback and blocking frontend event processing.

```tsx
// ❌ WRONG - No AudioContext state handling
const startAudio = () => {
  voiceRef.current?.start(); // May fail silently if AudioContext suspended
};

// ✅ CORRECT - Handle AudioContext suspension
const startAudio = async () => {
  try {
    // Ensure AudioContext is running before starting
    await voiceRef.current?.start();
  } catch (error) {
    if (error.message.includes('AudioContext')) {
      console.error('AudioContext suspended - user interaction required');
      // Handle suspension - may need user gesture to resume
    }
  }
};
```

**Browser Security Requirements:**
- **User Gesture Required**: AudioContext requires user interaction to start/resume
- **Suspension Recovery**: AudioContext can be suspended and needs explicit resume
- **Test Environment**: Tests need `simulateUserGesture()` to work properly

### **Pitfall 5: Async interruptAgent() State Management**

**Critical Understanding**: `interruptAgent()` is asynchronous and developers must monitor state changes for proper UI reactivity.

```tsx
// ❌ WRONG - Assuming immediate state change
const toggleMute = () => {
  voiceRef.current?.interruptAgent();
  setIsMuted(true); // Wrong - state change is async
};

// ✅ CORRECT - Monitor state changes for reactivity
const toggleMute = () => {
  voiceRef.current?.interruptAgent();
  // State will be updated via onPlaybackStateChange callback
};

const handlePlaybackStateChange = useCallback((isPlaying: boolean) => {
  setIsMuted(!isPlaying); // Update UI when agent actually stops/starts playing
}, []);

const handleAgentStartedSpeaking = useCallback(() => {
  setIsMuted(false); // Update UI when agent starts
}, []);
```

**Key Points:**
- **`interruptAgent()` is async** - don't assume immediate state change
- **Monitor `onPlaybackStateChange(false)`** for reliable mute state updates (when playback actually stops)
- **Monitor `onAgentStartedSpeaking`** for unmute state updates
- **Note**: `onAgentSilent` was removed - it fired on TTS generation complete, not playback complete, which was misleading. Use `onPlaybackStateChange(false)` to detect when agent stopped speaking.
- **UI should reflect actual audio state**, not button clicks
- **Note**: `onAgentStoppedSpeaking` was never implemented - `AgentStoppedSpeaking` is not a real Deepgram event (Issue #198)

## 🔍 Debugging Audio Issues

### **Enable Debug Mode**
```tsx
<DeepgramVoiceInteraction
  debug={true} // Enables detailed audio logging
  // ... other props
/>
```

### **Monitor Audio Context State**
```tsx
const checkAudioContext = () => {
  const audioContext = voiceRef.current?.getAudioContext();
  if (audioContext) {
    console.log('AudioContext state:', audioContext.state);
    console.log('AudioContext sample rate:', audioContext.sampleRate);
    
    // Handle suspended state
    if (audioContext.state === 'suspended') {
      console.warn('AudioContext suspended - user interaction required');
      // May need to call audioContext.resume() after user gesture
    }
  }
};
```

### **Handle AudioContext Suspension**
```tsx
const handleAudioContextSuspension = async () => {
  try {
    const audioContext = voiceRef.current?.getAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('AudioContext resumed successfully');
    }
  } catch (error) {
    console.error('Failed to resume AudioContext:', error);
  }
};
```

### **Check for Memory Leaks**
```tsx
// Monitor memory usage in development
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    const interval = setInterval(() => {
      if (performance.memory) {
        console.log('Memory usage:', {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB'
        });
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }
}, []);
```

## 📋 Best Practices Checklist

- [ ] **Always use `interruptAgent()`** to stop audio immediately
- [ ] **Monitor `onPlaybackStateChange`** for audio state feedback and proper UX
- [ ] **Handle `onError`** for audio-specific error recovery
- [ ] **Use `onConnectionStateChange`** to interrupt audio on connection loss
- [ ] **Handle AudioContext suspension** - ensure user gesture for audio activation
- [ ] **Monitor `onPlaybackStateChange(false)`** for reliable mute state updates (Note: `onAgentStoppedSpeaking` was never implemented - `AgentStoppedSpeaking` is not a real Deepgram event, Issue #198)
- [ ] **Monitor `onAgentStartedSpeaking`** for unmute state updates
- [ ] **Never assume immediate state changes** - `interruptAgent()` is async
- [ ] **Enable debug mode** during development
- [ ] **Test AudioContext suspension recovery** in different browsers

## 🔗 Related Documentation

- **[API Reference](./API-REFERENCE.md)** - Complete component API
- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Usage patterns and examples
- **[Technical Setup](../TECHNICAL-SETUP.md)** - Build configuration

---

**Last Updated**: October 2025  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+
