/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Re-send After Connection Test - Issue #311, Issue #399
 * 
 * Issue #399: Settings are sent only once per connection. We do NOT re-send when
 * agentOptions changes (avoids SETTINGS_ALREADY_APPLIED and connection close).
 * These tests now assert that Settings is not re-sent after agentOptions change.
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
  clearCapturedSettings,
  MOCK_API_KEY,
  waitFor,
  type CapturedSettings,
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
  let capturedSettings: CapturedSettings;

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

  test('should NOT re-send Settings when agentOptions changes AFTER connection (Issue #399)', async () => {
    
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
    clearCapturedSettings(capturedSettings);
    
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
    
    // Issue #399: Settings sent only once per connection — do NOT re-send when agentOptions changes
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(capturedSettings.length).toBe(0);
  });
  
  test('should NOT re-send Settings when agentOptions changes after connection (Issue #399)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    clearCapturedSettings(capturedSettings);

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
    
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Issue #399: Settings sent only once per connection
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(capturedSettings.length).toBe(0);
  });
});

