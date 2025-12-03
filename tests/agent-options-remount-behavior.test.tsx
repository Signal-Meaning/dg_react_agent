/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Remount Behavior Test - Issue #318
 * 
 * This test verifies what happens when the component remounts (not just re-renders)
 * and how this affects the agentOptions useEffect and prevAgentOptionsForResendRef.
 * 
 * This is critical because if the component remounts:
 * - prevAgentOptionsForResendRef resets to undefined
 * - The useEffect skips change detection on "first render" (line 1005)
 * - Settings won't be re-sent even if agentOptions changed
 * 
 * Test scenarios:
 * 1. Verify component remounting resets prevAgentOptionsForResendRef
 * 2. Verify useEffect skips change detection on remount (first render check)
 * 3. Verify Settings re-send works after remount when agentOptions changes again
 * 4. Test the scenario where component remounts with different agentOptions
 * 
 * Issue #318: useEffect not running when agentOptions changes - dependency array issue
 * Related: Issue #276 - Component remounting in Strict Mode
 */

import React from 'react';
import { render, act, unmount } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentOptions } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  MOCK_API_KEY,
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
  let capturedSettings: Array<{ type: string; agent?: any; [key: string]: any }>;
  let consoleLogs: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    consoleLogs = [];
    
    // Capture console logs
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      consoleLogs.push(message);
      originalLog(...args);
    };
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    capturedSettings = createSettingsCapture(mockWebSocketManager);
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
    
    // Enable diagnostic logging
    (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  });

  test('should verify remounting resets prevAgentOptionsForResendRef', async () => {
    // This test verifies that when component remounts, prevAgentOptionsForResendRef
    // is reset to undefined, causing the useEffect to skip change detection
    
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
    
    // Clear logs
    consoleLogs.length = 0;
    capturedSettings.length = 0;
    
    // Force remount by unmounting and rendering again with different key
    await act(async () => {
      unmount();
    });
    
    // Remount with new key (forces React to create new component instance)
    const { rerender: rerender2 } = render(
      <DeepgramVoiceInteraction
        key="mount-2"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );
    
    // Wait for remount to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Re-establish connection after remount
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Check for "First render" log (indicates prevAgentOptionsForResendRef was reset)
    const firstRenderLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] First render - skipping change detection')
    );
    
    // After remount, we should see "First render" log because ref was reset
    expect(firstRenderLogs.length).toBeGreaterThan(0);
  });

  test('should verify Settings re-send works after remount when agentOptions changes', async () => {
    // This test verifies that after a remount, if agentOptions changes again,
    // the component correctly detects the change and re-sends Settings
    
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
    
    // Don't clear logs yet - we want to see the "First render" log from remount
    // Check for "First render" log from the remount itself
    const remountFirstRenderLogs = consoleLogs.filter(log => 
      log.includes('First render - skipping change detection')
    );
    
    // After remount, we should see "First render" log because ref was reset
    expect(remountFirstRenderLogs.length).toBeGreaterThan(0);
    
    // Now clear logs for the agentOptions change
    consoleLogs.length = 0;
    capturedSettings.length = 0;
    
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
    
    // Wait for useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // After remount, the first change should be treated as "first render" and skipped
    // Check for entry point logs
    const entryPointLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point')
    );
    
    // useEffect should run
    expect(entryPointLogs.length).toBeGreaterThan(0);
    
    // Check if it was treated as first render (ref was reset during remount)
    // After remount, when we change agentOptions, the ref should already be set
    // from the remount, so this change should NOT be treated as first render
    // Actually wait - after remount, the ref is set to the options from remount
    // So when we change options, it should detect the change
    // But the test name says "first change should be skipped" - let me check the logic
    
    // Actually, the remount sets prevAgentOptionsForResendRef to the options at remount time
    // So if we change options after remount, it should detect the change (not skip)
    // The "first render" skip only happens on the very first mount
    // So this test's expectation might be wrong
    
    // Let's verify: after remount, changing options should detect the change
    const changeDetectionLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions Change] Diagnostic') ||
      log.includes('agentOptionsChanged: true')
    );
    
    // Should detect change (not skip as first render)
    expect(changeDetectionLogs.length).toBeGreaterThan(0);
  });

  test('should verify component remounts with different agentOptions correctly handles first render', async () => {
    // This test verifies the scenario where component remounts with a DIFFERENT
    // agentOptions than it had before remount
    
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
    
    // Clear logs
    consoleLogs.length = 0;
    capturedSettings.length = 0;
    
    // Force remount with DIFFERENT agentOptions
    await act(async () => {
      unmount();
    });
    
    // Remount with different options
    render(
      <DeepgramVoiceInteraction
        key="mount-2"
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={remountOptions}
      />
    );
    
    // Wait for remount
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Re-establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Check logs - should see "First render" because ref was reset
    const firstRenderLogs = consoleLogs.filter(log => 
      log.includes('First render - skipping change detection')
    );
    
    // After remount with different options, it should be treated as first render
    expect(firstRenderLogs.length).toBeGreaterThan(0);
    
    // The ref should have been set to the new options
    const comparingLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Comparing values')
    );
    
    // Should NOT see comparing logs because it was skipped as first render
    expect(comparingLogs.length).toBe(0);
  });

  test('should verify Settings re-send works on second change after remount', async () => {
    // This test verifies that after remount, the SECOND agentOptions change
    // correctly triggers Settings re-send (first change is skipped as "first render")
    
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
    
    // First change after remount (should be skipped as "first render")
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
    
    // Clear logs for second change
    consoleLogs.length = 0;
    capturedSettings.length = 0;
    
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
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // Check for entry point logs (useEffect should run)
    const entryPointLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point') &&
      !log.includes('isFirstRender: true') // Exclude first render
    );
    
    expect(entryPointLogs.length).toBeGreaterThan(0);
    
    // Check for change detection (should detect change from firstChangeOptions to secondChangeOptions)
    const changeDetectionLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions Change] Diagnostic') ||
      log.includes('agentOptionsChanged: true')
    );
    
    expect(changeDetectionLogs.length).toBeGreaterThan(0);
    
    // Settings should be re-sent
    const settingsWithFunctions = capturedSettings.filter(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions.length).toBeGreaterThan(0);
  });
});

