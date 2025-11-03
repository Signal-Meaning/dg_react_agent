/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Race Condition Tests for Audio Recording Cleanup
 * 
 * Issue: #239 - Race condition where server connections stop but 
 * audio connections hang open, causing resource leaks.
 * 
 * SOURCE OF TRUTH FOR EXPECTED BEHAVIOR:
 * ======================================
 * 
 * Problem Description:
 * The component has two separate code paths that try to stop audio recording:
 * 
 * 1. Explicit stop() method (lines 1750-1793 in index.tsx):
 *    - Calls audioManagerRef.current.stopRecording() synchronously (line 1762)
 *    - Then closes WebSocket connections after 1s delay (lines 1770, 1775)
 * 
 * 2. Automatic connection close handler (lines 587-605):
 *    - Uses setTimeout(async () => { await audioManagerRef.current?.stopRecording(); }, 0)
 *    - This is non-blocking and can race with explicit stop() calls
 * 
 * Race Conditions:
 * 1. Timing Race: If stop() is called while a connection close event is firing:
 *    - stop() stops audio synchronously
 *    - Connection close handler fires setTimeout to stop audio again
 *    - WebSocket connections close before audio cleanup completes
 * 
 * 2. Async Coordination: The connection close handler uses setTimeout with await 
 *    on a synchronous function (stopRecording()), creating false async semantics
 * 
 * 3. Missing Synchronization: No guarantee that audio stops before server connections close
 * 
 * Expected Behavior (After Fix):
 * ==============================
 * 1. Audio recording should ALWAYS stop when server connections close
 * 2. Audio recording should stop BEFORE or ATOMICALLY with server connection closure
 * 3. No race conditions between explicit stop() calls and automatic cleanup
 * 4. Microphone tracks should be guaranteed to close
 * 
 * TEST STATUS:
 * ============
 * 
 * Current State:
 * - 7 tests PASSING: Tests for explicit stop() method work correctly
 * - 4 tests FAILING: Tests for connection close handler demonstrate the race condition
 * 
 * The failing tests are INTENTIONALLY demonstrating the bug:
 * - They verify that the setTimeout-based connection close handler doesn't reliably
 *   stop audio tracks, which is the core issue described in #239
 * 
 * These tests will PASS once the race condition is fixed by:
 * - Eliminating setTimeout in connection close handler
 * - Making audio stopping synchronous and coordinated
 * - Ensuring audio stops before or simultaneously with connection closure
 * 
 * WHAT THESE TESTS VALIDATE:
 * ==========================
 * 1. Audio tracks are always stopped when stop() is called explicitly ✅
 * 2. Audio tracks stop when connection closes automatically ⚠️ (demonstrates bug)
 * 3. No race conditions between explicit stop() and automatic cleanup ✅
 * 4. Audio stops before server connections close ✅
 * 5. Resource leaks are prevented in rapid start/stop cycles ✅
 * 6. Proper cleanup during connection close events ⚠️ (demonstrates bug)
 * 7. Proper cleanup during connection timeouts ⚠️ (demonstrates bug)
 * 8. No hanging audio tracks after explicit stop() ✅
 * 9. No hanging audio tracks after connection close ⚠️ (demonstrates bug)
 * 10. Graceful handling of multiple stop() calls ✅
 * 11. No errors when stop() called on already-stopped audio ✅
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

// Track audio track states across tests
let mockTracks = [];
let mockMicrophoneStream = null;

/**
 * Creates a trackable mock MediaStreamTrack
 */
function createTrackableTrack() {
  const track = {
    kind: 'audio',
    label: 'Mock Audio Track',
    enabled: true,
    muted: false,
    readyState: 'live',
    stopCount: 0,
    stop: jest.fn(() => {
      track.stopCount++;
      track.readyState = 'ended';
    }),
  };
  mockTracks.push(track);
  return track;
}

/**
 * Creates a trackable mock MediaStream
 */
function createTrackableMediaStream() {
  const tracks = [createTrackableTrack()];
  const stream = {
    getTracks: jest.fn(() => tracks),
    getAudioTracks: jest.fn(() => tracks),
    addTrack: jest.fn(),
    removeTrack: jest.fn(),
  };
  mockMicrophoneStream = stream;
  return stream;
}

