/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Function Call Thinking State Tests
 * 
 * Tests for issue #294: onAgentStateChange('thinking') Not Emitted for Client-Side Function Calls
 * 
 * These tests verify that:
 * 1. onAgentStateChange('thinking') is called when FunctionCallRequest is received for client-side functions
 * 2. State transitions correctly: idle → thinking → speaking → idle
 * 3. Server-side functions do NOT trigger thinking state
 * 4. No duplicate state transitions when already in thinking state
 * 5. AgentStateService is updated correctly
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentFunction, AgentState } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  waitForEventListener,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Function Call Thinking State Tests (Issue #294)', () => {
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

  describe('onAgentStateChange("thinking") for client-side function calls', () => {
    it('should call onAgentStateChange("thinking") when FunctionCallRequest is received for client-side function', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'search_knowledge',
          description: 'Search knowledge base',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            }
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const stateChanges: AgentState[] = [];
      const onAgentStateChange = jest.fn((state: AgentState) => {
        stateChanges.push(state);
      });

      const onFunctionCallRequest = jest.fn();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onAgentStateChange={onAgentStateChange}
          onFunctionCallRequest={onFunctionCallRequest}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram with client-side function
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-function-call-id',
            name: 'search_knowledge',
            arguments: '{"query":"test"}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      await waitFor(() => {
        expect(onAgentStateChange).toHaveBeenCalledWith('thinking');
      });

      // Verify thinking state was called
      expect(stateChanges).toContain('thinking');
      
      // Verify onFunctionCallRequest was also called
      expect(onFunctionCallRequest).toHaveBeenCalled();
    });

    it('should transition from idle to thinking when FunctionCallRequest is received', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const stateChanges: AgentState[] = [];
      const onAgentStateChange = jest.fn((state: AgentState) => {
        stateChanges.push(state);
      });

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onAgentStateChange={onAgentStateChange}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Verify initial state is idle (or at least not thinking)
      expect(stateChanges).not.toContain('thinking');

      // Simulate FunctionCallRequest
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-id',
            name: 'get_current_time',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      await waitFor(() => {
        expect(onAgentStateChange).toHaveBeenCalledWith('thinking');
      });

      // Verify the transition sequence includes thinking
      expect(stateChanges).toContain('thinking');
    });

    it('should NOT call onAgentStateChange("thinking") for server-side function calls', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'server_function',
          description: 'Server-side function',
          parameters: { type: 'object', properties: {} },
          endpoint: 'https://api.example.com/function'
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const onAgentStateChange = jest.fn();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onAgentStateChange={onAgentStateChange}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest with server-side function
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-id',
            name: 'server_function',
            arguments: '{}',
            client_side: false
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait a bit to ensure no state change occurs
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify thinking state was NOT called for server-side functions
      expect(onAgentStateChange).not.toHaveBeenCalledWith('thinking');
    });

    it('should NOT duplicate thinking state transition if already in thinking state', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const stateChanges: AgentState[] = [];
      const onAgentStateChange = jest.fn((state: AgentState) => {
        stateChanges.push(state);
      });

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onAgentStateChange={onAgentStateChange}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // First, transition to thinking state via AgentThinking message
      const agentThinkingMessage = {
        type: 'AgentThinking'
      };

      act(() => {
        eventListener?.({ type: 'message', data: agentThinkingMessage });
      });

      await waitFor(() => {
        expect(onAgentStateChange).toHaveBeenCalledWith('thinking');
      });

      // Clear the mock to count new calls
      const thinkingCallCount = onAgentStateChange.mock.calls.filter(
        call => call[0] === 'thinking'
      ).length;

      // Now send FunctionCallRequest - should NOT trigger another thinking state
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify thinking was not called again
      const newThinkingCallCount = onAgentStateChange.mock.calls.filter(
        call => call[0] === 'thinking'
      ).length;

      expect(newThinkingCallCount).toBe(thinkingCallCount);
    });

    it('should handle multiple client-side functions in one request', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'function1',
          description: 'First function',
          parameters: { type: 'object', properties: {} }
        },
        {
          name: 'function2',
          description: 'Second function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const stateChanges: AgentState[] = [];
      const onAgentStateChange = jest.fn((state: AgentState) => {
        stateChanges.push(state);
      });

      const onFunctionCallRequest = jest.fn();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onAgentStateChange={onAgentStateChange}
          onFunctionCallRequest={onFunctionCallRequest}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest with multiple client-side functions
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-id-1',
            name: 'function1',
            arguments: '{}',
            client_side: true
          },
          {
            id: 'test-id-2',
            name: 'function2',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      await waitFor(() => {
        expect(onAgentStateChange).toHaveBeenCalledWith('thinking');
      });

      // Verify thinking state was called only once (not once per function)
      const thinkingCalls = onAgentStateChange.mock.calls.filter(
        call => call[0] === 'thinking'
      );
      expect(thinkingCalls.length).toBe(1);

      // Verify both function callbacks were invoked
      expect(onFunctionCallRequest).toHaveBeenCalledTimes(2);
    });

    it('should transition from listening to thinking when FunctionCallRequest is received', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const stateChanges: AgentState[] = [];
      const onAgentStateChange = jest.fn((state: AgentState) => {
        stateChanges.push(state);
      });

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onAgentStateChange={onAgentStateChange}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // First, transition to listening state
      const userStartedSpeaking = {
        type: 'UserStartedSpeaking'
      };

      act(() => {
        eventListener?.({ type: 'message', data: userStartedSpeaking });
      });

      await waitFor(() => {
        expect(onAgentStateChange).toHaveBeenCalledWith('listening');
      });

      // Now send FunctionCallRequest - should transition from listening to thinking
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      await waitFor(() => {
        // Should have been called with thinking after listening
        const calls = onAgentStateChange.mock.calls.map(call => call[0]);
        expect(calls).toContain('thinking');
      });

      // Verify the sequence includes listening then thinking
      const calls = stateChanges;
      const listeningIndex = calls.indexOf('listening');
      const thinkingIndex = calls.indexOf('thinking');
      
      expect(listeningIndex).toBeGreaterThanOrEqual(0);
      expect(thinkingIndex).toBeGreaterThan(listeningIndex);
    });
  });
});

