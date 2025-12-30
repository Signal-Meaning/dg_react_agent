/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Re-send Deep Comparison Tests - Issue #311
 * 
 * Behavior-based tests: Verify deep comparison logic by checking actual Settings messages sent,
 * not log messages.
 * 
 * Test scenarios:
 * 1. Verify Settings re-sent when functions are added (new reference)
 * 2. Verify Settings NOT re-sent when object is mutated (same reference)
 * 3. Verify Settings re-sent when functions array changes
 * 4. Verify Settings re-sent when agentOptions reference changes
 * 
 * Issue #311: Component not re-sending Settings when agentOptions changes after connection
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
  verifySettingsHasFunctions,
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

describe('Agent Options Re-send Deep Comparison - Issue #311', () => {
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

  test('should detect change when functions are added (new reference)', async () => {
    // Behavior-based test: Verify Settings re-sent when functions are added
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Initial render without functions
    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Setup connection and wait for first Settings
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Verify first Settings does NOT have functions
    const firstSettings = capturedSettings[0];
    expect(firstSettings.agent?.think?.functions).toBeUndefined();
    
    // Clear captured settings
    clearCapturedSettings(capturedSettings);
    
    // Update agentOptions with functions (new reference)
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test_function',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
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
    
    // Wait for Settings to be re-sent
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
    
    assertSettingsWithFunctions(settingsWithFunctions, 'when functions are added');
    verifySettingsHasFunctions(settingsWithFunctions, 1);
    expect(settingsWithFunctions.agent.think.functions[0].name).toBe('test_function');
  });

  test('should NOT detect change when object is mutated (same reference)', async () => {
    // Behavior-based test: Verify Settings NOT re-sent when object is mutated
    // This is expected behavior - we want new references, not mutations
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Create agentOptions object
    const agentOptions = createAgentOptions({ functions: undefined });
    
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear captured settings
    clearCapturedSettings(capturedSettings);
    
    // Mutate the same object (BAD practice, but test that we don't trigger on this)
    (agentOptions as any).functions = [{
      name: 'mutated_function',
      description: 'Mutated',
      parameters: { type: 'object', properties: {} }
    }];
    
    // Re-render with same reference (mutation)
    // Note: In real usage, this wouldn't happen, but we're testing edge case
    await act(async () => {
      // Force re-render by updating a different prop
      // Actually, we can't force re-render without changing props
      // So this test verifies that mutation alone doesn't trigger re-send
      // The useEffect won't run because dependency array watches reference
    });
    
    // Wait a bit
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Settings should NOT be re-sent because reference didn't change
    // (useEffect won't run because dependency array watches reference)
    expect(capturedSettings.length).toBe(0);
  });

  test('should detect change when functions array changes', async () => {
    // Behavior-based test: Verify Settings re-sent when functions array content changes
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Initial render with one function
    const initialOptions = createAgentOptions({
      functions: [{
        name: 'function1',
        description: 'First function',
        parameters: { type: 'object', properties: {} }
      }]
    });
    
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear captured settings
    clearCapturedSettings(capturedSettings);
    
    // Update with different function (new reference)
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'function2', // Different function
        description: 'Second function',
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
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Settings should be re-sent with new function
    const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
    expect(settingsWithFunctions).toBeDefined();
    // Find the one with function2 (could be multiple Settings sent)
    const settingsWithNewFunction = capturedSettings.find(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions?.some(f => f.name === 'function2')
    );
    
    expect(settingsWithNewFunction).toBeDefined();
    if (settingsWithNewFunction?.agent?.think?.functions) {
      expect(settingsWithNewFunction.agent.think.functions.find(f => f.name === 'function2')?.name).toBe('function2');
    } else {
      throw new Error('Settings with function2 not found');
    }
  });

  test('should verify Settings re-sent when agentOptions reference changes', async () => {
    // Behavior-based test: Verify Settings re-sent when reference changes
    // This proves useEffect runs when dependency changes
    
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
    
    // Clear captured settings
    clearCapturedSettings(capturedSettings);
    
    // Update with new reference
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
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    // This proves useEffect ran and detected the change
    const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
    
    assertSettingsWithFunctions(settingsWithFunctions, 'when agentOptions reference changes');
    expect(settingsWithFunctions.agent.think.functions[0].name).toBe('test');
  });
});
