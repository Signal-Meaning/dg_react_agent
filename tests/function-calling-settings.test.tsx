/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Function Calling Settings Tests
 * 
 * Tests to verify that functions passed in agentOptions.functions are included
 * in the Settings message sent to Deepgram.
 * 
 * Issue: Functions passed in agentOptions.functions are not included in the Settings message
 * Fix: Added functions to the think section of the Settings message when provided
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

describe('Function Calling Settings Tests', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let settingsMessagesSent: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset global settings sent flag
    (window as any).globalSettingsSent = false;
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    settingsMessagesSent = [];
    
    // Track all Settings messages sent
    mockWebSocketManager.sendJSON.mockImplementation((message: any) => {
      if (message.type === 'Settings') {
        settingsMessagesSent.push(message);
      }
    });
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('Functions Inclusion in Settings Message', () => {
    it('should include functions in Settings message when agentOptions.functions is provided', async () => {
      const mockFunctions: AgentFunction[] = [
        {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The unit for temperature'
              }
            },
            required: ['location']
          }
        },
        {
          name: 'get_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {},
            required: []
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
        functions: mockFunctions
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      // Wait for component to be ready
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Start the component to establish connection
      await act(async () => {
        await ref.current?.start({ agent: true, transcription: false });
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

      // Simulate connection state change to 'connected' - this triggers sendAgentSettings()
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      // Wait for settings to be sent
      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Find the Settings message
      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      
      // CORE ASSERTION: Functions should be included in the think section
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent).toBeDefined();
      expect(settingsMessage.agent.think).toBeDefined();
      expect(settingsMessage.agent.think.functions).toBeDefined();
      expect(settingsMessage.agent.think.functions).toEqual(mockFunctions);
      expect(settingsMessage.agent.think.functions.length).toBe(2);
      
      // Verify function structure
      expect(settingsMessage.agent.think.functions[0].name).toBe('get_weather');
      expect(settingsMessage.agent.think.functions[0].description).toBe('Get the current weather for a location');
      expect(settingsMessage.agent.think.functions[1].name).toBe('get_time');
    });

    it('should NOT include functions in Settings message when agentOptions.functions is not provided', async () => {
      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
        // functions is not provided
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      await act(async () => {
        await ref.current?.start({ agent: true, transcription: false });
      });

      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
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
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      
      // ASSERTION: Functions should NOT be included when not provided
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent.think).toBeDefined();
      expect(settingsMessage.agent.think.functions).toBeUndefined();
    });

    it('should NOT include functions in Settings message when agentOptions.functions is empty array', async () => {
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

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      await act(async () => {
        await ref.current?.start({ agent: true, transcription: false });
      });

      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
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
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      
      // ASSERTION: Functions should NOT be included when array is empty
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent.think).toBeDefined();
      expect(settingsMessage.agent.think.functions).toBeUndefined();
    });

    it('should include functions along with other think settings (endpoint, prompt, etc.)', async () => {
      const mockFunctions: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'A test function',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ];

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        thinkEndpointUrl: 'https://api.openai.com/v1/chat/completions',
        thinkApiKey: 'test-api-key',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: mockFunctions
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
          />
        );
      });

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      await act(async () => {
        await ref.current?.start({ agent: true, transcription: false });
      });

      await waitFor(() => {
        expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
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
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      
      // ASSERTION: Functions should be included along with other think settings
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent.think).toBeDefined();
      expect(settingsMessage.agent.think.functions).toBeDefined();
      expect(settingsMessage.agent.think.functions).toEqual(mockFunctions);
      
      // Verify other think settings are also present
      expect(settingsMessage.agent.think.provider).toBeDefined();
      expect(settingsMessage.agent.think.provider.type).toBe('open_ai');
      expect(settingsMessage.agent.think.provider.model).toBe('gpt-4o-mini');
      expect(settingsMessage.agent.think.prompt).toBe('You are a helpful assistant.');
      expect(settingsMessage.agent.think.endpoint).toBeDefined();
      expect(settingsMessage.agent.think.endpoint.url).toBe('https://api.openai.com/v1/chat/completions');
    });
  });
});

