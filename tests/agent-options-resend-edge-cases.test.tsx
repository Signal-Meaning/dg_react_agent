/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options Re-send Edge Cases - Issue #311
 * 
 * These tests cover edge cases that might explain why the customer's scenario fails:
 * 
 * 1. What if useMemo dependencies aren't set correctly?
 * 2. What if the comparison happens before React finishes processing the update?
 * 3. What if the ref is updated at the wrong time?
 * 4. What if agentOptions is undefined initially, then set?
 * 5. What if agentOptions changes multiple times rapidly?
 * 
 * Issue #311: Component not re-sending Settings when agentOptions changes after connection
 */

import React, { useState, useMemo } from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentOptions, AgentFunction } from '../src/types';
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

/**
 * Test component that mimics customer's pattern but with potential issues
 */
function TestComponentWithMemoIssue({ 
  initialHasFunctions 
}: { 
  initialHasFunctions: boolean 
}) {
  const [hasFunctions, setHasFunctions] = useState(initialHasFunctions);
  
  // POTENTIAL ISSUE: useMemo with wrong dependencies
  // If dependencies don't include hasFunctions, memo won't update
  const agentOptions = useMemo<AgentOptions>(() => {
    const base: AgentOptions = {
      language: 'en',
      listenModel: 'nova-3',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'Test',
      greeting: 'Hello',
    };
    
    if (hasFunctions) {
      base.functions = [{
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }];
    }
    
    return base;
  }, [hasFunctions]); // ✅ CORRECT: hasFunctions in dependencies
  
  React.useEffect(() => {
    if (!initialHasFunctions) {
      setTimeout(() => setHasFunctions(true), 100);
    }
  }, [initialHasFunctions]);
  
  return (
    <DeepgramVoiceInteraction
      apiKey={MOCK_API_KEY}
      agentOptions={agentOptions}
    />
  );
}

describe('Agent Options Re-send Edge Cases - Issue #311', () => {
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
    
    (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  });

  test('should handle agentOptions changing from undefined to defined', async () => {
    // Edge case: What if agentOptions starts as undefined, then is set?
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        // agentOptions not provided (undefined)
      />
    );

    // Component should handle undefined gracefully
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Now provide agentOptions
    const agentOptions = createAgentOptions({
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
          agentOptions={agentOptions}
        />
      );
    });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Should send Settings with functions
    const settingsWithFunctions = capturedSettings.find(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
  });

  test('should handle rapid successive agentOptions changes', async () => {
    // Edge case: What if agentOptions changes multiple times rapidly?
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
    capturedSettings.length = 0;
    
    // Rapid changes
    const options1 = createAgentOptions({
      functions: [{ name: 'func1', description: '1', parameters: { type: 'object', properties: {} } }]
    });
    const options2 = createAgentOptions({
      functions: [{ name: 'func2', description: '2', parameters: { type: 'object', properties: {} } }]
    });
    
    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={options1}
        />
      );
      // Immediately change again
      rerender(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={options2}
        />
      );
    });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Should have re-sent Settings (at least once)
    expect(capturedSettings.length).toBeGreaterThan(0);
  });

  test('should verify useMemo pattern works correctly', async () => {
    // This test verifies that the customer's useMemo pattern works
    // (matching TestComponentWithFunctions pattern)
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    render(<TestComponentWithMemoIssue initialHasFunctions={false} />);
    
    // Wait for component to update hasFunctions
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Check if Settings was re-sent
    // This test verifies the useMemo pattern the customer is using
    const settingsWithFunctions = capturedSettings.find(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    // Note: This might fail if there's a timing issue
    // But it helps us understand if the pattern itself works
    expect(settingsWithFunctions).toBeDefined();
  });

  test('should verify comparison happens after ref update', async () => {
    // Edge case: Verify the ref is updated AFTER comparison, not before
    // This ensures we're comparing the right values
    
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
    consoleLogs.length = 0;
    
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
    
    // Check comparison logs to verify prev vs current values
    const comparisonLogs = consoleLogs.filter(log => 
      log.includes('Comparing values')
    );
    
    expect(comparisonLogs.length).toBeGreaterThan(0);
    
    // The comparison log should show:
    // - prevHasFunctions: false
    // - currentHasFunctions: true
    const comparisonLog = comparisonLogs[comparisonLogs.length - 1];
    expect(comparisonLog).toContain('prevHasFunctions');
    expect(comparisonLog).toContain('currentHasFunctions');
  });
});

