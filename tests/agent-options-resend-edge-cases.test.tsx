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
import { DeepgramVoiceInteractionHandle, AgentOptions } from '../src/types';
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
    
    // Establish connection after agentOptions is provided
    // This is required because the component needs to be connected before it can re-send Settings
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear previous Settings to only capture the re-send
    clearCapturedSettings(capturedSettings);
    
    // Trigger agentOptions change by updating it again (to test re-send after connection)
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test2',
        description: 'Test2',
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

    // Issue #399: Settings sent only once per connection — no re-send after agentOptions change
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(capturedSettings.length).toBe(0);
  });

  test('should handle rapid successive agentOptions changes without re-sending (Issue #399)', async () => {
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
    clearCapturedSettings(capturedSettings);
    
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
      await new Promise((r) => setTimeout(r, 400));
    });

    // Issue #399: Settings sent only once per connection — no re-send on rapid changes
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });

  test('should NOT re-send Settings with useMemo pattern (Issue #399)', async () => {
    // This test verifies that the customer's useMemo pattern works
    // (matching TestComponentWithFunctions pattern)
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Create a wrapper component that uses useMemo pattern and exposes ref
    const WrapperComponent = ({ initialHasFunctions }: { initialHasFunctions: boolean }) => {
      const [hasFunctions, setHasFunctions] = useState(initialHasFunctions);
      
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
      }, [hasFunctions]);
      
      React.useEffect(() => {
        if (!initialHasFunctions) {
          setTimeout(() => setHasFunctions(true), 100);
        }
      }, [initialHasFunctions]);
      
      return (
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );
    };
    
    render(<WrapperComponent initialHasFunctions={false} />);
    
    // Wait for component to update hasFunctions
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    await setupComponentAndConnect(ref, mockWebSocketManager);
    clearCapturedSettings(capturedSettings);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Issue #399: Settings sent only once per connection
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });

  test('should NOT re-send Settings when comparison detects change (Issue #399)', async () => {
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
      await new Promise((r) => setTimeout(r, 500));
    });

    // Issue #399: Settings sent only once per connection
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });
});

