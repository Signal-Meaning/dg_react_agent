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
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentFunction } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  createAgentOptionsWithFunctions,
  setupComponentAndConnect,
  createSettingsCapture,
  verifySettingsStructure,
  verifySettingsHasFunctions,
  verifySettingsNoFunctions,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Function Calling in Settings Message Tests', () => {
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

      const agentOptions = createAgentOptions({ functions });

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      // Verify functions are included in the correct location
      const settings = capturedSettings[0];
      verifySettingsStructure(settings);
      verifySettingsHasFunctions(settings, 1);
      
      // Verify function structure
      const functionDef = settings.agent.think.functions[0];
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

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      const settings = capturedSettings[0];
      verifySettingsHasFunctions(settings, 2);
      expect(settings.agent.think.functions[0].name).toBe('get_weather');
      expect(settings.agent.think.functions[1].name).toBe('search_products');
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

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      const settings = capturedSettings[0];
      verifySettingsHasFunctions(settings, 1);
      
      const functionDef = settings.agent.think.functions[0];
      expect(functionDef.name).toBe('server_function');
      expect(functionDef.endpoint).toBeDefined();
      expect(functionDef.endpoint.url).toBe('https://api.example.com/function');
      expect(functionDef.endpoint.method).toBe('POST');
      expect(functionDef.endpoint.headers).toBeDefined();
      expect(functionDef.endpoint.headers.Authorization).toBe('Bearer token123');
    });

    it('should NOT include functions in Settings when agentOptions.functions is not provided', async () => {
      const agentOptions = createAgentOptions(); // No functions
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      const settings = capturedSettings[0];
      verifySettingsStructure(settings);
      // Functions should not be present when not provided
      expect(settings.agent.think.functions).toBeUndefined();
    });

    it('should NOT include functions in Settings when agentOptions.functions is empty array', async () => {
      const agentOptions = createAgentOptions({ functions: [] }); // Empty array
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      const settings = capturedSettings[0];
      verifySettingsStructure(settings);
      // Functions should not be present when empty array
      expect(settings.agent.think.functions).toBeUndefined();
    });

    it('should filter out client_side from functions in Settings message', async () => {
      // According to Deepgram API spec:
      // - client_side is NOT part of the Settings message
      // - client_side only appears in FunctionCallRequest responses from Deepgram
      // - Functions without endpoint are client-side by default (no flag needed)
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
          // client_side should NOT be included in Settings message
          client_side: true,
          // Other extra properties may be preserved (but client_side must be filtered)
          functionInstructions: 'Example function call usage...'
        } as any
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      const settings = capturedSettings[0];
      verifySettingsHasFunctions(settings, 1);
      
      const functionDef = settings.agent.think.functions[0];
      expect(functionDef.name).toBe('search_products');
      // CRITICAL: client_side must be filtered out (not part of Settings message per Deepgram spec)
      expect(functionDef.client_side).toBeUndefined();
      // Other properties may be preserved (though not officially part of spec)
      expect(functionDef.functionInstructions).toBe('Example function call usage...');
    });
  });
});

