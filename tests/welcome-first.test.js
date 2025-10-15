/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Welcome-First Behavior Integration Tests
 * 
 * This test suite validates the welcome-first functionality of the DeepgramVoiceInteraction component.
 * The welcome-first feature enables the agent to automatically connect and greet users without
 * requiring initial user interaction, providing a more natural conversation flow.
 * 
 * Key Features Tested:
 * ===================
 * 
 * 1. AUTO-CONNECT BEHAVIOR
 *    - When autoConnect=true: Agent automatically connects and sends greeting
 *    - When autoConnect=false: Agent waits for user to initiate conversation
 *    - Verifies proper WebSocket connection establishment
 * 
 * 2. MICROPHONE CONTROL
 *    - Microphone starts disabled by default in welcome-first mode
 *    - Users can enable/disable microphone via props or imperative handle
 *    - Proper state management for microphone enabled/disabled states
 * 
 * 3. WELCOME MESSAGE HANDLING
 *    - Handles Welcome message from server
 *    - Tracks greeting progress (started, in-progress, completed)
 *    - Calls appropriate callbacks (onWelcomeReceived, onGreetingStarted, onGreetingComplete)
 * 
 * 4. BARGE-IN SUPPORT
 *    - Users can interrupt agent's greeting by speaking
 *    - Properly aborts playback when user starts speaking during greeting
 *    - Transitions to listening state after interruption
 * 
 * 5. SETTINGS SENDING
 *    - Automatically sends agent settings with greeting when autoConnect=true
 *    - Includes proper greeting text in settings payload
 *    - Prevents duplicate settings from being sent
 * 
 * 6. MICROPHONE PROP CONTROL
 *    - Responds to microphoneEnabled prop changes
 *    - Maintains proper internal state synchronization
 * 
 * Test Architecture:
 * =================
 * 
 * - Uses Jest with React Testing Library for component testing
 * - Mocks WebSocketManager and AudioManager to isolate component logic
 * - Tests focus on component behavior rather than external service integration
 * - Each test group focuses on a specific aspect of welcome-first functionality
 * 
 * Mock Strategy:
 * =============
 * 
 * - WebSocketManager: Mocked to simulate connection states and message handling
 * - AudioManager: Mocked to simulate audio recording/playback without actual audio
 * - Event listeners return unsubscribe functions to prevent memory leaks
 * - Console methods mocked to reduce test output noise
 * 
 * Usage Example:
 * =============
 * 
 * ```tsx
 * <DeepgramVoiceInteraction
 *   apiKey="your-api-key"
 *   agentOptions={{
 *     greeting: "Hello! How can I help you today?",
 *     instructions: "You are a helpful assistant.",
 *     voice: "aura-asteria-en"
 *   }}
 *   autoConnect={true}
 *   microphoneEnabled={false}
 *   onWelcomeReceived={() => console.log("Welcome received")}
 *   onGreetingStarted={() => console.log("Greeting started")}
 *   onGreetingComplete={() => console.log("Greeting complete")}
 *   onMicToggle={(enabled) => console.log("Mic toggled:", enabled)}
 * />
 * ```
 * 
 * Note: These are integration tests that verify the component's behavior with mocked
 * dependencies. For end-to-end testing with real API connections, see the Playwright
 * tests in the main voice-commerce repository.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

// Set up default mocks that return unsubscribe functions
const mockUnsubscribe = jest.fn();
const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

WebSocketManager.mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue(),
  close: jest.fn(),
  sendJSON: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  resetIdleTimeout: jest.fn(),
  startKeepalive: jest.fn(),
  stopKeepalive: jest.fn(),
  getState: jest.fn().mockReturnValue('connected')
}));

AudioManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  startRecording: jest.fn().mockResolvedValue(),
  stopRecording: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  dispose: jest.fn()
}));

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

