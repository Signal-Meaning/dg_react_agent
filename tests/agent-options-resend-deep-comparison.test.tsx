/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Re-send Deep Comparison Tests - Issue #311, Issue #399
 * 
 * Behavior-based tests: Verify deep comparison logic by checking actual Settings messages sent.
 * 
 * Issue #399: Settings are sent only once per connection. We do NOT re-send when agentOptions
 * changes (avoids SETTINGS_ALREADY_APPLIED and connection close). The tests below that previously
 * expected re-send now assert no re-send.
 * 
 * Test scenarios:
 * 1. When functions are added (new reference): do NOT re-send (Issue #399)
 * 2. When object is mutated (same reference): do NOT re-send (unchanged)
 * 3. When functions array changes: do NOT re-send (Issue #399)
 * 4. When agentOptions reference changes: do NOT re-send (Issue #399)
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

  test('should NOT re-send Settings when functions are added (Issue #399: send only once per connection)', async () => {
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
    const firstSettings = capturedSettings[0];
    expect(firstSettings.agent?.think?.functions).toBeUndefined();

    clearCapturedSettings(capturedSettings);
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test_function',
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

    // Issue #399: Settings sent only once per connection — no re-send when agentOptions changes
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
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

  test('should NOT re-send Settings when functions array changes (Issue #399)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
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
    clearCapturedSettings(capturedSettings);
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'function2',
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Issue #399: Settings sent only once per connection — no re-send
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });

  test('should NOT re-send Settings when agentOptions reference changes (Issue #399)', async () => {
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

    // Issue #399: Settings sent only once per connection — no re-send when reference changes
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });
});