describe('Audio Recording Race Condition Tests (Issue #239)', () => {
  const mockApiKey = 'mock-deepgram-api-key-for-testing-purposes-only';
  
  const mockAgentOptions = {
    language: 'en',
    listenModel: 'nova-2',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    greeting: 'Hello! How can I help you today?'
  };

  let mockAgentManager;
  let mockTranscriptionManager;
  let mockAudioManager;
  let connectionCloseHandler;
  let stopRecordingCallCount = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Reset track tracking
    mockTracks = [];
    mockMicrophoneStream = null;
    stopRecordingCallCount = 0;

    // Create trackable microphone stream (stored in mockMicrophoneStream)
    createTrackableMediaStream();

    // Mock WebSocketManager for agent connections
    // The component uses addEventListener with a callback function that handles all event types
    // We need to capture this callback so we can simulate connection close events
    let agentEventListener = null;
    mockAgentManager = {
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: jest.fn().mockReturnValue(true),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      addEventListener: jest.fn((callback) => {
        // Component passes a callback function directly, not (event, handler)
        agentEventListener = callback;
        // Also capture for connectionCloseHandler compatibility
        connectionCloseHandler = (event) => {
          if (agentEventListener) {
            agentEventListener(event);
          }
        };
        return jest.fn(); // Return unsubscribe function
      }),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock WebSocketManager for transcription connections
    // The component uses addEventListener with a callback function that handles all event types
    let transcriptionEventListener = null;
    mockTranscriptionManager = {
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: jest.fn().mockReturnValue(true),
      sendCloseStream: jest.fn(),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      addEventListener: jest.fn((callback) => {
        // Component passes a callback function directly, not (event, handler)
        transcriptionEventListener = callback;
        // Also capture for connectionCloseHandler compatibility
        connectionCloseHandler = (event) => {
          if (transcriptionEventListener) {
            transcriptionEventListener(event);
          }
          if (agentEventListener) {
            agentEventListener(event);
          }
        };
        return jest.fn();
      }),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock AudioManager with trackable state
    mockAudioManager = {
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(() => {
        stopRecordingCallCount++;
        // Simulate stopping tracks (as real implementation does)
        if (mockMicrophoneStream) {
          mockMicrophoneStream.getTracks().forEach(track => {
            track.stop();
          });
        }
      }),
      isRecordingActive: jest.fn(() => {
        // Return true if any track is still live
        return mockTracks.some(track => track.readyState === 'live');
      }),
      queueAudio: jest.fn().mockResolvedValue(),
      clearAudioQueue: jest.fn(),
      dispose: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
      getAudioContext: jest.fn().mockReturnValue({
        state: 'running',
        suspend: jest.fn(),
        resume: jest.fn(),
      }),
      abortPlayback: jest.fn(),
    };

    // Make AudioManager accessible via ref
    Object.defineProperty(mockAudioManager, 'microphoneStream', {
      get: () => mockMicrophoneStream,
      configurable: true,
    });

    WebSocketManager.mockImplementation((options) => {
      // Return agent manager or transcription manager based on options
      if (options?.url?.includes('agent')) {
        return mockAgentManager;
      }
      return mockTranscriptionManager;
    });

    AudioManager.mockImplementation(() => {
      // Set recording active when initialized
      mockAudioManager.isRecordingActive = jest.fn(() => {
        return mockTracks.some(track => track.readyState === 'live');
      });
      // Store microphone stream reference in the mock
      Object.defineProperty(mockAudioManager, 'microphoneStream', {
        get: () => mockMicrophoneStream,
        configurable: true,
      });
      return mockAudioManager;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    connectionCloseHandler = null;
  });

  describe('Race Condition: Explicit stop() vs Connection Close Handler', () => {
    test('should stop audio tracks when stop() is called before connection close', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture (this creates the AudioManager)
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Mark tracks as live
      mockTracks.forEach(track => {
        track.readyState = 'live';
      });
      mockAudioManager.isRecordingActive.mockReturnValue(true);

      // Call explicit stop()
      await act(async () => {
        const stopPromise = ref.current.stop();
        // Fast-forward the 1 second delay
        jest.advanceTimersByTime(1000);
        await stopPromise;
      });

      // Verify tracks were stopped
      expect(mockTracks.length).toBeGreaterThan(0);
      mockTracks.forEach(track => {
        expect(track.readyState).toBe('ended');
        expect(track.stop).toHaveBeenCalled();
      });

      // Verify stopRecording was called
      expect(stopRecordingCallCount).toBeGreaterThan(0);
    });

    test('should stop audio tracks when connection closes automatically', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      // Simulate connection close event - handler expects WebSocketEvent with type: 'state', state: 'closed'
      await act(async () => {
        if (connectionCloseHandler) {
          connectionCloseHandler({ type: 'state', state: 'closed' });
        }
      });

      // Fast-forward setTimeout(0) - this should execute the callback
      await act(async () => {
        jest.advanceTimersByTime(1);
        // Flush all pending promises to ensure async setTimeout callback completes
        await Promise.resolve();
        await Promise.resolve(); // Double flush for async callback
      });

      // Wait for tracks to be stopped (handles async setTimeout)
      await waitFor(() => {
        expect(mockTracks.length).toBeGreaterThan(0);
        mockTracks.forEach(track => {
          expect(track.readyState).toBe('ended');
          expect(track.stop).toHaveBeenCalled();
        });
      });

      // Verify stopRecording was called
      expect(stopRecordingCallCount).toBeGreaterThan(0);
    });

    test('should handle race condition when stop() called during connection close', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      // Simulate race: connection closes while stop() is being called
      await act(async () => {
        const stopPromise = ref.current.stop();
        
        // Trigger connection close during stop()
        // Simulate connection close event - handler expects WebSocketEvent with type: 'state', state: 'closed'
        if (connectionCloseHandler) {
          connectionCloseHandler({ type: 'state', state: 'closed' });
        }
        
        // Fast-forward all timers
        jest.advanceTimersByTime(1000);
        await stopPromise;
      });

      // Verify tracks were stopped (even with race condition)
      expect(mockTracks.length).toBeGreaterThan(0);
      mockTracks.forEach(track => {
        expect(track.readyState).toBe('ended');
        expect(track.stop).toHaveBeenCalled();
      });

      // Verify stopRecording was called (may be called multiple times due to race)
      expect(stopRecordingCallCount).toBeGreaterThan(0);
    });

    test('should ensure audio stops before server connections close', async () => {
      const ref = React.createRef();
      const stopOrder = [];
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Override stopRecording to track order
      const originalStopRecording = mockAudioManager.stopRecording;
      mockAudioManager.stopRecording = jest.fn(() => {
        stopOrder.push('audio_stopped');
        originalStopRecording();
      });

      // Override close to track order
      mockAgentManager.close = jest.fn(() => {
        stopOrder.push('websocket_closed');
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Mark tracks as live
      mockTracks.forEach(track => {
        track.readyState = 'live';
      });
      mockAudioManager.isRecordingActive.mockReturnValue(true);

      // Call stop()
      await act(async () => {
        const stopPromise = ref.current.stop();
        // Fast-forward the 1 second delay
        jest.advanceTimersByTime(1000);
        await stopPromise;
      });

      // Verify audio stopped before WebSocket closed
      // Note: Current implementation stops audio first, then closes after delay
      expect(stopOrder).toContain('audio_stopped');
      expect(stopOrder).toContain('websocket_closed');
      expect(stopOrder.indexOf('audio_stopped')).toBeLessThan(
        stopOrder.indexOf('websocket_closed')
      );
    });
  });

  describe('Rapid Start/Stop Cycles', () => {
    test('should properly cleanup audio tracks in rapid start/stop cycles', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Perform multiple rapid start/stop cycles
      for (let i = 0; i < 3; i++) {
        // Start
        await act(async () => {
          // Create new tracks for each start
          mockTracks = [];
          createTrackableMediaStream();
          await ref.current.start();
        });

        // Mark tracks as live
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);

        // Stop
        await act(async () => {
          const stopPromise = ref.current.stop();
          jest.advanceTimersByTime(1000);
          await stopPromise;
        });

        // Verify tracks were stopped after each cycle
        mockTracks.forEach(track => {
          expect(track.readyState).toBe('ended');
          expect(track.stop).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Connection Close During Active Recording', () => {
    test('should stop audio tracks when connection closes during active recording', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Mark tracks as live and actively recording
      mockTracks.forEach(track => {
        track.readyState = 'live';
      });
      mockAudioManager.isRecordingActive.mockReturnValue(true);

      // Simulate connection close during active recording
      // Simulate connection close event - handler expects WebSocketEvent with type: 'state', state: 'closed'
      await act(async () => {
        if (connectionCloseHandler) {
          connectionCloseHandler({ type: 'state', state: 'closed' });
        }
      });

      // Fast-forward setTimeout(0) - this should execute the callback
      await act(async () => {
        jest.advanceTimersByTime(1);
        // Flush all pending promises to ensure async setTimeout callback completes
        await Promise.resolve();
        await Promise.resolve(); // Double flush for async callback
      });

      // Wait for tracks to be stopped (handles async setTimeout)
      await waitFor(() => {
        expect(mockTracks.length).toBeGreaterThan(0);
        mockTracks.forEach(track => {
          expect(track.readyState).toBe('ended');
          expect(track.stop).toHaveBeenCalled();
        });
      });
    });

    test('should handle connection timeout and stop audio tracks', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      // Simulate timeout event triggering connection close
      await act(async () => {
        if (mockAgentManager.triggerTimeoutForTesting) {
          mockAgentManager.triggerTimeoutForTesting();
        }
        // Simulate connection close event - handler expects WebSocketEvent with type: 'state', state: 'closed'
        if (connectionCloseHandler) {
          connectionCloseHandler({ type: 'state', state: 'closed' });
        }
      });

      // Fast-forward setTimeout(0) - this should execute the callback
      await act(async () => {
        jest.advanceTimersByTime(1);
        // Flush all pending promises to ensure async setTimeout callback completes
        await Promise.resolve();
        await Promise.resolve(); // Double flush for async callback
      });

      // Wait for tracks to be stopped (handles async setTimeout)
      await waitFor(() => {
        expect(mockTracks.length).toBeGreaterThan(0);
        mockTracks.forEach(track => {
          expect(track.readyState).toBe('ended');
          expect(track.stop).toHaveBeenCalled();
        });
      });
    });
  });

  describe('Resource Leak Prevention', () => {
    test('should prevent hanging audio tracks after explicit stop()', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      // Stop explicitly
      await act(async () => {
        const stopPromise = ref.current.stop();
        jest.advanceTimersByTime(1000);
        await stopPromise;
      });

      // Wait a bit to ensure no async operations are pending
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Verify no tracks are still live
      const liveTracks = mockTracks.filter(track => track.readyState === 'live');
      expect(liveTracks.length).toBe(0);

      // Verify all tracks were stopped
      mockTracks.forEach(track => {
        expect(track.readyState).toBe('ended');
      });
    });

    test('should prevent hanging audio tracks after connection close', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      // Simulate connection close
      await act(async () => {
        // Simulate connection close event - handler expects WebSocketEvent with type: 'state', state: 'closed'
        if (connectionCloseHandler) {
          connectionCloseHandler({ type: 'state', state: 'closed' });
        }
      });

      // Fast-forward setTimeout(0) - this should execute the callback
      await act(async () => {
        jest.advanceTimersByTime(1);
        // Flush all pending promises to ensure async setTimeout callback completes
        await Promise.resolve();
        await Promise.resolve(); // Double flush for async callback
      });

      // Wait a bit to ensure async operations complete
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      // Wait for all tracks to be stopped (handles async setTimeout)
      await waitFor(() => {
        const liveTracks = mockTracks.filter(track => track.readyState === 'live');
        expect(liveTracks.length).toBe(0);
      });

      // Verify all tracks were stopped
      mockTracks.forEach(track => {
        expect(track.readyState).toBe('ended');
      });
    });
  });

  describe('Double-Stop Prevention', () => {
    test('should handle multiple stop() calls gracefully', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      const initialStopCount = stopRecordingCallCount;

      // Call stop() multiple times
      await act(async () => {
        const stopPromise1 = ref.current.stop();
        const stopPromise2 = ref.current.stop();
        jest.advanceTimersByTime(1000);
        await Promise.all([stopPromise1, stopPromise2]);
      });

      // Verify tracks were stopped
      mockTracks.forEach(track => {
        expect(track.readyState).toBe('ended');
      });

      // stopRecording may be called multiple times, which is okay
      // but we should verify tracks are still stopped
      expect(stopRecordingCallCount).toBeGreaterThan(initialStopCount);
    });

    test('should not throw when stop() is called on already-stopped audio', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Initialize AudioManager by calling startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Start connection
      await act(async () => {
        await ref.current.start();
      });

      // Simulate starting recording (this sets up tracks in real implementation)
      await act(async () => {
        await mockAudioManager.startRecording();
        // Mark tracks as live after recording starts
        mockTracks.forEach(track => {
          track.readyState = 'live';
        });
        mockAudioManager.isRecordingActive.mockReturnValue(true);
      });

      // Stop once
      await act(async () => {
        const stopPromise = ref.current.stop();
        jest.advanceTimersByTime(1000);
        await stopPromise;
      });

      // Mark tracks as stopped
      mockTracks.forEach(track => {
        track.readyState = 'ended';
      });
      mockAudioManager.isRecordingActive.mockReturnValue(false);

      // Stop again - should not throw
      await act(async () => {
        const stopPromise = ref.current.stop();
        jest.advanceTimersByTime(1000);
        await expect(stopPromise).resolves.toBeUndefined();
      });
    });
  });
});