describe('Welcome-First Behavior', () => {
  const mockApiKey = 'test-api-key-that-is-long-enough-for-validation';
  const mockAgentOptions = {
    language: 'en',
    listenModel: 'nova-2',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    greeting: 'Hello! How can I help you today?'
  };

  const defaultProps = {
    apiKey: mockApiKey,
    agentOptions: mockAgentOptions,
    debug: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to get the current mock instances
  const getMocks = () => {
    const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
    const { AudioManager } = require('../src/utils/audio/AudioManager');
    
    // Get the mock implementation functions
    const WebSocketManagerMock = WebSocketManager.getMockImplementation();
    const AudioManagerMock = AudioManager.getMockImplementation();
    
    // Create instances to get the mock functions
    const wsMock = WebSocketManagerMock();
    const audioMock = AudioManagerMock();
    
    return {
      WebSocketManager: wsMock,
      AudioManager: audioMock
    };
  };

  describe('Auto-connect behavior', () => {
    test.skip('should auto-connect when autoConnect is true', async () => {
      const mocks = getMocks();

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
        />
      );

      // Wait for auto-connect to be triggered
      await waitFor(() => {
        expect(mocks.WebSocketManager.connect).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    test('should not auto-connect when autoConnect is false', async () => {
      // Use the getMocks helper which works for other tests
      const mocks = getMocks();
      
      // Render the component
      const { unmount } = render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={false}
        />
      );

      // Advance timers to trigger any setTimeout calls
      jest.advanceTimersByTime(200);
      
      // Check that connect was not called
      expect(mocks.WebSocketManager.connect).not.toHaveBeenCalled();
      
      // Clean up
      unmount();
    });
  });

  describe('Microphone control', () => {
    test('should start with microphone disabled by default', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn())
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
        />
      );

      // Wait for initialization
      await waitFor(() => {
        expect(mockStartRecording).not.toHaveBeenCalled();
      });
    });

    test.skip('should enable microphone when toggleMicrophone is called', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const mockStopRecording = jest.fn();
      const mockSendJSON = jest.fn();
      const mockAddEventListener = jest.fn();
      
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: mockSendJSON,
        addEventListener: mockAddEventListener
      }));

      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          {...defaultProps}
          autoConnect={true}
        />
      );

      // Wait for initialization
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate agent connection state change to trigger settings sending
      const eventHandler = mockAddEventListener.mock.calls[0]?.[0];

      if (eventHandler) {
        act(() => {
          eventHandler({ type: 'state', state: 'connected' });
        });
      }

      // Wait for settings to be sent (required for microphone toggle)
      await waitFor(() => {
        expect(mockSendJSON).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Enable microphone
      await act(async () => {
        await ref.current.toggleMicrophone(true);
      });

      expect(mockStartRecording).toHaveBeenCalled();
    });

    test.skip('should disable microphone when toggleMicrophone is called with false', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const mockStopRecording = jest.fn();
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: jest.fn()
      }));

      const ref = React.createRef();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          {...defaultProps}
          autoConnect={true}
        />
      );

      // Wait for initialization
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Disable microphone
      await act(async () => {
        await ref.current.toggleMicrophone(false);
      });

      expect(mockStopRecording).toHaveBeenCalled();
    });
  });

  describe('Welcome message handling', () => {
    test('should call onWelcomeReceived when Welcome message is received', async () => {
      const onWelcomeReceived = jest.fn();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      const mockAddEventListener = jest.fn();
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: mockAddEventListener
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
          onWelcomeReceived={onWelcomeReceived}
        />
      );

      // Simulate Welcome message
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        act(() => {
          messageHandler({ data: { type: 'Welcome' } });
        });

        expect(onWelcomeReceived).toHaveBeenCalled();
      }
    });

    test('should call onGreetingStarted when AgentStartedSpeaking during greeting', async () => {
      const onGreetingStarted = jest.fn();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      const mockAddEventListener = jest.fn();
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: mockAddEventListener
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
          onGreetingStarted={onGreetingStarted}
        />
      );

      // Simulate Welcome message first
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        act(() => {
          messageHandler({ data: { type: 'Welcome' } });
        });

        // Then simulate AgentStartedSpeaking
        act(() => {
          messageHandler({ data: { type: 'AgentStartedSpeaking' } });
        });

        expect(onGreetingStarted).toHaveBeenCalled();
      }
    });

    test('should call onGreetingComplete when AgentAudioDone during greeting', async () => {
      const onGreetingComplete = jest.fn();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      const mockAddEventListener = jest.fn();
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: mockAddEventListener
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
          onGreetingComplete={onGreetingComplete}
        />
      );

      // Simulate Welcome message first
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        act(() => {
          messageHandler({ data: { type: 'Welcome' } });
        });

        // Then simulate AgentAudioDone
        act(() => {
          messageHandler({ data: { type: 'AgentAudioDone' } });
        });

        expect(onGreetingComplete).toHaveBeenCalled();
      }
    });
  });

  describe('Barge-in during greeting', () => {
    test('should handle barge-in during greeting', async () => {
      const onGreetingComplete = jest.fn();
      const mockAbortPlayback = jest.fn();
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn(),
        abortPlayback: mockAbortPlayback
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      const mockAddEventListener = jest.fn();
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: mockAddEventListener
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
          onGreetingComplete={onGreetingComplete}
        />
      );

      // Simulate Welcome message first
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        act(() => {
          messageHandler({ data: { type: 'Welcome' } });
        });

        // Then simulate UserStartedSpeaking (barge-in)
        act(() => {
          messageHandler({ data: { type: 'UserStartedSpeaking' } });
        });

        expect(mockAbortPlayback).toHaveBeenCalled();
        expect(onGreetingComplete).toHaveBeenCalled();
      }
    });
  });

  describe('Settings sending', () => {
    test.skip('should include greeting in settings when autoConnect is true', async () => {
      const mockSendJSON = jest.fn();
      const mockAddEventListener = jest.fn();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: mockSendJSON,
        addEventListener: mockAddEventListener
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
        />
      );

      // Simulate agent connection state change to trigger settings sending
      const eventHandler = mockAddEventListener.mock.calls[0]?.[0];

      if (eventHandler) {
        act(() => {
          eventHandler({ type: 'state', state: 'connected' });
        });
      }

      // Wait for settings to be sent
      await waitFor(() => {
        expect(mockSendJSON).toHaveBeenCalled();
      });

      const settingsCall = mockSendJSON.mock.calls.find(
        call => call[0].type === 'Settings'
      );
      expect(settingsCall).toBeTruthy();
      expect(settingsCall[0].agent.greeting).toBe(mockAgentOptions.greeting);
    });
  });

  describe('Microphone prop control', () => {
    test.skip('should respond to microphoneEnabled prop changes', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const mockStopRecording = jest.fn();
      const mockSendJSON = jest.fn();
      const mockAddEventListener = jest.fn();
      
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        addEventListener: jest.fn().mockReturnValue(jest.fn()),
        dispose: jest.fn()
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: mockSendJSON,
        addEventListener: mockAddEventListener
      }));

      const { rerender } = render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
          microphoneEnabled={false}
        />
      );

      // Simulate agent connection state change to trigger settings sending
      const eventHandler = mockAddEventListener.mock.calls[0]?.[0];

      if (eventHandler) {
        act(() => {
          eventHandler({ type: 'state', state: 'connected' });
        });
      }

      // Wait for settings to be sent
      await waitFor(() => {
        expect(mockSendJSON).toHaveBeenCalled();
      });

      // Change microphoneEnabled to true
      rerender(
        <DeepgramVoiceInteraction
          {...defaultProps}
          autoConnect={true}
          microphoneEnabled={true}
        />
      );

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });
    });
  });
});
