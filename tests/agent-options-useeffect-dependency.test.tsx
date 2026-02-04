/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options useEffect Dependency Test - Issue #311
 * 
 * Behavior-based tests: Verify that useEffect runs when agentOptions reference changes
 * by checking that Settings are re-sent, not by checking logs.
 * 
 * Test scenarios:
 * 1. Verify Settings re-sent when agentOptions reference changes
 * 2. Verify Settings NOT re-sent when agentOptions reference doesn't change (mutation)
 * 3. Verify useMemo creates new reference when dependency changes
 * 
 * Issue #311: Component not re-sending Settings when agentOptions changes after connection
 */

import React, { useMemo, useState } from 'react';
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
 * Test component that tracks how many times agentOptions reference changes
 */
const TestComponentWithReferenceTracking = React.forwardRef<DeepgramVoiceInteractionHandle, {}>((props, ref) => {
  const [hasFunctions, setHasFunctions] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  
  // Track reference changes
  const agentOptionsRef = React.useRef<AgentOptions | undefined>(undefined);
  const referenceChangeCount = React.useRef(0);
  
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
    
    // Track if reference changed
    if (agentOptionsRef.current !== base) {
      referenceChangeCount.current++;
      agentOptionsRef.current = base;
    }
    
    return base;
  }, [hasFunctions]);
  
  // Track render count (only update when needed, not on every render)
  React.useEffect(() => {
    setRenderCount(c => c + 1);
  }, [hasFunctions]); // Only update when hasFunctions changes
  
  React.useEffect(() => {
    if (!hasFunctions) {
      const timer = setTimeout(() => setHasFunctions(true), 100);
      return () => clearTimeout(timer);
    }
  }, [hasFunctions]);
  
  // Expose tracking to window for test inspection
  React.useEffect(() => {
    (window as any).__testReferenceChangeCount = referenceChangeCount.current;
    (window as any).__testRenderCount = renderCount;
  }, [renderCount]);
  
  return (
    <DeepgramVoiceInteraction
      ref={ref}
      apiKey={MOCK_API_KEY}
      agentOptions={agentOptions}
    />
  );
});

describe('Agent Options useEffect Dependency - Issue #311', () => {
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
    delete (window as any).__testReferenceChangeCount;
    delete (window as any).__testRenderCount;
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

    // Issue #399: Settings sent only once per connection
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });

  test('should verify Settings NOT re-sent when reference is the same', async () => {
    // Behavior-based test: Verify Settings NOT re-sent when reference doesn't change
    // This proves useEffect doesn't run for same reference
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const agentOptions = createAgentOptions({ functions: undefined });
    
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear captured settings
    clearCapturedSettings(capturedSettings);
    
    // Re-render with SAME reference (no change)
    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions} // Same reference
        />
      );
    });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Settings should NOT be re-sent because reference didn't change
    // (useEffect won't run because dependency array watches reference)
    expect(capturedSettings.length).toBe(0);
  });

  test('should NOT re-send Settings when useMemo creates new reference (Issue #399)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(<TestComponentWithReferenceTracking ref={ref} />);
    await setupComponentAndConnect(ref, mockWebSocketManager);
    clearCapturedSettings(capturedSettings);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    const referenceChangeCount = (window as any).__testReferenceChangeCount || 0;
    expect(referenceChangeCount).toBeGreaterThanOrEqual(1);

    // Issue #399: Settings sent only once per connection — no re-send when reference changes
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });
});
