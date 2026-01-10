/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #355: Function Call Response Timeout Guarantee Tests
 * 
 * Tests for guaranteeing that every function call receives a response,
 * preventing CLIENT_MESSAGE_TIMEOUT errors.
 * 
 * These tests verify that:
 * 1. Handler returns void and doesn't call sendResponse() → component sends default error
 * 2. Handler throws error synchronously → component sends error response (not re-throw)
 * 3. Handler returns Promise but doesn't send response → component sends default error
 * 4. Handler returns Promise and throws error → component sends error response
 * 5. Handler calls sendResponse() → component uses handler's response (no duplicate)
 * 6. Handler returns Promise + calls sendResponse → component uses sendResponse (no duplicate)
 * 7. Multiple concurrent function calls → each tracked independently
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentFunction, FunctionCallRequest, FunctionCallResponse } from '../src/types';
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

describe('Issue #355: Function Call Response Guarantee', () => {
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

  describe('Handler returns void without calling sendResponse', () => {
    it('should send default error response when handler returns void and does not call sendResponse', async () => {
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
            // Handler returns void and does NOT call sendResponse
            // Component should automatically send default error response
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for component to send default error response
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        expect(functionCallResponse?.name).toBe('test_function');
        
        // Verify error content
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content.error).toBeDefined();
        expect(content.error).toContain('Handler completed without sending a response');
      }, { timeout: 3000 });
    });
  });

  describe('Handler throws error synchronously', () => {
    it('should send error response when handler throws error synchronously', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const errorMessage = 'Test error message';

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Handler throws error synchronously
            throw new Error(errorMessage);
            // Component should catch and send error response
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for component to send error response
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        
        // Verify error content
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content.error).toBe(errorMessage);
      }, { timeout: 3000 });
    });
  });

  describe('Handler returns Promise without sending response', () => {
    it('should send default error response when handler returns Promise but does not send response', async () => {
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
          onFunctionCallRequest={async (functionCall, sendResponse) => {
            // Handler returns Promise but does NOT call sendResponse or return value
            await new Promise(resolve => setTimeout(resolve, 100));
            // Component should send default error response after Promise resolves
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for Promise to resolve and component to send default error response
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        
        // Verify error content
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content.error).toBeDefined();
        expect(content.error).toContain('Handler completed without sending a response');
      }, { timeout: 2000 });
    });

    it('should send error response when handler returns Promise that rejects', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const errorMessage = 'Promise rejection error';

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={async (functionCall, sendResponse) => {
            // Handler returns Promise that rejects
            await new Promise((resolve, reject) => {
              setTimeout(() => reject(new Error(errorMessage)), 100);
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for Promise to reject and component to send error response
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        
        // Verify error content
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content.error).toBe(errorMessage);
      }, { timeout: 2000 });
    });
  });

  describe('Handler calls sendResponse (should work normally)', () => {
    it('should use handler response when handler calls sendResponse', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const handlerResult = { success: true, data: 'test data' };

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Handler calls sendResponse - component should use this response
            sendResponse({ id: functionCall.id, result: handlerResult });
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for component to send handler's response
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        
        // Verify handler's result is used (not default error)
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content).toEqual(handlerResult);
        expect(content.error).toBeUndefined();
      }, { timeout: 3000 });
    });

    it('should not send duplicate response when handler returns Promise and also calls sendResponse', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const sendResponseResult = { viaSendResponse: true };
      const returnValue = { viaReturn: true };

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={async (functionCall, sendResponse) => {
            // Handler both calls sendResponse AND returns Promise
            sendResponse({ id: functionCall.id, result: sendResponseResult });
            await new Promise(resolve => setTimeout(resolve, 50));
            // Should return value (but sendResponse should take precedence)
            return { id: functionCall.id, result: returnValue };
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for response
      await waitFor(() => {
        const responses = capturedMessages.filter(
          msg => msg.type === 'FunctionCallResponse' && msg.id === 'test-call-id'
        );
        
        // Should only have one response (sendResponse takes precedence)
        expect(responses.length).toBe(1);
        
        const content = JSON.parse(responses[0]?.content || '{}');
        // Should use sendResponse result, not return value
        expect(content).toEqual(sendResponseResult);
      }, { timeout: 2000 });
    });
  });

  describe('Handler returns value (declarative pattern)', () => {
    it('should send response when handler returns sync value', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const returnValue = { id: 'test-call-id', result: { success: true } };

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            // Handler returns value (declarative pattern)
            return returnValue;
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for component to send response from return value
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        
        // Verify return value is used
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content).toEqual(returnValue.result);
      }, { timeout: 3000 });
    });

    it('should send response when handler returns Promise with value', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      const returnValue = { id: 'test-call-id', result: { async: true } };

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={async (functionCall, sendResponse) => {
            // Handler returns Promise with value (declarative pattern)
            await new Promise(resolve => setTimeout(resolve, 50));
            return returnValue;
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
            id: 'test-call-id',
            name: 'test_function',
            arguments: '{}',
            client_side: true
          }
        ]
      };

      act(() => {
        eventListener?.({ type: 'message', data: functionCallRequest });
      });

      // Wait for Promise to resolve and component to send response
      await waitFor(() => {
        const functionCallResponse = capturedMessages.find(
          msg => msg.type === 'FunctionCallResponse'
        );
        expect(functionCallResponse).toBeDefined();
        expect(functionCallResponse?.id).toBe('test-call-id');
        
        // Verify return value is used
        const content = JSON.parse(functionCallResponse?.content || '{}');
        expect(content).toEqual(returnValue.result);
      }, { timeout: 2000 });
    });
  });

  describe('Multiple concurrent function calls', () => {
    it('should track each function call independently', async () => {
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

      const call1ResponseSent = { sent: false };
      const call2ResponseSent = { sent: false };

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
          onFunctionCallRequest={(functionCall, sendResponse) => {
            if (functionCall.id === 'call-1') {
              // First call: returns void, doesn't send response
              // Component should send default error
            } else if (functionCall.id === 'call-2') {
              // Second call: sends response
              sendResponse({ id: functionCall.id, result: { success: true } });
              call2ResponseSent.sent = true;
            }
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

      // Wait for both responses
      await waitFor(() => {
        const responses = capturedMessages.filter(
          msg => msg.type === 'FunctionCallResponse'
        );
        
        // Should have responses for both calls
        expect(responses.length).toBe(2);
        
        const call1Response = responses.find(r => r.id === 'call-1');
        const call2Response = responses.find(r => r.id === 'call-2');
        
        // Call 1: should have default error (handler didn't send response)
        expect(call1Response).toBeDefined();
        const call1Content = JSON.parse(call1Response?.content || '{}');
        expect(call1Content.error).toBeDefined();
        
        // Call 2: should have handler's result
        expect(call2Response).toBeDefined();
        const call2Content = JSON.parse(call2Response?.content || '{}');
        expect(call2Content).toEqual({ success: true });
        expect(call2Content.error).toBeUndefined();
      }, { timeout: 3000 });
    });
  });
});
