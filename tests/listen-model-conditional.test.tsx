/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #299: Listen Model Conditional Inclusion Tests
 * 
 * Validates that the component only includes the `listen` provider in Settings
 * message when `listenModel` is explicitly provided in `agentOptions`.
 * 
 * Expected Behavior:
 * - When `listenModel` is provided: Settings message should include `listen` provider
 * - When `listenModel` is omitted: Settings message should NOT include `listen` provider
 * 
 * Current Bug:
 * - Component always includes `listen` provider with default model 'nova-2'
 * - This causes CLIENT_MESSAGE_TIMEOUT errors for text-only input
 */

import React from 'react';
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import { act, waitFor } from '@testing-library/react';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  waitForEventListener,
  simulateSettingsApplied,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Issue #299: Listen Model Conditional Inclusion', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  let capturedSettings: Array<{ type: string; agent?: any; [key: string]: any }>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    // Capture Settings messages
    capturedSettings = createSettingsCapture(mockWebSocketManager);
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('Settings message when listenModel is omitted', () => {
    it('should NOT include listen provider when listenModel is not provided in agentOptions', async () => {
      // Create agentOptions WITHOUT listenModel (text-only mode)
      const agentOptions = {
        language: 'en-US',
        // listenModel is intentionally omitted
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        speakProvider: 'deepgram',
        voice: 'aura-2-apollo-en',
        instructions: 'You are a helpful assistant.',
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      // Verify Settings message was sent
      expect(capturedSettings.length).toBeGreaterThan(0);
      const settings = capturedSettings[0];

      // CRITICAL ASSERTION: listen provider should NOT be present
      expect(settings).toBeDefined();
      expect(settings.type).toBe('Settings');
      expect(settings.agent).toBeDefined();
      
      // The listen provider should NOT be included when listenModel is omitted
      expect(settings.agent.listen).toBeUndefined();
      
      // Verify other required fields are present
      expect(settings.agent.language).toBe('en-US');
      expect(settings.agent.think).toBeDefined();
      expect(settings.agent.speak).toBeDefined();
    });

    it('should include listen provider when listenModel is explicitly provided', async () => {
      // Create agentOptions WITH listenModel (voice input mode)
      const agentOptions = {
        language: 'en-US',
        listenModel: 'nova-3', // Explicitly provided
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        speakProvider: 'deepgram',
        voice: 'aura-2-apollo-en',
        instructions: 'You are a helpful assistant.',
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      // Verify Settings message was sent
      expect(capturedSettings.length).toBeGreaterThan(0);
      const settings = capturedSettings[0];

      // When listenModel is provided, listen provider SHOULD be present
      expect(settings).toBeDefined();
      expect(settings.type).toBe('Settings');
      expect(settings.agent).toBeDefined();
      
      // The listen provider should be included when listenModel is provided
      expect(settings.agent.listen).toBeDefined();
      expect(settings.agent.listen.provider).toBeDefined();
      expect(settings.agent.listen.provider.type).toBe('deepgram');
      expect(settings.agent.listen.provider.model).toBe('nova-3');
    });

    it('should not add default listen provider when listenModel is undefined', async () => {
      // Create agentOptions with listenModel explicitly set to undefined
      const agentOptions = {
        language: 'en-US',
        listenModel: undefined, // Explicitly undefined
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        speakProvider: 'deepgram',
        voice: 'aura-2-apollo-en',
        instructions: 'You are a helpful assistant.',
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      // Verify Settings message was sent
      expect(capturedSettings.length).toBeGreaterThan(0);
      const settings = capturedSettings[0];

      // When listenModel is undefined, listen provider should NOT be present
      expect(settings).toBeDefined();
      expect(settings.type).toBe('Settings');
      expect(settings.agent).toBeDefined();
      
      // The listen provider should NOT be included when listenModel is undefined
      expect(settings.agent.listen).toBeUndefined();
    });
  });

  describe('injectUserMessage regression test (text-only mode)', () => {
    it('should successfully process injectUserMessage when listenModel is omitted', async () => {
      // Create agentOptions WITHOUT listenModel (text-only mode)
      const agentOptions = {
        language: 'en-US',
        // listenModel is intentionally omitted
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        speakProvider: 'deepgram',
        voice: 'aura-2-apollo-en',
        instructions: 'You are a helpful assistant.',
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const onError = jest.fn();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Start the agent connection
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for event listener and simulate connection
      const eventListener = await waitForEventListener(mockWebSocketManager);
      
      // Simulate connection
      await act(async () => {
        if (eventListener) {
          eventListener({ type: 'state', state: 'connected' });
        }
      });

      // Wait for Settings to be sent
      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      });

      // Note: The Settings message currently incorrectly includes listen provider
      // This is the bug being documented. The regression test focuses on
      // verifying that injectUserMessage works despite this bug.

      // Simulate SettingsApplied to complete setup
      await simulateSettingsApplied(eventListener);

      // Clear previous sendJSON calls to track injectUserMessage separately
      mockWebSocketManager.sendJSON.mockClear();

      // Now inject a user message (text-only input)
      const testMessage = 'Hello, this is a text-only message';
      
      await act(async () => {
        await ref.current?.injectUserMessage(testMessage);
      });

      // Verify injectUserMessage was sent correctly
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalledWith({
        type: 'InjectUserMessage',
        content: testMessage
      });

      // CRITICAL: Verify no CLIENT_MESSAGE_TIMEOUT errors occurred
      // The onError callback should NOT be called with CLIENT_MESSAGE_TIMEOUT
      const errorCalls = onError.mock.calls;
      const timeoutErrors = errorCalls.filter(call => {
        const error = call[0];
        return error?.code === 'CLIENT_MESSAGE_TIMEOUT';
      });
      
      expect(timeoutErrors.length).toBe(0);

      // Simulate a successful response from the agent to verify the flow works
      await act(async () => {
        if (eventListener) {
          eventListener({
            type: 'message',
            data: {
              type: 'AgentThinking',
              content: 'Agent is thinking...'
            }
          });
        }
      });

      // Verify the component can handle agent responses without errors
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle multiple injectUserMessage calls when listenModel is omitted', async () => {
      // Create agentOptions WITHOUT listenModel (text-only mode)
      const agentOptions = {
        language: 'en-US',
        // listenModel is intentionally omitted
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        speakProvider: 'deepgram',
        voice: 'aura-2-apollo-en',
        instructions: 'You are a helpful assistant.',
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const onError = jest.fn();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Start the agent connection
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for event listener and simulate connection
      const eventListener = await waitForEventListener(mockWebSocketManager);
      
      // Simulate connection
      await act(async () => {
        if (eventListener) {
          eventListener({ type: 'state', state: 'connected' });
        }
      });

      // Wait for Settings to be sent
      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      });

      // Simulate SettingsApplied to complete setup
      await simulateSettingsApplied(eventListener);

      // Clear previous sendJSON calls
      mockWebSocketManager.sendJSON.mockClear();

      // Send multiple text messages
      const messages = [
        'First message',
        'Second message',
        'Third message'
      ];

      for (const message of messages) {
        await act(async () => {
          await ref.current?.injectUserMessage(message);
        });

        // Verify each message was sent
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalledWith({
          type: 'InjectUserMessage',
          content: message
        });
      }

      // Verify no CLIENT_MESSAGE_TIMEOUT errors occurred
      const errorCalls = onError.mock.calls;
      const timeoutErrors = errorCalls.filter(call => {
        const error = call[0];
        return error?.code === 'CLIENT_MESSAGE_TIMEOUT';
      });
      
      expect(timeoutErrors.length).toBe(0);
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalledTimes(messages.length);
    });
  });
});

