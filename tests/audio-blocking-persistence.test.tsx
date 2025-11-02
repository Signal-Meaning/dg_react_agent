/**
 * @jest-environment jsdom
 * @eslint-env jest
 * 
 * Test for Issue #223: Agent audio blocking does not persist across agent response turns
 * 
 * This test verifies that after calling interruptAgent(), the allowAgentRef blocking state
 * persists across multiple agent response turns. The blocking should remain active until
 * allowAgent() is explicitly called.
 * 
 * Test Strategy:
 * 1. Render component with agent configuration
 * 2. Simulate agent audio arriving (first turn)
 * 3. Call interruptAgent() to block audio
 * 4. Simulate agent audio arriving in subsequent turns
 * 5. Verify that handleAgentAudio() discards audio buffers when blocked
 * 6. Verify that queueAudio() is NOT called when blocking is active
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

const MOCK_API_KEY = 'test-api-key-12345';

const createMockAgentOptions = () => ({
  language: 'en',
  listenModel: 'nova-2',
  thinkProviderType: 'open_ai',
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.',
});

describe('Audio Blocking Persistence (Issue #223)', () => {
  let mockAgentManager: any;
  let mockAudioManager: any;
  let agentEventListener: ((event: any) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebSocketManager for agent
    // Note: addEventListener takes a single callback function, not (eventType, callback)
    mockAgentManager = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      sendJSON: jest.fn(),
      sendBinary: jest.fn(),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      addEventListener: jest.fn((listener: (event: any) => void) => {
        // Capture the listener - it will receive events with type='binary' for audio
        agentEventListener = listener;
        return jest.fn(); // Return unsubscribe function
      }),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    };

    WebSocketManager.mockImplementation((options: any) => {
      if (options.service === 'agent') {
        return mockAgentManager;
      }
      return null;
    });

    // Mock AudioManager
    mockAudioManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn(),
      queueAudio: jest.fn().mockResolvedValue(undefined),
      clearAudioQueue: jest.fn(),
      abortPlayback: jest.fn(),
      dispose: jest.fn(),
      isRecordingActive: jest.fn().mockReturnValue(false),
      getAudioContext: jest.fn().mockReturnValue({
        state: 'running',
        suspend: jest.fn(),
        resume: jest.fn(),
      }),
      addEventListener: jest.fn((listener: (event: any) => void) => {
        audioEventListener = listener;
        return jest.fn(); // Return unsubscribe function
      }),
      removeEventListener: jest.fn(),
      isTtsMuted: false,
    };

    AudioManager.mockImplementation(() => mockAudioManager);

    // Reset event listeners
    // (Event listeners are stored in mock managers and will be cleaned up automatically)
  });

  it('should persist audio blocking across multiple agent response turns', async () => {
    const ref = React.createRef<any>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    // Start the connection to initialize managers
    await act(async () => {
      await ref.current.start();
    });

    // Wait for agent manager to be initialized and event listener set up
    await waitFor(() => {
      expect(mockAgentManager.addEventListener).toHaveBeenCalledWith(expect.any(Function));
      expect(agentEventListener).toBeTruthy();
    });

    // Create mock audio buffer for testing
    const createMockAudioBuffer = (): ArrayBuffer => {
      const buffer = new ArrayBuffer(1024);
      return buffer;
    };

    // FIRST TURN: Simulate agent audio arriving
    // The event listener receives events with type='binary' for audio data
    const firstAudioBuffer = createMockAudioBuffer();
    await act(async () => {
      if (agentEventListener) {
        agentEventListener({ type: 'binary', data: firstAudioBuffer });
      }
    });

    // Wait a bit for handleAgentAudio to process
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify audio was queued in first turn (blocking not yet active)
    expect(mockAudioManager.queueAudio).toHaveBeenCalledTimes(1);
    expect(mockAudioManager.queueAudio).toHaveBeenCalledWith(firstAudioBuffer);

    // Clear the mock to track subsequent calls
    jest.clearAllMocks();

    // NOW: Call interruptAgent() to block audio (simulates user clicking mute button)
    await act(() => {
      ref.current.interruptAgent();
    });

    // Simulate agent state transition that might occur between turns
    // Issue #223: Blocking may be lost during state transitions
    // Simulate what happens when agent responds in next turn:
    // 1. Agent message arrives
    // 2. Agent state might transition
    // 3. Agent audio arrives
    
    // Simulate agent responding in next turn - send a message event first
    if (agentEventListener) {
      await act(async () => {
        agentEventListener({ 
          type: 'message', 
          data: { 
            type: 'AgentStartedSpeaking',
            // This might trigger state transitions
          } 
        });
      });
    }

    // SECOND TURN: Simulate agent audio arriving after interruptAgent()
    // This simulates the agent responding in the next conversation turn
    const secondAudioBuffer = createMockAudioBuffer();
    await act(async () => {
      if (agentEventListener) {
        agentEventListener({ type: 'binary', data: secondAudioBuffer });
      }
    });

    // Wait for processing - simulate full turn processing
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // CRITICAL ASSERTION: queueAudio should NOT be called (audio should be discarded)
    // This verifies that blocking persists after interruptAgent() across turns
    // If this fails, it means allowAgentRef was reset during the turn transition
    expect(mockAudioManager.queueAudio).not.toHaveBeenCalled();

    // THIRD TURN: Simulate another agent response turn
    const thirdAudioBuffer = createMockAudioBuffer();
    await act(async () => {
      if (agentEventListener) {
        agentEventListener({ type: 'binary', data: thirdAudioBuffer });
      }
    });

    // Wait for processing
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // CRITICAL ASSERTION: queueAudio should still NOT be called
    // This verifies that blocking persists across multiple turns (the bug!)
    expect(mockAudioManager.queueAudio).not.toHaveBeenCalled();

    // FINALLY: Call allowAgent() to unblock
    await act(() => {
      ref.current.allowAgent();
    });

    // FOURTH TURN: Simulate agent audio after allowAgent()
    const fourthAudioBuffer = createMockAudioBuffer();
    await act(async () => {
      if (agentEventListener) {
        agentEventListener({ type: 'binary', data: fourthAudioBuffer });
      }
    });

    // Wait for processing
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // After allowAgent(), audio should be queued again
    expect(mockAudioManager.queueAudio).toHaveBeenCalledTimes(1);
    expect(mockAudioManager.queueAudio).toHaveBeenCalledWith(fourthAudioBuffer);
  });

  it('should reset blocking state when stop() is called', async () => {
    const ref = React.createRef<any>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await act(async () => {
      await ref.current.start();
    });

    await waitFor(() => {
      expect(mockAgentManager.addEventListener).toHaveBeenCalledWith(expect.any(Function));
      expect(agentEventListener).toBeTruthy();
    });

    // Call interruptAgent() to block
    await act(() => {
      ref.current.interruptAgent();
    });

    // Verify blocking is active (audio should be discarded)
    const audioBuffer = new ArrayBuffer(1024);
    await act(async () => {
      if (agentEventListener) {
        agentEventListener({ type: 'binary', data: audioBuffer });
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(mockAudioManager.queueAudio).not.toHaveBeenCalled();

    // Call stop() - this should reset blocking state (per issue description)
    await act(async () => {
      await ref.current.stop();
    });

    // Start again
    await act(async () => {
      await ref.current.start();
    });

    // After stop() and restart, blocking should be reset and audio should play
    const newAudioBuffer = new ArrayBuffer(1024);
    jest.clearAllMocks();

    await act(async () => {
      if (agentEventListener) {
        agentEventListener({ type: 'binary', data: newAudioBuffer });
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Audio should be queued after restart (blocking reset)
    expect(mockAudioManager.queueAudio).toHaveBeenCalledWith(newAudioBuffer);
  });
});

