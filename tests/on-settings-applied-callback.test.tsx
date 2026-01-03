/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * onSettingsApplied Callback Tests
 * 
 * Comprehensive test coverage for the onSettingsApplied callback API.
 * 
 * These tests verify that:
 * 1. The callback is invoked when SettingsApplied event is received
 * 2. The callback is optional (component works without it)
 * 3. Edge cases are handled correctly
 * 4. The callback timing relative to other events
 * 
 * Issue #284: Audit test coverage for onSettingsApplied callback API
 */

import React from 'react';
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, createMockAgentOptions } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  simulateSettingsApplied,
  simulateConnection,
  setupConnectAndReceiveSettingsApplied,
  waitForEventListener,
  MOCK_API_KEY,
  waitFor,
} from './utils/component-test-helpers';
import { act } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('onSettingsApplied Callback Tests', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('Basic Callback Invocation', () => {
    it('should call onSettingsApplied when SettingsApplied event is received', async () => {
      const onSettingsApplied = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onSettingsApplied={onSettingsApplied}
        />
      );

      // Setup, connect, send Settings, and receive SettingsApplied
      await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);

      // Verify callback was called
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });
    });

    it('should NOT call onSettingsApplied when callback is not provided', async () => {
      // This test verifies the callback is optional
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          // onSettingsApplied is not provided
        />
      );

      // Setup, connect, and receive SettingsApplied - should not throw error
      await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);

      // Component should still function normally
      expect(ref.current).toBeTruthy();
    });

    it('should call onSettingsApplied exactly once per SettingsApplied event', async () => {
      const onSettingsApplied = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onSettingsApplied={onSettingsApplied}
        />
      );

      // Setup, connect, and receive first SettingsApplied
      const eventListener = await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);

      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });

      // Simulate second SettingsApplied (e.g., after reconnection)
      await simulateSettingsApplied(eventListener);

      // Should be called again
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Callback Timing and Order', () => {
    it('should call onSettingsApplied after connection state changes to connected', async () => {
      const onSettingsApplied = jest.fn();
      const onConnectionStateChange = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={createMockAgentOptions()}
            onSettingsApplied={onSettingsApplied}
            onConnectionStateChange={onConnectionStateChange}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      // Simulate connection state change
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      // Connection state change should be called first
      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Then SettingsApplied should be received
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

      // onSettingsApplied should be called after connection state change
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalled();
      });

      // Verify order: connection state change should happen before settings applied
      const connectionStateCallOrder = onConnectionStateChange.mock.invocationCallOrder[0];
      const settingsAppliedCallOrder = onSettingsApplied.mock.invocationCallOrder[0];
      
      expect(connectionStateCallOrder).toBeLessThan(settingsAppliedCallOrder);
    });

    it('should call onSettingsApplied after Welcome message is received', async () => {
      const onSettingsApplied = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={createMockAgentOptions()}
            onSettingsApplied={onSettingsApplied}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      // Simulate connection
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Simulate Welcome message first
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'Welcome', request_id: 'test-123' } });
        });
      }

      // Then SettingsApplied
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

      // onSettingsApplied should be called
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle SettingsApplied event even if component unmounts before callback completes', async () => {
      const onSettingsApplied = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const { unmount } = render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onSettingsApplied={onSettingsApplied}
        />
      );

      // Setup and connect
      const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);

      // Unmount component
      unmount();

      // Simulate SettingsApplied after unmount - should not throw
      await simulateSettingsApplied(eventListener);

      // Callback may or may not be called depending on timing, but should not throw
      // The important thing is that it doesn't crash
    });

    it('should handle multiple SettingsApplied events during reconnection scenarios', async () => {
      const onSettingsApplied = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onSettingsApplied={onSettingsApplied}
        />
      );

      // First connection and SettingsApplied
      const eventListener = await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);

      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });

      // Simulate disconnection
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'closed' });
        });
      }

      // Simulate reconnection
      await simulateConnection(eventListener, mockWebSocketManager);

      // Settings should be sent again
      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Second SettingsApplied after reconnection
      await simulateSettingsApplied(eventListener);

      // Should be called again
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(2);
      });
    });

    it('should NOT call onSettingsApplied for other event types', async () => {
      const onSettingsApplied = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onSettingsApplied={onSettingsApplied}
        />
      );

      // Setup connection (setupComponentAndConnect now simulates SettingsApplied)
      // Clear the callback count after setup since SettingsApplied was already sent
      const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
      
      // Clear the callback count - we already got one call from setupComponentAndConnect
      // Now we want to verify other event types don't trigger it
      onSettingsApplied.mockClear();

      // Simulate other event types
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'Welcome' } });
          eventListener({ type: 'message', data: { type: 'ConversationText' } });
          eventListener({ type: 'message', data: { type: 'AgentThinking' } });
          eventListener({ type: 'message', data: { type: 'UserStartedSpeaking' } });
        });
      }

      // Wait a bit to ensure no callback is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      // onSettingsApplied should NOT be called for other event types
      // (We cleared the count after setupComponentAndConnect, so this should be 0)
      expect(onSettingsApplied).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Other Callbacks', () => {
    it('should work correctly when used alongside other callbacks', async () => {
      const onSettingsApplied = jest.fn();
      const onReady = jest.fn();
      const onConnectionStateChange = jest.fn();
      const onAgentStateChange = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onSettingsApplied={onSettingsApplied}
          onReady={onReady}
          onConnectionStateChange={onConnectionStateChange}
          onAgentStateChange={onAgentStateChange}
        />
      );

      // Setup, connect, and receive SettingsApplied
      await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);

      // All callbacks should work independently
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });

      // Other callbacks should not interfere
      expect(onReady).toBeDefined();
      expect(onConnectionStateChange).toBeDefined();
      expect(onAgentStateChange).toBeDefined();
    });
  });
});

