/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Client-Side Function SettingsApplied Tests
 * 
 * Tests to validate that functions with client_side flag do not prevent
 * settingsApplied from being received.
 * 
 * Customer Issue: When client_side flag is included in functions, settingsApplied
 * is never received, suggesting Deepgram may be rejecting the Settings message.
 * 
 * According to Deepgram API spec:
 * - client_side is NOT part of Settings message
 * - client_side only appears in FunctionCallRequest responses from Deepgram
 * - Functions without endpoint are client-side by default
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle, AgentFunction } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, MOCK_API_KEY } from './fixtures/mocks';
import {
  setupComponentAndConnect,
  simulateSettingsApplied,
  waitForEventListener,
} from './utils/component-test-helpers';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Client-Side Function SettingsApplied Tests', () => {
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
        settingsMessagesSent.push(JSON.parse(JSON.stringify(message))); // Deep copy
      }
    });
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('client_side flag in Settings message', () => {
    it('should NOT include client_side in Settings message when functions are sent', async () => {
      // According to Deepgram API spec, client_side should NOT be in Settings message
      // It only appears in FunctionCallRequest responses
      const functionsWithClientSide: AgentFunction[] = [
        {
          name: 'get_weather',
          description: 'Get the current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'Location' }
            }
          },
          // client_side should NOT be included in Settings message
        } as any
      ];

      // Add client_side property (customer might do this)
      (functionsWithClientSide[0] as any).client_side = true;

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functionsWithClientSide
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

      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate connection to trigger Settings send
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      
      // CRITICAL ASSERTION: client_side should NOT be in Settings message
      // If it is, Deepgram may reject the Settings, preventing settingsApplied
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent.think.functions).toBeDefined();
      expect(settingsMessage.agent.think.functions.length).toBe(1);
      
      const functionDef = settingsMessage.agent.think.functions[0];
      expect(functionDef.name).toBe('get_weather');
      expect(functionDef.client_side).toBeUndefined(); // Should NOT be present
    });

    it('should receive settingsApplied when functions WITHOUT client_side are sent', async () => {
      const onSettingsApplied = jest.fn();
      
      const functionsWithoutClientSide: AgentFunction[] = [
        {
          name: 'get_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
          // No client_side property - correct according to spec
        }
      ];

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functionsWithoutClientSide
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      await act(async () => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={agentOptions}
            onSettingsApplied={onSettingsApplied}
          />
        );
      });

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      await act(async () => {
        await ref.current?.start({ agent: true, transcription: false });
      });

      const eventListener = await waitForEventListener(mockWebSocketManager);

      // Simulate connection
      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify Settings was sent with functions
      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent.think.functions).toBeDefined();
      expect(settingsMessage.agent.think.functions[0].client_side).toBeUndefined();

      // Simulate receiving SettingsApplied (this should work if client_side is not in Settings)
      await simulateSettingsApplied(eventListener);

      // Verify callback was called
      await waitFor(() => {
        expect(onSettingsApplied).toHaveBeenCalledTimes(1);
      });
    });

    it('should verify client_side is filtered out from functions before sending Settings', async () => {
      // This test validates that if customer includes client_side, it gets filtered out
      const functionsWithClientSide: AgentFunction[] = [
        {
          name: 'test_function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} },
          // Customer incorrectly includes client_side
        } as any
      ];
      
      (functionsWithClientSide[0] as any).client_side = true;
      (functionsWithClientSide[0] as any).someOtherProperty = 'should be preserved';

      const agentOptions = {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        functions: functionsWithClientSide
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

      const eventListener = await waitForEventListener(mockWebSocketManager);

      if (eventListener) {
        await act(async () => {
          eventListener({ type: 'state', state: 'connected' });
        });
      }

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 3000 });

      const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
      
      // ASSERTION: client_side should be filtered out
      expect(settingsMessage).toBeDefined();
      expect(settingsMessage.agent.think.functions[0].client_side).toBeUndefined();
      
      // Other properties should be preserved (if they're valid)
      // Note: someOtherProperty might also be filtered, but client_side definitely should be
    });
  });
});

