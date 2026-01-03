/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Lazy Initialization Tests
 * 
 * This test suite validates the lazy WebSocket manager initialization behavior
 * introduced in Issue #206. Managers should NOT be created during component
 * initialization, but only when start() is called or user interacts.
 * 
 * Key Scenarios Tested:
 * ====================
 * 
 * 1. NO MANAGERS DURING INITIALIZATION
 *    - Component does not create managers during mount
 *    - Managers are null until start() is called
 * 
 * 2. LAZY CREATION ON start()
 *    - start() creates managers based on service flags
 *    - start({ agent: true }) creates only agent manager
 *    - start({ transcription: true }) creates only transcription manager
 *    - start() without flags uses props to determine services
 * 
 * 3. injectUserMessage() LAZY CREATION
 *    - Creates agent manager if needed
 *    - Ensures connection is established
 * 
 * 4. startAudioCapture() LAZY CREATION
 *    - Creates transcription manager if needed
 *    - Creates agent manager if needed
 *    - Handles case where agent already connected
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

describe('Lazy Initialization Tests', () => {
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

  let mockTranscriptionManager;
  let mockAgentManager;
  let mockAudioManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock TranscriptionManager
    mockTranscriptionManager = {
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: jest.fn(),
      sendCloseStream: jest.fn(),
      getState: jest.fn().mockReturnValue('closed'),
      isConnected: jest.fn().mockReturnValue(false),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock AgentManager
    mockAgentManager = {
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: jest.fn(),
      getState: jest.fn().mockReturnValue('closed'),
      isConnected: jest.fn().mockReturnValue(false),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
      // Issue #345: Add hasSettingsBeenSent method for Settings wait logic
      hasSettingsBeenSent: jest.fn().mockReturnValue(false),
    };

    // Mock AudioManager
    mockAudioManager = {
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(),
      isRecording: jest.fn().mockReturnValue(false),
      isRecordingActive: jest.fn().mockReturnValue(false),
      getAudioContext: jest.fn().mockReturnValue({
        state: 'running',
        resume: jest.fn().mockResolvedValue()
      }),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
      dispose: jest.fn(),
    };

    // Mock WebSocketManager constructor to return appropriate manager based on service
    WebSocketManager.mockImplementation((options) => {
      if (options.service === 'transcription') {
        return mockTranscriptionManager;
      } else if (options.service === 'agent') {
        return mockAgentManager;
      }
      return null;
    });

    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('No Managers During Initialization', () => {
    test('should not create managers during component mount', async () => {
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

      // Wait a bit to ensure initialization completes
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify WebSocketManager was NOT called during initialization
      expect(WebSocketManager).not.toHaveBeenCalled();
      
      // Verify managers are not accessible (getConnectionStates was removed in Issue #162)
      // We verify this indirectly by ensuring WebSocketManager was not called
      // If managers existed, WebSocketManager would have been instantiated
    });

    test('should not create managers even with both services configured', async () => {
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // WebSocketManager should not have been instantiated
      expect(WebSocketManager).not.toHaveBeenCalled();
    });
  });

  describe('Lazy Creation on start()', () => {
    test('should create agent manager when start({ agent: true }) is called', async () => {
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

      // Initially, no managers should exist
      expect(WebSocketManager).not.toHaveBeenCalled();

      // Call start with agent flag
      await act(async () => {
        await ref.current.start({ agent: true });
      });

      // Verify agent manager was created
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(WebSocketManager).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent'
        })
      );

      // Verify agent manager connect was called
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);
    });

    test('should create transcription manager when start({ transcription: true }) is called', async () => {
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

      // Call start with transcription flag
      await act(async () => {
        await ref.current.start({ transcription: true });
      });

      // Verify transcription manager was created
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(WebSocketManager).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'transcription'
        })
      );

      // Verify transcription manager connect was called
      expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
    });

    test('should create both managers when start({ agent: true, transcription: true }) is called', async () => {
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

      // Call start with both flags
      await act(async () => {
        await ref.current.start({ agent: true, transcription: true });
      });

      // Verify both managers were created
      expect(WebSocketManager).toHaveBeenCalledTimes(2);
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);
      expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
    });

    test('should use props to determine services when start() called without flags', async () => {
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

      // Call start without flags
      await act(async () => {
        await ref.current.start();
      });

      // Should create both managers based on props
      expect(WebSocketManager).toHaveBeenCalledTimes(2);
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);
      expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
    });

    test('should only create agent when start() called with only agentOptions prop', async () => {
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

      // Call start without flags
      await act(async () => {
        await ref.current.start();
      });

      // Should only create agent manager
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(WebSocketManager).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent'
        })
      );
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);
    });

    test('should not create transcription when start({ agent: true, transcription: false }) is called', async () => {
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

      // Call start with explicit transcription: false
      await act(async () => {
        await ref.current.start({ agent: true, transcription: false });
      });

      // Should only create agent manager, not transcription
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(WebSocketManager).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent'
        })
      );
      expect(mockTranscriptionManager.connect).not.toHaveBeenCalled();
    });

    test('should throw error when requesting unconfigured service', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={mockApiKey}
          agentOptions={mockAgentOptions}
          // No transcriptionOptions
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Should throw when requesting transcription that's not configured
      await act(async () => {
        await expect(
          ref.current.start({ transcription: true })
        ).rejects.toThrow('Transcription service requested but transcriptionOptions not configured');
      });
    });
  });

  describe('injectUserMessage() Lazy Creation', () => {
    test('should create agent manager when injectUserMessage() is called', async () => {
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

      // Initially, no managers should exist
      expect(WebSocketManager).not.toHaveBeenCalled();

      // Set up mock to return 'connected' after connect is called
      mockAgentManager.getState.mockReturnValueOnce('closed');
      mockAgentManager.getState.mockReturnValueOnce('connecting');
      mockAgentManager.getState.mockReturnValueOnce('connected');
      
      // Issue #345: Set up Settings before calling injectUserMessage (it waits for Settings)
      mockAgentManager.hasSettingsBeenSent.mockReturnValue(true);
      window.globalSettingsSent = true;

      // Call injectUserMessage
      await act(async () => {
        await ref.current.injectUserMessage('Hello');
      });

      // Verify agent manager was created
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(WebSocketManager).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent'
        })
      );

      // Verify connection was established
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);

      // Verify message was sent
      expect(mockAgentManager.sendJSON).toHaveBeenCalledWith({
        type: 'InjectUserMessage',
        content: 'Hello'
      });
    });

    test('should reuse existing agent manager if already created', async () => {
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
      }, { timeout: 5000 });

      // Issue #345: Set up Settings flags before calling methods
      window.globalSettingsSent = false;
      mockAgentManager.hasSettingsBeenSent.mockReturnValue(false);

      // Create manager via start()
      await act(async () => {
        await ref.current.start({ agent: true });
      });

      // Clear mocks to track injectUserMessage behavior
      jest.clearAllMocks();

      // Set up mock to return 'connected' (already connected)
      mockAgentManager.getState.mockReturnValue('connected');

      // Call injectUserMessage
      await act(async () => {
        await ref.current.injectUserMessage('Hello');
      });

      // Should NOT create a new manager
      expect(WebSocketManager).not.toHaveBeenCalled();

      // Should NOT call connect (already connected)
      expect(mockAgentManager.connect).not.toHaveBeenCalled();

      // Should send message
      expect(mockAgentManager.sendJSON).toHaveBeenCalledWith({
        type: 'InjectUserMessage',
        content: 'Hello'
      });
    });
  });

  describe('startAudioCapture() Lazy Creation', () => {
    test('should create both managers when startAudioCapture() is called in dual mode', async () => {
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
      }, { timeout: 5000 });

      // Issue #345: Set up Settings flags before calling methods
      window.globalSettingsSent = false;
      mockAgentManager.hasSettingsBeenSent.mockReturnValue(false);

      // Mock getState to return 'closed' initially, then 'connected' after connect
      mockTranscriptionManager.getState.mockReturnValue('closed');
      mockAgentManager.getState.mockReturnValue('closed');
      
      mockTranscriptionManager.connect.mockImplementation(async () => {
        mockTranscriptionManager.getState.mockReturnValue('connected');
      });
      mockAgentManager.connect.mockImplementation(async () => {
        mockAgentManager.getState.mockReturnValue('connected');
      });

      // Call startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Verify both managers were created
      expect(WebSocketManager).toHaveBeenCalledTimes(2);
      expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);

      // Verify audio recording started
      expect(mockAudioManager.startRecording).toHaveBeenCalledTimes(1);
    });

    test('should handle agent already connected when startAudioCapture() is called', async () => {
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

      // First, start only agent connection (explicitly disable transcription)
      await act(async () => {
        await ref.current.start({ agent: true, transcription: false });
      });

      // Verify agent manager was created
      const callsAfterStart = WebSocketManager.mock.calls.length;
      const agentCalls = WebSocketManager.mock.calls.filter(call => call[0].service === 'agent');
      const transcriptionCalls = WebSocketManager.mock.calls.filter(call => call[0].service === 'transcription');
      
      // Should have created agent manager
      expect(agentCalls.length).toBe(1);
      // Should NOT have created transcription manager yet
      expect(transcriptionCalls.length).toBe(0);

      // Set up mocks to show agent already connected
      mockAgentManager.getState.mockReturnValue('connected');
      mockTranscriptionManager.getState.mockReturnValue('closed');
      
      mockTranscriptionManager.connect.mockImplementation(async () => {
        mockTranscriptionManager.getState.mockReturnValue('connected');
      });

      // Clear only the connect mocks
      mockAgentManager.connect.mockClear();
      mockTranscriptionManager.connect.mockClear();

      // Call startAudioCapture
      await act(async () => {
        await ref.current.startAudioCapture();
      });

      // Should create transcription manager (one more call after start)
      const callsAfterAudioCapture = WebSocketManager.mock.calls.length;
      expect(callsAfterAudioCapture).toBe(callsAfterStart + 1);
      
      // Verify the new call was for transcription service
      const allTranscriptionCalls = WebSocketManager.mock.calls.filter(call => call[0].service === 'transcription');
      expect(allTranscriptionCalls.length).toBe(1);

      // Should NOT call connect on agent (already connected)
      expect(mockAgentManager.connect).not.toHaveBeenCalled();
      
      // Should connect transcription
      expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manager Reuse', () => {
    test('should not create duplicate managers when start() is called multiple times', async () => {
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

      // Call start multiple times
      await act(async () => {
        await ref.current.start({ agent: true });
      });

      await act(async () => {
        await ref.current.start({ agent: true });
      });

      await act(async () => {
        await ref.current.start({ agent: true });
      });

      // Should only create manager once
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(mockAgentManager.connect).toHaveBeenCalledTimes(3); // But connect can be called multiple times
    });
  });
});
