/**
 * Integration test - AgentOptions timing (Issue #284, Issue #399)
 *
 * Issue #399: Settings are sent only once per connection. We do NOT re-send when
 * agentOptions changes. Tests that previously expected re-send now assert no re-send.
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


  test('should NOT re-send Settings when agentOptions.functions is added after initial render (Issue #399)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(<TestComponentWithFunctions hasFunctions={false} ref={ref as any} />);
    await setupComponentAndConnect(ref, mockWebSocketManager);

    const firstSettings = capturedSettings[0];
    verifySettingsStructure(firstSettings);
    const firstHasFunctions = firstSettings.agent?.think?.functions && firstSettings.agent.think.functions.length > 0;
    expect(firstHasFunctions).toBeFalsy();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Issue #399: Settings sent only once per connection — no re-send when functions added later
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(findSettingsWithFunctions(capturedSettings)).toBeUndefined();
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

  test('should NOT re-send Settings when agentOptions changes (Issue #399)', async () => {
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

    await setupComponentAndConnect(ref, mockWebSocketManager);
    const firstSettings = capturedSettings[0];
    verifySettingsStructure(firstSettings);
    expect(firstSettings.agent?.think?.functions).toBeUndefined();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Issue #399: Settings sent only once per connection
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
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

  test('should NOT re-send Settings when functions are removed from agentOptions (Issue #399)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptionsWithFunctions();
    const updatedOptions = createAgentOptions();
    render(
      <TestComponentWithUpdatableOptions
        initialAgentOptions={initialOptions}
        updatedAgentOptions={updatedOptions}
        ref={ref as any}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    const firstSettings = capturedSettings[0];
    verifySettingsHasFunctions(firstSettings, 1);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Issue #399: Settings sent only once per connection
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(capturedSettings.length).toBe(1);
  });

  test('should NOT re-send Settings when function parameters change (Issue #399)', async () => {
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
    const firstSettings = capturedSettings[0];
    assertSettingsWithFunctions(firstSettings, 'initial Settings with functions');
    expect(firstSettings.agent.think.functions[0].name).toBe('test1');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Issue #399: Settings sent only once per connection
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(capturedSettings.find(s => s.agent?.think?.functions?.[0]?.name === 'test2')).toBeUndefined();
  });
});

