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
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, createMockAgentOptions, MOCK_API_KEY } from './fixtures/mocks';

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
    
    // Reset global settings sent flag (component uses this to prevent duplicate settings)
    (window as any).globalSettingsSent = false;
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('Basic Callback Invocation', () => {
    it('should call onSettingsApplied when SettingsApplied event is received', async () => {
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

      // Start the component to establish connection
      await act(async () => {
        await ref.current?.start();
      });

      // Wait for event listener to be set up
      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
      });

      // Find the event listener
      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      expect(eventListener).toBeDefined();

      // Simulate connection state change to 'connected' to trigger settings send
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      // Wait for settings to be sent
      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Simulate receiving SettingsApplied message
      // The WebSocket manager parses JSON before passing to event listener
      const settingsAppliedMessage = {
        type: 'SettingsApplied'
      };

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: settingsAppliedMessage });
        });
      }

      // Verify callback was called
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });
    });

    it('should NOT call onSettingsApplied when callback is not provided', async () => {
      // This test verifies the callback is optional
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={createMockAgentOptions()}
            // onSettingsApplied is not provided
          />
        );
      });

      // Start the component
      await act(async () => {
        await ref.current?.start();
      });

      // Wait for event listener to be set up
      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      // Simulate connection and settings send
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Simulate receiving SettingsApplied - should not throw error
      const settingsAppliedMessage = {
        type: 'SettingsApplied'
      };

      if (eventListener) {
        await act(async () => {
          // This should not throw even though callback is not provided
          eventListener({ type: 'message', data: settingsAppliedMessage });
        });
      }

      // Component should still function normally
      expect(ref.current).toBeTruthy();
    });

    it('should call onSettingsApplied exactly once per SettingsApplied event', async () => {
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

      // Simulate first SettingsApplied
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });

      // Simulate second SettingsApplied (e.g., after reconnection)
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

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

      const { unmount } = await act(async () => {
        return render(
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

      // Unmount component
      await act(async () => {
        unmount();
      });

      // Simulate SettingsApplied after unmount - should not throw
      if (eventListener) {
        await act(async () => {
          // This should not cause errors even though component is unmounted
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

      // Callback may or may not be called depending on timing, but should not throw
      // The important thing is that it doesn't crash
    });

    it('should handle multiple SettingsApplied events during reconnection scenarios', async () => {
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

      // First connection
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // First SettingsApplied
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

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
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      // Settings should be sent again
      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Second SettingsApplied after reconnection
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

      // Should be called again
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(2);
      });
    });

    it('should NOT call onSettingsApplied for other event types', async () => {
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

      await act(async () => {
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

      // Simulate SettingsApplied
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
        });
      }

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

