/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * onFunctionCallRequest sendResponse Callback Tests
 * 
 * Tests for issue #293: Add sendResponse callback parameter to onFunctionCallRequest
 * 
 * These tests verify that:
 * 1. onFunctionCallRequest callback receives both functionCall and sendResponse parameters
 * 2. sendResponse can be called with a result
 * 3. sendResponse can be called with an error
 * 4. The response is correctly sent to the WebSocket
 * 5. Backward compatibility - the ref-based sendFunctionCallResponse method still works
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentFunction, FunctionCallRequest, FunctionCallResponse } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  simulateConnection,
  waitForEventListener,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('onFunctionCallRequest sendResponse Callback Tests', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedMessages: Array<{ type: string; [key: string]: any }>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    capturedMessages = [];
    
    // Capture all sent messages
    mockWebSocketManager.sendJSON.mockImplementation((message: any) => {
      capturedMessages.push(message);
    });
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('sendResponse callback parameter', () => {
    it('should pass both functionCall and sendResponse to onFunctionCallRequest callback', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      let receivedFunctionCall: FunctionCallRequest | undefined;
      let receivedSendResponse: ((response: FunctionCallResponse) => void) | undefined;

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            receivedFunctionCall = functionCall;
            receivedSendResponse = sendResponse;
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-function-call-id',
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
        expect(receivedFunctionCall).toBeDefined();
        expect(receivedSendResponse).toBeDefined();
      });

      // Verify functionCall parameter
      expect(receivedFunctionCall).toEqual({
        id: 'test-function-call-id',
        name: 'get_current_time',
        arguments: '{}',
        client_side: true
      });

      // Verify sendResponse is a function
      expect(typeof receivedSendResponse).toBe('function');
    });

    it('should send FunctionCallResponse when sendResponse is called with result', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      let receivedSendResponse: ((response: FunctionCallResponse) => void) | undefined;

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            receivedSendResponse = sendResponse;
            
            // Call sendResponse with a result
            sendResponse({
              id: functionCall.id,
              result: { time: '12:00 PM', timezone: 'UTC' }
            });
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-function-call-id',
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
        expect(capturedMessages.length).toBeGreaterThan(0);
      });

      // Find the FunctionCallResponse message
      const responseMessage = capturedMessages.find(
        (msg) => msg.type === 'FunctionCallResponse'
      );

      expect(responseMessage).toBeDefined();
      expect(responseMessage).toEqual({
        type: 'FunctionCallResponse',
        id: 'test-function-call-id',
        name: 'get_current_time',
        content: JSON.stringify({ time: '12:00 PM', timezone: 'UTC' })
      });
    });

    it('should send FunctionCallResponse when sendResponse is called with error', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Call sendResponse with an error
            sendResponse({
              id: functionCall.id,
              error: 'Failed to get time'
            });
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'test-function-call-id',
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
        expect(capturedMessages.length).toBeGreaterThan(0);
      });

      // Find the FunctionCallResponse message
      const responseMessage = capturedMessages.find(
        (msg) => msg.type === 'FunctionCallResponse'
      );

      expect(responseMessage).toBeDefined();
      expect(responseMessage).toEqual({
        type: 'FunctionCallResponse',
        id: 'test-function-call-id',
        name: 'get_current_time',
        content: JSON.stringify({ error: 'Failed to get time' })
      });
    });

    it('should handle async function execution with sendResponse', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'async_function',
          description: 'An async function',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={async (functionCall, sendResponse) => {
            // Simulate async operation
            await new Promise(resolve => setTimeout(resolve, 10));
            
            sendResponse({
              id: functionCall.id,
              result: { completed: true }
            });
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'async-call-id',
            name: 'async_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      await waitFor(() => {
        const responseMessage = capturedMessages.find(
          (msg) => msg.type === 'FunctionCallResponse' && msg.id === 'async-call-id'
        );
        expect(responseMessage).toBeDefined();
      });

      const responseMessage = capturedMessages.find(
        (msg) => msg.type === 'FunctionCallResponse' && msg.id === 'async-call-id'
      );

      expect(responseMessage).toEqual({
        type: 'FunctionCallResponse',
        id: 'async-call-id',
        name: 'async_function',
        content: JSON.stringify({ completed: true })
      });
    });
  });

  describe('Backward compatibility', () => {
    it('should still support ref-based sendFunctionCallResponse method', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall) => {
            // Use ref-based method (backward compatibility)
            ref.current?.sendFunctionCallResponse(
              functionCall.id,
              functionCall.name,
              JSON.stringify({ time: '12:00 PM' })
            );
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'ref-based-call-id',
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
        expect(capturedMessages.length).toBeGreaterThan(0);
      });

      // Find the FunctionCallResponse message
      const responseMessage = capturedMessages.find(
        (msg) => msg.type === 'FunctionCallResponse' && msg.id === 'ref-based-call-id'
      );

      expect(responseMessage).toBeDefined();
      expect(responseMessage).toEqual({
        type: 'FunctionCallResponse',
        id: 'ref-based-call-id',
        name: 'get_current_time',
        content: JSON.stringify({ time: '12:00 PM' })
      });
    });

    it('should allow mixing sendResponse callback and ref-based method', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      let sendResponseCalled = false;
      let refMethodCalled = false;

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Use sendResponse callback
            sendResponse({
              id: functionCall.id,
              result: { method: 'sendResponse' }
            });
            sendResponseCalled = true;

            // Also verify ref method is available
            if (ref.current?.sendFunctionCallResponse) {
              refMethodCalled = true;
            }
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest from Deepgram
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'mixed-call-id',
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
        expect(sendResponseCalled).toBe(true);
        expect(refMethodCalled).toBe(true);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple function calls in one request', async () => {
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

      const receivedCalls: FunctionCallRequest[] = [];

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            receivedCalls.push(functionCall);
            sendResponse({ id: functionCall.id, result: { completed: true } });
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest with multiple functions
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'call-1',
            name: 'function1',
            arguments: '{}',
            client_side: true
          },
          {
            id: 'call-2',
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
        expect(receivedCalls.length).toBe(2);
      });

      expect(receivedCalls[0].id).toBe('call-1');
      expect(receivedCalls[1].id).toBe('call-2');
    });

    it('should prioritize error over result when both are provided', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Provide both result and error (error should take precedence)
            sendResponse({
              id: functionCall.id,
              result: { data: 'should be ignored' },
              error: 'This error should be used'
            });
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

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
        expect(capturedMessages.length).toBeGreaterThan(0);
      });

      const responseMessage = capturedMessages.find(
        (msg) => msg.type === 'FunctionCallResponse'
      );

      expect(responseMessage).toBeDefined();
      // Error should be used, not result
      expect(responseMessage?.content).toBe(JSON.stringify({ error: 'This error should be used' }));
    });

    it('should handle response with neither result nor error', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Send response with only id (no result or error)
            sendResponse({ id: functionCall.id });
          }}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

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
        expect(capturedMessages.length).toBeGreaterThan(0);
      });

      const responseMessage = capturedMessages.find(
        (msg) => msg.type === 'FunctionCallResponse'
      );

      expect(responseMessage).toBeDefined();
      // Should send undefined as JSON
      expect(responseMessage?.content).toBe(JSON.stringify(undefined));
    });

    it('should not crash when onFunctionCallRequest is not provided', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          // onFunctionCallRequest not provided
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

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

      // Should not throw
      expect(() => {
        act(() => {
          eventListener?.({ type: 'message', data: functionCallRequest });
        });
      }).not.toThrow();
    });

    it('should ignore server-side function calls', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'server_function',
          description: 'Server-side function',
          parameters: { type: 'object', properties: {} },
          endpoint: {
            url: 'https://api.example.com/function',
            method: 'POST'
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const callbackInvoked = jest.fn();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={callbackInvoked}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate FunctionCallRequest with server-side function
      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [
          {
            id: 'server-call-id',
            name: 'server_function',
            arguments: '{}',
            client_side: false // Server-side
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait a bit to ensure callback would have been called if it was client-side
      await new Promise(resolve => setTimeout(resolve, 100));

      // Callback should not be invoked for server-side functions
      expect(callbackInvoked).not.toHaveBeenCalled();
    });
  });

  describe('Type exports', () => {
    it('should export FunctionCallRequest type', () => {
      // This test verifies the type is exported and can be used
      const request: FunctionCallRequest = {
        id: 'test-id',
        name: 'test-function',
        arguments: '{}',
        client_side: true
      };

      expect(request.id).toBe('test-id');
      expect(request.name).toBe('test-function');
      expect(request.arguments).toBe('{}');
      expect(request.client_side).toBe(true);
    });

    it('should export FunctionCallResponse type', () => {
      // This test verifies the type is exported and can be used
      const responseWithResult: FunctionCallResponse = {
        id: 'test-id',
        result: { data: 'test' }
      };

      const responseWithError: FunctionCallResponse = {
        id: 'test-id',
        error: 'test error'
      };

      expect(responseWithResult.id).toBe('test-id');
      expect(responseWithResult.result).toEqual({ data: 'test' });
      expect(responseWithError.error).toBe('test error');
    });
  });
});

