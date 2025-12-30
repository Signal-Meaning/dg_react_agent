/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Remount Behavior Test - Issue #318
 * 
 * Behavior-based tests: Verify component behavior during remount scenarios
 * by checking actual Settings messages sent, not log messages.
 * 
 * Test scenarios:
 * 1. Verify Settings re-send works after remount when agentOptions changes
 * 2. Verify component remounts with different agentOptions correctly
 * 3. Verify Settings re-send works on second change after remount
 * 
 * Issue #318: useEffect not running when agentOptions changes - dependency array issue
 * Related: Issue #276 - Component remounting in Strict Mode
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
  findSettingsWithFunctions,
  assertSettingsWithFunctions,
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


describe('Agent Options Remount Behavior - Issue #318', () => {
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

  test('should verify Settings re-send works after remount when agentOptions changes', async () => {
    // Behavior-based test: Verify that after remount, changing agentOptions
    // correctly triggers Settings re-send
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptions({ functions: undefined });
    
    // First render
    const { unmount } = render(
      <DeepgramVoiceInteraction
        key="mount-1"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );
    
    // Establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Force remount
    await act(async () => {
      unmount();
    });
    
    // Remount
    const { rerender } = render(
      <DeepgramVoiceInteraction
        key="mount-2"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );
    
    // Wait for remount
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Re-establish connection after remount
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear Settings before agentOptions change
    clearCapturedSettings(capturedSettings);
    
    // Now change agentOptions after remount
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
          key="mount-2"
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
    
    assertSettingsWithFunctions(settingsWithFunctions, 'after remount when agentOptions changes');
    expect(settingsWithFunctions.agent.think.functions[0].name).toBe('test');
  });

  // Issue #333: Settings not sent on new connection after remount
  // https://github.com/Signal-Meaning/dg_react_agent/issues/333
  test.skip('should verify component remounts with different agentOptions correctly', async () => {
    // Behavior-based test: Verify that remounting with different agentOptions
    // results in Settings being sent with the new options
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const initialOptions = createAgentOptions({ functions: undefined });
    const remountOptions = createAgentOptions({
      functions: [{
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    });
    
    // First render
    const { unmount } = render(
      <DeepgramVoiceInteraction
        key="mount-1"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );
    
    // Establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Close the connection before unmounting (this resets hasSentSettingsRef and globalSettingsSent)
    // This simulates a real scenario where connection closes before remount
    await act(async () => {
      await ref.current?.stop();
    });
    
    // Wait a bit for connection to fully close
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Force remount with DIFFERENT agentOptions
    await act(async () => {
      unmount();
    });
    
    // Clear capturedSettings to track only Settings sent after remount
    clearCapturedSettings(capturedSettings);
    
    // Reset mock to ensure we get a fresh event listener from the new component instance
    // This is important because the new instance will register a new event listener
    mockWebSocketManager.addEventListener.mockClear();
    
    // Remount with different options
    render(
      <DeepgramVoiceInteraction
        key="mount-2"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={remountOptions}
      />
    );
    
    // Wait for component to be ready after remount
    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    }, { timeout: 2000 });
    
    // Wait for React to flush all effects (including the one that updates agentOptionsRef)
    // This ensures agentOptionsRef.current is updated with remountOptions before we connect
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Re-establish connection - this should send Settings with the remount options
    // The new component instance should send Settings on first connection
    // setupComponentAndConnect will clear globalSettingsSent before connecting
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Wait for Settings to be sent after remount
    // Use capturedSettings which tracks all Settings sent via the mock
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was sent with the remount options
    // Find Settings message with functions (should be from remount)
    const settingsWithFunctions = findSettingsWithFunctions(capturedSettings);
    
    // After remount with different options, Settings should be sent with new options
    // (The "first render" skip only applies to change detection, not initial Settings send)
    assertSettingsWithFunctions(settingsWithFunctions, 'after remount with different options');
    expect(settingsWithFunctions.agent.think.functions.length).toBeGreaterThan(0);
    expect(settingsWithFunctions.agent.think.functions[0].name).toBe('test');
  });

  test('should verify Settings re-send works on second change after remount', async () => {
    // Behavior-based test: Verify that after remount, the SECOND agentOptions change
    // correctly triggers Settings re-send
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const initialOptions = createAgentOptions({ functions: undefined });
    
    // First render
    const { unmount } = render(
      <DeepgramVoiceInteraction
        key="mount-1"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );
    
    // Establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Force remount
    await act(async () => {
      unmount();
    });
    
    // Remount
    const { rerender } = render(
      <DeepgramVoiceInteraction
        key="mount-2"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Re-establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // First change after remount
    const firstChangeOptions = createAgentOptions({
      functions: [{
        name: 'first',
        description: 'First',
        parameters: { type: 'object', properties: {} }
      }]
    });
    
    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          key="mount-2"
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={firstChangeOptions}
        />
      );
    });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Re-establish connection after first change
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear Settings for second change
    clearCapturedSettings(capturedSettings);
    
    // Second change after remount (should trigger re-send)
    const secondChangeOptions = createAgentOptions({
      functions: [{
        name: 'second',
        description: 'Second',
        parameters: { type: 'object', properties: {} }
      }]
    });
    
    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          key="mount-2"
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={secondChangeOptions}
        />
      );
    });
    
    // Wait for Settings to be re-sent
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with second change functions
    // Find the one with 'second' function name (could be multiple Settings sent)
    const settingsWithSecond = capturedSettings.find(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions?.some(f => f.name === 'second')
    );
    
    expect(settingsWithSecond).toBeDefined();
    if (settingsWithSecond?.agent?.think?.functions) {
      expect(settingsWithSecond.agent.think.functions.find(f => f.name === 'second')?.name).toBe('second');
    } else {
      throw new Error('Settings with second function not found');
    }
  });
});
