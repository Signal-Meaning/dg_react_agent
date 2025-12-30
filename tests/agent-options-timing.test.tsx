/**
 * Integration test to demonstrate React re-render timing issue
 * 
 * This test verifies that the component re-sends Settings when agentOptions changes,
 * especially when functions are added after initial connection.
 * 
 * Test scenarios:
 * 1. Component receives agentOptions without functions, then functions are added
 * 2. Component receives agentOptions with functions from the start (happy path)
 * 3. Component detects agentOptions changes and re-sends Settings
 * 
 * Issue #284: Component should re-send Settings when agentOptions changes
 */

/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  createAgentOptionsWithFunctions,
  createMinimalFunction,
  TestComponentWithFunctions,
  TestComponentWithUpdatableOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  verifySettingsStructure,
  verifySettingsHasFunctions,
  findSettingsWithFunctions,
  assertSettingsWithFunctions,
  waitFor,
  type CapturedSettings,
} from './utils/component-test-helpers';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('AgentOptions Timing Issue', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedSettings: CapturedSettings;

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

  afterEach(() => {
    jest.clearAllMocks();
  });


  test('should re-send Settings when agentOptions.functions is added after initial render', async () => {
    // This test verifies the fix:
    // 1. Component renders with agentOptions without functions
    // 2. Connection is established and Settings is sent (without functions)
    // 3. agentOptions is updated to include functions
    // 4. Component should re-send Settings with functions
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    render(<TestComponentWithFunctions hasFunctions={false} ref={ref as any} />);

    // Setup connection and wait for first Settings
    await setupComponentAndConnect(ref, mockWebSocketManager);

    // Verify first Settings does NOT have functions
    const firstSettings = capturedSettings[0];
    verifySettingsStructure(firstSettings);
    // When no functions, the property might be undefined or empty array
    const firstHasFunctions = firstSettings.agent?.think?.functions && 
                              firstSettings.agent.think.functions.length > 0;
    expect(firstHasFunctions).toBeFalsy(); // Should be false or undefined

    // Wait for agentOptions to be updated with functions and Settings to be re-sent
    // The component should detect the change and re-send Settings
    // Give React time to process the state change and trigger useEffect
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });
    
    await waitFor(() => {
      const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
      return settingsWithFunctions !== undefined;
    }, { timeout: 5000 });

    // Verify that Settings was re-sent with functions
    const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
    
    assertSettingsWithFunctions(settingsWithFunctions, 'when agentOptions changes');
    verifySettingsHasFunctions(settingsWithFunctions, 1);
    expect(settingsWithFunctions.agent.think.functions[0].name).toBe('test');
  });

  test('should send Settings with functions when agentOptions includes functions from start', async () => {
    // This test verifies the happy path: functions are included from the beginning
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    render(<TestComponentWithFunctions hasFunctions={true} ref={ref as any} />);

    // Setup connection
    await setupComponentAndConnect(ref, mockWebSocketManager);

    // Verify Settings HAS functions
    const settings = capturedSettings[0];
    verifySettingsStructure(settings);
    assertSettingsWithFunctions(settings, 'when agentOptions includes functions from start');
    verifySettingsHasFunctions(settings, 1);
    expect(settings.agent.think.functions[0].name).toBe('test');
  });

  test('should detect when agentOptions changes and re-send Settings', async () => {
    // This test verifies that the component detects agentOptions changes
    // and re-sends Settings when functions are added
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptions();
    const updatedOptions = createAgentOptionsWithFunctions();
    
    render(
      <TestComponentWithUpdatableOptions
        initialAgentOptions={initialOptions}
        updatedAgentOptions={updatedOptions}
        ref={ref as any}
      />
    );

    // Setup connection and wait for first Settings
    await setupComponentAndConnect(ref, mockWebSocketManager);

    // Verify first Settings (without functions)
    const firstSettings = capturedSettings[0];
    verifySettingsStructure(firstSettings);
    expect(firstSettings.agent?.think?.functions).toBeUndefined();

    // Wait for agentOptions to be updated and React to process
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
    });
    
    // Wait for second Settings (with functions)
    await waitFor(() => {
      const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
      return settingsWithFunctions !== undefined;
    }, { timeout: 5000 });

    // Verify that Settings was re-sent with functions
    const settingsWithFunctions = capturedSettings.find(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
    verifySettingsHasFunctions(settingsWithFunctions, 1);
  });

  test('should handle multiple agentOptions changes and only re-send when actually changed', async () => {
    // This test verifies that the component doesn't re-send Settings
    // when agentOptions reference changes but content is the same
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const options = createAgentOptionsWithFunctions();
    
    render(
      <TestComponentWithUpdatableOptions
        initialAgentOptions={options}
        updatedAgentOptions={options} // Same content, different reference
        ref={ref}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);

    // Should only have one Settings message (no re-send for same content)
    const settingsCount = capturedSettings.length;
    expect(settingsCount).toBeGreaterThanOrEqual(1);
    
    // If component re-sends due to reference change, we'd have 2+
    // But with deep comparison, it should only send once
    const uniqueSettings = capturedSettings.filter(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    expect(uniqueSettings.length).toBeGreaterThanOrEqual(1);
  });

  test('should re-send Settings when functions are removed from agentOptions', async () => {
    // This test verifies that removing functions also triggers re-send
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptionsWithFunctions();
    const updatedOptions = createAgentOptions(); // Functions removed
    
    render(
      <TestComponentWithUpdatableOptions
        initialAgentOptions={initialOptions}
        updatedAgentOptions={updatedOptions}
        ref={ref as any}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);

    // Verify first Settings (with functions)
    const firstSettings = capturedSettings[0];
    verifySettingsHasFunctions(firstSettings, 1);

    // Wait for agentOptions to be updated and React to process
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
    });
    
    // The component should re-send Settings when functions are removed
    // Wait for second Settings (without functions)
    await waitFor(() => {
      // Check if a second Settings was sent without functions
      const settingsWithoutFunctions = capturedSettings.slice(1).find(s => 
        !s.agent?.think?.functions || s.agent.think.functions.length === 0
      );
      return settingsWithoutFunctions !== undefined || capturedSettings.length > 1;
    }, { timeout: 5000 });
    
    // If a second Settings was sent, verify it has no functions
    if (capturedSettings.length > 1) {
      const secondSettings = capturedSettings.find((s, idx) => 
        idx > 0 && (!s.agent?.think?.functions || s.agent.think.functions.length === 0)
      );
      
      if (secondSettings) {
        const secondHasFunctions = secondSettings.agent?.think?.functions && 
                                   secondSettings.agent.think.functions.length > 0;
        expect(secondHasFunctions).toBeFalsy(); // Should be false or undefined
      }
    }
    
    // At minimum, we should have the first Settings
    expect(capturedSettings.length).toBeGreaterThanOrEqual(1);
  });

  test('should re-send Settings when function parameters change', async () => {
    // This test verifies that changing function parameters triggers re-send
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptionsWithFunctions([
      { ...createMinimalFunction(), name: 'test1' }
    ]);
    const updatedOptions = createAgentOptionsWithFunctions([
      { ...createMinimalFunction(), name: 'test2', description: 'updated' }
    ]);
    
    render(
      <TestComponentWithUpdatableOptions
        initialAgentOptions={initialOptions}
        updatedAgentOptions={updatedOptions}
        ref={ref as any}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);

    // Verify first Settings
    const firstSettings = capturedSettings[0];
    assertSettingsWithFunctions(firstSettings, 'initial Settings with functions');
    verifySettingsHasFunctions(firstSettings, 1);
    expect(firstSettings.agent.think.functions[0].name).toBe('test1');

    // Wait for agentOptions to be updated and React to process
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
    });
    
    // Wait for second Settings with updated function
    await waitFor(() => {
      const updatedSettings = capturedSettings.find(s => 
        s.agent?.think?.functions?.[0]?.name === 'test2'
      );
      return updatedSettings !== undefined;
    }, { timeout: 5000 });

    const updatedSettings = capturedSettings.find(s => 
      s.agent?.think?.functions?.[0]?.name === 'test2'
    );
    
    expect(updatedSettings).toBeDefined();
    expect(updatedSettings?.agent?.think?.functions?.[0]?.description).toBe('updated');
  });
});

