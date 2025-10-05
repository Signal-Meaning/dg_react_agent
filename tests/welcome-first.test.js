/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

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
  const mockApiKey = 'test-api-key';
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

  describe('Auto-connect behavior', () => {
    test('should auto-connect when welcomeFirst is true', async () => {
      const mockConnect = jest.fn().mockResolvedValue();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: mockConnect,
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: jest.fn()
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
        />
      );

      // Wait for auto-connect to be triggered
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    test('should not auto-connect when welcomeFirst is false', async () => {
      const mockConnect = jest.fn().mockResolvedValue();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: mockConnect,
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: jest.fn()
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={false}
        />
      );

      // Wait a bit to ensure no auto-connect happens
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(mockConnect).not.toHaveBeenCalled();
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
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
        />
      );

      // Wait for initialization
      await waitFor(() => {
        expect(mockStartRecording).not.toHaveBeenCalled();
      });
    });

    test('should enable microphone when toggleMicrophone is called', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const mockStopRecording = jest.fn();
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        addEventListener: jest.fn(),
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
          welcomeFirst={true}
        />
      );

      // Wait for initialization
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Enable microphone
      await act(async () => {
        await ref.current.toggleMicrophone(true);
      });

      expect(mockStartRecording).toHaveBeenCalled();
    });

    test('should disable microphone when toggleMicrophone is called with false', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const mockStopRecording = jest.fn();
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        addEventListener: jest.fn(),
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
          welcomeFirst={true}
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
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
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
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
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
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
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
        addEventListener: jest.fn(),
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
          welcomeFirst={true}
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
    test('should include greeting in settings when welcomeFirst is true', async () => {
      const mockSendJSON = jest.fn();
      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: mockSendJSON,
        addEventListener: jest.fn()
      }));

      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: jest.fn().mockResolvedValue(),
        stopRecording: jest.fn(),
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
        />
      );

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
    test('should respond to microphoneEnabled prop changes', async () => {
      const mockStartRecording = jest.fn().mockResolvedValue();
      const mockStopRecording = jest.fn();
      const { AudioManager } = require('../src/utils/audio/AudioManager');
      AudioManager.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        addEventListener: jest.fn(),
        dispose: jest.fn()
      }));

      const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
      WebSocketManager.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        sendJSON: jest.fn(),
        addEventListener: jest.fn()
      }));

      const { rerender } = render(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
          microphoneEnabled={false}
        />
      );

      // Change microphoneEnabled to true
      rerender(
        <DeepgramVoiceInteraction
          {...defaultProps}
          welcomeFirst={true}
          microphoneEnabled={true}
        />
      );

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });
    });
  });
});
