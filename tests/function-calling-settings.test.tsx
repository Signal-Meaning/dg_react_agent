/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Function Calling in Settings Message Tests
 * 
 * Comprehensive test coverage for including functions in the Settings message
 * sent to Deepgram.
 * 
 * These tests verify that:
 * 1. Functions from agentOptions.functions are included in agent.think.functions
 * 2. Functions are correctly formatted according to Deepgram API spec
 * 3. Client-side functions (no endpoint) are handled correctly
 * 4. Server-side functions (with endpoint) are handled correctly
 * 5. Settings message without functions works correctly
 * 
 * Issue: Customer reported that functions were not being included in Settings message
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle, AgentFunction } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, MOCK_API_KEY } from './fixtures/mocks';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Function Calling in Settings Message Tests', () => {
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

  describe('Functions Inclusion in Settings Message', () => {
    it('should include functions in agent.think.functions when provided in agentOptions', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'search_products',
          description: 'Search for products across multiple retailers',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Product search query'
              }
            },
            required: ['query']
          }
        }
      ];

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functions
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let capturedSettings: any = null;

      // Capture Settings message
      mockWebSocketManager.sendJSON.mockImplementation((message) => {
        if (message.type === 'Settings') {
          capturedSettings = JSON.parse(JSON.stringify(message)); // Deep clone
        }
      });

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

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
        expect(capturedSettings).not.toBeNull();
      }, { timeout: 3000 });

      // Verify functions are included in the correct location
      expect(capturedSettings).toBeDefined();
      expect(capturedSettings.type).toBe('Settings');
      expect(capturedSettings.agent).toBeDefined();
      expect(capturedSettings.agent.think).toBeDefined();
      expect(capturedSettings.agent.think.functions).toBeDefined();
      expect(Array.isArray(capturedSettings.agent.think.functions)).toBe(true);
      expect(capturedSettings.agent.think.functions.length).toBe(1);
      
      // Verify function structure
      const functionDef = capturedSettings.agent.think.functions[0];
      expect(functionDef.name).toBe('search_products');
      expect(functionDef.description).toBe('Search for products across multiple retailers');
      expect(functionDef.parameters).toBeDefined();
      expect(functionDef.parameters.type).toBe('object');
      expect(functionDef.endpoint).toBeUndefined(); // Client-side function
    });

    it('should include multiple functions in agent.think.functions', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'get_weather',
          description: 'Get current weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' }
            },
            required: ['location']
          }
        },
        {
          name: 'search_products',
          description: 'Search for products',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      ];

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functions
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let capturedSettings: any = null;

      mockWebSocketManager.sendJSON.mockImplementation((message) => {
        if (message.type === 'Settings') {
          capturedSettings = JSON.parse(JSON.stringify(message));
        }
      });

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(capturedSettings).not.toBeNull();
      }, { timeout: 3000 });

      expect(capturedSettings.agent.think.functions).toBeDefined();
      expect(capturedSettings.agent.think.functions.length).toBe(2);
      expect(capturedSettings.agent.think.functions[0].name).toBe('get_weather');
      expect(capturedSettings.agent.think.functions[1].name).toBe('search_products');
    });

    it('should include server-side functions with endpoint in agent.think.functions', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'server_function',
          description: 'A server-side function',
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input parameter' }
            }
          },
          endpoint: {
            url: 'https://api.example.com/function',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer token123'
            }
          }
        }
      ];

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functions
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let capturedSettings: any = null;

      mockWebSocketManager.sendJSON.mockImplementation((message) => {
        if (message.type === 'Settings') {
          capturedSettings = JSON.parse(JSON.stringify(message));
        }
      });

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(capturedSettings).not.toBeNull();
      }, { timeout: 3000 });

      expect(capturedSettings.agent.think.functions).toBeDefined();
      expect(capturedSettings.agent.think.functions.length).toBe(1);
      
      const functionDef = capturedSettings.agent.think.functions[0];
      expect(functionDef.name).toBe('server_function');
      expect(functionDef.endpoint).toBeDefined();
      expect(functionDef.endpoint.url).toBe('https://api.example.com/function');
      expect(functionDef.endpoint.method).toBe('POST');
      expect(functionDef.endpoint.headers).toBeDefined();
      expect(functionDef.endpoint.headers.Authorization).toBe('Bearer token123');
    });

    it('should NOT include functions in Settings when agentOptions.functions is not provided', async () => {
      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
        // No functions property
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let capturedSettings: any = null;

      mockWebSocketManager.sendJSON.mockImplementation((message) => {
        if (message.type === 'Settings') {
          capturedSettings = JSON.parse(JSON.stringify(message));
        }
      });

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(capturedSettings).not.toBeNull();
      }, { timeout: 3000 });

      expect(capturedSettings.agent.think).toBeDefined();
      // Functions should not be present when not provided
      expect(capturedSettings.agent.think.functions).toBeUndefined();
    });

    it('should NOT include functions in Settings when agentOptions.functions is empty array', async () => {
      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: [] // Empty array
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let capturedSettings: any = null;

      mockWebSocketManager.sendJSON.mockImplementation((message) => {
        if (message.type === 'Settings') {
          capturedSettings = JSON.parse(JSON.stringify(message));
        }
      });

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(capturedSettings).not.toBeNull();
      }, { timeout: 3000 });

      expect(capturedSettings.agent.think).toBeDefined();
      // Functions should not be present when empty array
      expect(capturedSettings.agent.think.functions).toBeUndefined();
    });

    it('should preserve extra properties in functions (like client_side, functionInstructions)', async () => {
      // Customer's test file includes client_side and functionInstructions
      // These should be passed through even though they're not in the type definition
      const functions = [
        {
          name: 'search_products',
          description: 'Search for products',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            }
          },
          // Extra properties not in AgentFunction type
          client_side: true,
          functionInstructions: 'Example function call usage...'
        } as any
      ];

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functions
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let capturedSettings: any = null;

      mockWebSocketManager.sendJSON.mockImplementation((message) => {
        if (message.type === 'Settings') {
          capturedSettings = JSON.parse(JSON.stringify(message));
        }
      });

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await act(async () => {
        await ref.current?.start();
      });

      const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0];

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(capturedSettings).not.toBeNull();
      }, { timeout: 3000 });

      expect(capturedSettings.agent.think.functions).toBeDefined();
      expect(capturedSettings.agent.think.functions.length).toBe(1);
      
      const functionDef = capturedSettings.agent.think.functions[0];
      expect(functionDef.name).toBe('search_products');
      // Extra properties should be preserved (Deepgram will ignore unknown properties)
      expect(functionDef.client_side).toBe(true);
      expect(functionDef.functionInstructions).toBe('Example function call usage...');
    });
  });
});

