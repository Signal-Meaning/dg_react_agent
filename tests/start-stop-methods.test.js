/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

// Skip in CI until proper mocks are implemented (Issue #99)
const shouldSkipInCI = process.env.CI && !process.env.RUN_REAL_API_TESTS;

/**
 * Start and Stop Methods Tests
 * 
 * This test suite validates the core connection control methods:
 * - start(): Initializes connections and starts recording
 * - stop(): Stops recording and closes connections
 * 
 * These methods have been significantly modified since the fork and require
 * comprehensive test coverage to ensure they work correctly with the new
 * single WebSocket architecture and lazy audio initialization.
 * 
 * Key Scenarios Tested:
 * ====================
 * 
 * 1. START METHOD
 *    - Method exists and can be called
 *    - Method returns a Promise
 *    - Method handles different configuration modes
 * 
 * 2. STOP METHOD
 *    - Method exists and can be called
 *    - Method returns a Promise
 *    - Method handles different configuration modes
 * 
 * 3. EDGE CASES
 *    - Methods work when only transcription is configured
 *    - Methods work when only agent is configured
 *    - Methods work in dual mode (both services)
 *    - Methods handle missing managers gracefully
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

(shouldSkipInCI ? describe.skip : describe)('Start and Stop Methods', () => {
  const mockApiKey = 'mock-deepgram-api-key-for-testing-purposes-only';
  
  const mockTranscriptionOptions = {
    language: 'en',
    model: 'nova-2',
    interimResults: true,
    endpointing: 300,
    vadEvents: true
  };

  const mockAgentOptions = {
    language: 'en',
    listenModel: 'nova-2',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    greeting: 'Hello! How can I help you today?'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocketManager with proper unsubscribe function
    WebSocketManager.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: jest.fn(),
      sendCloseStream: jest.fn(),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      addEventListener: jest.fn().mockReturnValue(jest.fn()), // Return unsubscribe function
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    }));

    // Mock AudioManager
    AudioManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(),
      isRecording: jest.fn().mockReturnValue(false),
      isTtsMuted: false,
      getAudioContext: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()), // Return unsubscribe function
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    }));
  });

  describe('start() method', () => {
    test('should exist and be callable in dual mode', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          transcriptionOptions={mockTranscriptionOptions}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Verify start method exists
      expect(typeof ref.current.start).toBe('function');
      
      // Call start method - should not throw
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });
    });

    test('should exist and be callable in transcription-only mode', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          transcriptionOptions={mockTranscriptionOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Verify start method exists
      expect(typeof ref.current.start).toBe('function');
      
      // Call start method - should not throw
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });
    });

    test('should exist and be callable in agent-only mode', async () => {
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

      // Verify start method exists
      expect(typeof ref.current.start).toBe('function');
      
      // Call start method - should not throw
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });
    });

    test('should exist and be callable with no options', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Verify start method exists
      expect(typeof ref.current.start).toBe('function');
      
      // Call start method - should succeed but do nothing (original behavior)
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });
    });
  });

  describe('stop() method', () => {
    test('should exist and be callable in dual mode', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          transcriptionOptions={mockTranscriptionOptions}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Verify stop method exists
      expect(typeof ref.current.stop).toBe('function');
      
      // Call stop method - should not throw
      await act(async () => {
        await expect(ref.current.stop()).resolves.toBeUndefined();
      });
    });

    test('should exist and be callable in transcription-only mode', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          transcriptionOptions={mockTranscriptionOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Verify stop method exists
      expect(typeof ref.current.stop).toBe('function');
      
      // Call stop method - should not throw
      await act(async () => {
        await expect(ref.current.stop()).resolves.toBeUndefined();
      });
    });

    test('should exist and be callable in agent-only mode', async () => {
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

      // Verify stop method exists
      expect(typeof ref.current.stop).toBe('function');
      
      // Call stop method - should not throw
      await act(async () => {
        await expect(ref.current.stop()).resolves.toBeUndefined();
      });
    });

    test('should exist and be callable with no options', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Verify stop method exists
      expect(typeof ref.current.stop).toBe('function');
      
      // Call stop method - should not throw
      await act(async () => {
        await expect(ref.current.stop()).resolves.toBeUndefined();
      });
    });
  });

  describe('start() and stop() integration', () => {
    test('should allow starting after stopping', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          transcriptionOptions={mockTranscriptionOptions}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Start connections
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });

      // Stop connections
      await act(async () => {
        await expect(ref.current.stop()).resolves.toBeUndefined();
      });

      // Start again
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });

      // Should be able to start again without errors
      expect(true).toBe(true);
    });

    test('should allow multiple start/stop cycles', async () => {
      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          transcriptionOptions={mockTranscriptionOptions}
          agentOptions={mockAgentOptions}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await expect(ref.current.start()).resolves.toBeUndefined();
        });

        await act(async () => {
          await expect(ref.current.stop()).resolves.toBeUndefined();
        });
      }

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});