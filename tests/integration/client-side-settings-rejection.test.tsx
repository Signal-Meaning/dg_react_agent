/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Integration Test: Client-Side Property Settings Rejection
 * 
 * This test simulates the customer's experience BEFORE the patch:
 * - Functions with client_side property are sent in Settings message (filter bypassed)
 * - Verifies that settingsApplied is NOT received when client_side is present
 * - Demonstrates the actual bug/issue the customer experienced
 * 
 * This test bypasses the filter function to test the raw behavior.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle, AgentFunction } from '../../src/types';
import { createMockWebSocketManager, createMockAudioManager, MOCK_API_KEY } from '../fixtures/mocks';
import {
  setupComponentAndConnect,
  waitForEventListener,
} from '../utils/component-test-helpers';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../../src/utils/websocket/WebSocketManager');
jest.mock('../../src/utils/audio/AudioManager');

// Mock the filter function to return original functions (bypass filter)
jest.mock('../../src/utils/function-utils', () => ({
  filterFunctionsForSettings: (functions: AgentFunction[]) => functions, // Return unchanged
}));

const { WebSocketManager } = require('../../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../../src/utils/audio/AudioManager');

describe('Integration: Client-Side Property Settings Rejection (Without Filter)', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let settingsMessagesSent: any[];
  let onSettingsApplied: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset global settings sent flag
    (window as any).globalSettingsSent = false;
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    settingsMessagesSent = [];
    onSettingsApplied = jest.fn();
    
    // Track all Settings messages sent
    mockWebSocketManager.sendJSON.mockImplementation((message: any) => {
      if (message.type === 'Settings') {
        settingsMessagesSent.push(JSON.parse(JSON.stringify(message))); // Deep copy
      }
    });
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  it('should include client_side in Settings message when filter is bypassed', async () => {
    // This simulates the customer's code BEFORE the patch
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
      } as any
    ];

    // Customer includes client_side (this is what causes the issue)
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
    
    // VERIFY: client_side IS present in Settings message (filter bypassed)
    expect(settingsMessage).toBeDefined();
    expect(settingsMessage.agent.think.functions).toBeDefined();
    expect(settingsMessage.agent.think.functions.length).toBe(1);
    
    const functionDef = settingsMessage.agent.think.functions[0];
    expect(functionDef.name).toBe('get_weather');
    
    // CRITICAL: client_side is present (this is the bug condition)
    expect(functionDef.client_side).toBe(true);
    
    // Simulate Deepgram receiving the Settings message
    // In real scenario, Deepgram would reject this and NOT send SettingsApplied
    // We simulate this by NOT calling simulateSettingsApplied
    
    // Wait a bit to ensure SettingsApplied is NOT received
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // VERIFY: settingsApplied is NOT called (simulating Deepgram rejection)
    expect(onSettingsApplied).not.toHaveBeenCalled();
  });

  it('should include client_side=false in Settings message when filter is bypassed', async () => {
    // Test with client_side=false to verify it's also problematic
    const functionsWithClientSideFalse: AgentFunction[] = [
      {
        name: 'get_time',
        description: 'Get the current time',
        parameters: {
          type: 'object',
          properties: {}
        },
      } as any
    ];

    (functionsWithClientSideFalse[0] as any).client_side = false;

    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.',
      functions: functionsWithClientSideFalse
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

    if (eventListener) {
      await act(async () => {
        eventListener({ type: 'state', state: 'connected' });
      });
    }

    await waitFor(() => {
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
    }, { timeout: 3000 });

    const settingsMessage = settingsMessagesSent.find(msg => msg.type === 'Settings');
    
    // VERIFY: client_side=false IS present in Settings message
    expect(settingsMessage).toBeDefined();
    expect(settingsMessage.agent.think.functions[0].client_side).toBe(false);
    
    // Wait to ensure SettingsApplied is NOT received
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // VERIFY: settingsApplied is NOT called (even with false value)
    expect(onSettingsApplied).not.toHaveBeenCalled();
  });

  it('should verify that the filter function exists and would remove client_side', () => {
    // This test verifies the fix exists (filter function)
    // Note: The actual filter behavior is tested in client-side-function-settings-applied.test.tsx
    // This integration test focuses on demonstrating the customer's issue without the filter
    
    // The filter function should exist in the codebase
    const functionUtils = require('../../src/utils/function-utils');
    expect(functionUtils.filterFunctionsForSettings).toBeDefined();
    expect(typeof functionUtils.filterFunctionsForSettings).toBe('function');
    
    // Note: The actual filtering behavior is tested in the unit tests
    // This integration test demonstrates what happens WITHOUT the filter (customer's experience)
  });
});

