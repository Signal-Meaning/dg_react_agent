/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Re-send After Connection Test - Issue #311
 * 
 * This test reproduces the EXACT customer scenario that's failing:
 * 1. Component renders without functions
 * 2. Connection is established (agentManager exists)
 * 3. Settings is sent (without functions)
 * 4. agentOptions is updated with functions (new reference)
 * 5. Component should detect change AND agentManager should exist
 * 6. Settings should be re-sent with functions
 * 
 * This test SHOULD FAIL if:
 * - agentManager doesn't exist when change is detected
 * - Settings is not re-sent when agentOptions changes after connection
 * 
 * Issue #311: Component not re-sending Settings when agentOptions changes after connection
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  verifySettingsStructure,
  verifySettingsHasFunctions,
  MOCK_API_KEY,
  waitFor,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Agent Options Re-send After Connection - Issue #311', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedSettings: Array<{ type: string; agent?: any; [key: string]: any }>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    capturedSettings = createSettingsCapture(mockWebSocketManager);
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should re-send Settings when agentOptions changes AFTER connection is established', async () => {
    // This is the EXACT customer scenario that's failing
    // NOTE: Add .only to run this test individually: test.only(...)
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Step 1: Render without functions
    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Step 2: Establish connection and wait for first Settings
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Verify connection is established
    expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
    
    // Wait for first Settings to be sent
    await waitFor(() => {
      return capturedSettings.length > 0;
    }, { timeout: 5000 });
    
    // Step 3: Verify first Settings does NOT have functions
    const firstSettings = capturedSettings[0];
    verifySettingsStructure(firstSettings);
    const firstHasFunctions = firstSettings.agent?.think?.functions && 
                              firstSettings.agent.think.functions.length > 0;
    // First settings should not have functions (or functions should be undefined/empty)
    expect(firstHasFunctions).toBeFalsy();
    
    // Step 4: Clear captured settings to track re-sent message
    capturedSettings.length = 0;
    
    // Step 5: Update agentOptions with functions (new reference)
    // This simulates the customer creating a new agentOptions object with functions
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test_function',
        description: 'Test function to verify re-send',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Test query' }
          },
          required: ['query']
        }
      }]
    });
    
    // Re-render with updated agentOptions
    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={updatedOptions}
        />
      );
    });
    
    // Give React time to process the update and trigger useEffect
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Step 6: Wait for Settings to be re-sent
    // If agentManager exists, Settings will be re-sent. If not, this will timeout.
    // This behavior-based check proves agentManager exists when agentOptions changes.
    await waitFor(() => {
      return capturedSettings.length > 0;
    }, { timeout: 5000 });
    
    // Step 7: Verify Settings was re-sent with functions
    // This assertion proves agentManager existed when agentOptions changed
    // If agentManager was null, Settings would not have been re-sent
    const reSentSettings = capturedSettings.filter(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    expect(reSentSettings.length).toBeGreaterThan(0);
    verifySettingsHasFunctions(reSentSettings[0], 1);
    expect(reSentSettings[0].agent.think.functions[0].name).toBe('test_function');
  });
  
  test('should verify agentManager exists when agentOptions changes after connection', async () => {
    // This test specifically checks the root cause: agentManager must exist
    // NOTE: Add .only to run this test individually: test.only(...)
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Wait for connection to be fully established
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Verify agentManager exists (via mock)
    expect(mockWebSocketManager.sendJSON).toBeDefined();
    
    // Update agentOptions
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    });
    
    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={updatedOptions}
        />
      );
    });
    
    // Wait for Settings to be re-sent (if agentManager exists, this will succeed)
    // This behavior-based check proves agentManager exists when agentOptions changes
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    // This assertion proves agentManager existed when agentOptions changed
    const settingsWithFunctions = capturedSettings.find(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions && 
      s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
    expect(settingsWithFunctions!.agent.think.functions[0].name).toBe('test');
  });
});

