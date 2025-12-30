/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Manager Timing Investigation - Issue #311
 * 
 * This test verifies that agentManager exists when agentOptions changes,
 * and that Settings are properly re-sent when agentOptions changes after connection.
 * 
 * Behavior-based testing: Instead of checking logs, we verify:
 * 1. Connection works (agentManager is created)
 * 2. Settings are sent when agentOptions changes
 * 3. Settings content matches the updated agentOptions
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  findSettingsWithFunctions,
  assertSettingsWithFunctions,
  clearCapturedSettings,
  MOCK_API_KEY,
  type CapturedSettings,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Agent Manager Timing Investigation - Issue #311', () => {
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

  test('should re-send Settings when agentOptions changes after connection', async () => {
    // Behavior-based test: Verify that Settings are re-sent when agentOptions changes
    // This proves that agentManager exists and is working correctly
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Clear captured Settings before connection
    clearCapturedSettings(capturedSettings);
    
    // Establish connection (this should create the agent manager)
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Verify initial Settings was sent (proves agentManager was created)
    expect(capturedSettings.length).toBeGreaterThan(0);
    const initialSettings = capturedSettings[capturedSettings.length - 1];
    expect(initialSettings.type).toBe('Settings');
    expect(initialSettings.agent?.think?.functions).toBeUndefined();
    
    // Clear captured Settings before updating agentOptions
    const initialSettingsCount = capturedSettings.length;
    
    // Update agentOptions with functions
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
    
    // Wait for Settings to be re-sent
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(initialSettingsCount);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    const reSentSettings = capturedSettings.slice(initialSettingsCount);
    expect(reSentSettings.length).toBeGreaterThan(0);
    
    const settingsWithFunctions = findSettingsWithFunctions(reSentSettings);
    
    // This assertion proves agentManager existed when agentOptions changed
    // If agentManager was null, Settings would not have been re-sent
    assertSettingsWithFunctions(settingsWithFunctions, 'when agentOptions changes after connection');
    expect(settingsWithFunctions.agent.think.functions[0].name).toBe('test');
  });
  
  test('should verify agentManager is created during connection', async () => {
    // Behavior-based test: Verify that agentManager is created by checking that
    // connection works and Settings are sent
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const initialOptions = createAgentOptions({ functions: undefined });
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Clear captured Settings
    clearCapturedSettings(capturedSettings);
    
    // Establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Verify WebSocketManager was instantiated (proves agentManager was created)
    expect(WebSocketManager).toHaveBeenCalled();
    
    // Verify Settings was sent (proves agentManager exists and is working)
    expect(capturedSettings.length).toBeGreaterThan(0);
    const settings = capturedSettings.find(s => s.type === 'Settings');
    expect(settings).toBeDefined();
    expect(settings!.agent).toBeDefined();
  });
});

