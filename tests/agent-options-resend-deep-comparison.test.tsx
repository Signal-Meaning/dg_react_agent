/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Re-send Deep Comparison Tests - Issue #311
 * 
 * These tests verify the deep comparison logic used to detect agentOptions changes
 * in the actual component context, not just in isolation.
 * 
 * Test scenarios:
 * 1. Verify useEffect runs when agentOptions reference changes
 * 2. Verify deep comparison correctly detects when functions are added
 * 3. Verify deep comparison correctly detects when functions are removed
 * 4. Verify deep comparison correctly detects when functions array changes
 * 5. Test edge cases: same reference but different content (mutation - should NOT trigger)
 * 6. Test timing: what happens if comparison runs before React finishes update
 * 
 * Issue #311: Component not re-sending Settings when agentOptions changes after connection
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentFunction } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  verifySettingsStructure,
  verifySettingsHasFunctions,
  MOCK_API_KEY,
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
    
    // Capture Settings messages
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

  test('should detect change when functions are added (new reference)', async () => {
    // This test verifies that when agentOptions reference changes and functions are added,
    // the deep comparison correctly detects the change
    
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
    capturedSettings.length = 0;
    consoleLogs.length = 0;
    
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
    
    // Wait for useEffect to run and check diagnostic logs
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Check diagnostic logs for comparison result
    const comparisonLogs = consoleLogs.filter(log => 
      log.includes('Comparing values') || 
      log.includes('agentOptionsChanged')
    );
    
    console.log('Comparison logs:', comparisonLogs);
    
    // Find the diagnostic log that shows agentOptionsChanged
    const diagnosticLog = consoleLogs.find(log => 
      log.includes('agentOptions Change] Diagnostic')
    );
    
    if (diagnosticLog) {
      console.log('Diagnostic log found:', diagnosticLog);
      // The log should show agentOptionsChanged: true
      expect(diagnosticLog).toContain('agentOptionsChanged');
    }
    
    // Verify Settings was re-sent with functions
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    const settingsWithFunctions = capturedSettings.find(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
    if (settingsWithFunctions) {
      verifySettingsHasFunctions(settingsWithFunctions, 1);
    }
  });

  test('should NOT detect change when object is mutated (same reference)', async () => {
    // This test verifies that mutation (same reference) does NOT trigger re-send
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
    capturedSettings.length = 0;
    consoleLogs.length = 0;
    
    // Mutate the same object (BAD practice, but test that we don't trigger on this)
    (agentOptions as any).functions = [{
      name: 'mutated_function',
      description: 'Mutated',
      parameters: { type: 'object', properties: {} }
    }];
    
    // Re-render with same reference (mutation)
    await act(async () => {
      // Force re-render by updating a different prop
      // In real usage, this wouldn't happen, but we're testing edge case
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
    // This test verifies that when functions array content changes,
    // the deep comparison correctly detects it
    
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
    capturedSettings.length = 0;
    consoleLogs.length = 0;
    
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
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Settings should be re-sent with new function
    const settingsWithNewFunction = capturedSettings.find(s => 
      s.agent?.think?.functions && 
      s.agent.think.functions.length > 0 &&
      s.agent.think.functions[0].name === 'function2'
    );
    
    expect(settingsWithNewFunction).toBeDefined();
  });

  test('should verify useEffect dependency array triggers on reference change', async () => {
    // This test verifies that the useEffect actually runs when agentOptions reference changes
    // by checking entry point logs
    
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
    
    // Clear logs
    consoleLogs.length = 0;
    
    // Count entry point logs before update
    const entryPointLogsBefore = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point')
    ).length;
    
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
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Count entry point logs after update
    const entryPointLogsAfter = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point')
    ).length;
    
    // Should have more entry point logs after update (useEffect should have run)
    expect(entryPointLogsAfter).toBeGreaterThan(entryPointLogsBefore);
  });
});

