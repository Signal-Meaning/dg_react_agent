/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options useEffect Must Run Test - Issue #318
 * 
 * This test verifies that the useEffect with dependency [agentOptions, props.debug]
 * MUST run when agentOptions changes. This test would catch the bug where the
 * useEffect doesn't run even though the prop changes.
 * 
 * This test uses the customer's exact pattern (useMemo with hasFunctions) to
 * reproduce the issue they're experiencing.
 * 
 * Test scenarios:
 * 1. Verify useEffect runs when useMemo creates new reference (customer pattern)
 * 2. Verify useEffect runs even if diagnostic logging is disabled
 * 3. Verify useEffect runs when props.agentOptions changes (not just destructured variable)
 * 
 * Issue #318: useEffect not running when agentOptions changes - dependency array issue
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
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

/**
 * Test component that matches customer's exact pattern
 * Uses useMemo with hasFunctions dependency
 */
function TestComponentWithUseMemoPattern({ 
  initialHasFunctions = false 
}: { 
  initialHasFunctions?: boolean 
}) {
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
        name: 'test_function',
        description: 'Test function',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Test query' }
          },
          required: ['query']
        }
      }];
    }
    
    return base;
  }, [hasFunctions]);
  
  React.useEffect(() => {
    if (!initialHasFunctions) {
      const timer = setTimeout(() => setHasFunctions(true), 100);
      return () => clearTimeout(timer);
    }
  }, [initialHasFunctions]);
  
  return (
    <DeepgramVoiceInteraction
      apiKey={MOCK_API_KEY}
      agentOptions={agentOptions}
    />
  );
}

describe('Agent Options useEffect Must Run - Issue #318', () => {
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
    
    // Enable diagnostic logging to verify useEffect runs
    (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  });

  test('should verify useEffect MUST run when useMemo creates new reference (customer pattern)', async () => {
    // This test uses the customer's exact pattern and verifies the useEffect runs
    // If this test fails, it means the useEffect isn't running when it should
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Start without functions (matching customer's initial state)
    const initialOptions = createAgentOptions({ functions: undefined });
    
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Establish connection first
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear logs to only capture logs from the update
    consoleLogs.length = 0;
    capturedSettings.length = 0;
    
    // Update with new reference (matching customer's useMemo pattern)
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test_function',
        description: 'Test function',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Test query' }
          },
          required: ['query']
        }
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
    
    // Wait for React to process the update and run effects
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // CRITICAL ASSERTION: The useEffect MUST run when agentOptions changes
    // If it doesn't run, we won't see the entry point log
    const entryPointLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point')
    );
    
    // This assertion will FAIL if the bug exists (useEffect doesn't run)
    expect(entryPointLogs.length).toBeGreaterThan(0);
    
    // Verify we see the diagnostic logs (confirms useEffect ran and did change detection)
    const diagnosticLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions Change] Diagnostic') ||
      log.includes('[agentOptions useEffect] Comparing values')
    );
    
    expect(diagnosticLogs.length).toBeGreaterThan(0);
  });

  test('should verify useEffect runs with customer useMemo pattern component', async () => {
    // This test uses the exact customer pattern component
    // If the useEffect doesn't run, this test will fail
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    // Render component with customer's pattern
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
          const timer = setTimeout(() => setHasFunctions(true), 100);
          return () => clearTimeout(timer);
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
    
    // Wait for component to establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Clear logs to only capture logs from the update
    consoleLogs.length = 0;
    capturedSettings.length = 0;
    
    // Wait for hasFunctions to update (triggers useMemo to create new reference)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // CRITICAL ASSERTION: The useEffect MUST run when agentOptions reference changes
    // This will fail if the bug exists
    const entryPointLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point') &&
      !log.includes('isFirstRender: true') // Exclude first render
    );
    
    expect(entryPointLogs.length).toBeGreaterThan(0);
  });

  test('should verify useEffect runs even without diagnostic logging enabled', async () => {
    // This test verifies the useEffect runs even if diagnostic logging is disabled
    // We verify by checking that Settings is re-sent (which requires useEffect to run)
    
    delete (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
    
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
    
    // Clear captured settings to only track re-sent Settings
    capturedSettings.length = 0;
    
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
    
    // Wait for useEffect to run and Settings to be re-sent
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // CRITICAL ASSERTION: If useEffect runs, Settings should be re-sent
    // This is the functional verification (not just log checking)
    const settingsWithFunctions = capturedSettings.filter(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    // If useEffect doesn't run, Settings won't be re-sent, and this will fail
    expect(settingsWithFunctions.length).toBeGreaterThan(0);
  });

  test('should verify useEffect dependency array tracks props.agentOptions correctly', async () => {
    // This test verifies that the dependency array correctly tracks the prop
    // by checking that the useEffect runs when the prop changes
    
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
    
    // Create new reference (simulating useMemo creating new reference)
    const updatedOptions = createAgentOptions({
      functions: [{
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    });
    
    // Verify references are different
    expect(updatedOptions).not.toBe(initialOptions);
    
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
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // CRITICAL ASSERTION: useEffect MUST run when prop reference changes
    // This will fail if React's dependency tracking isn't working
    const entryPointLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions useEffect] Entry point')
    );
    
    expect(entryPointLogs.length).toBeGreaterThan(0);
    
    // Verify the effect detected the change
    const changeDetectionLogs = consoleLogs.filter(log => 
      log.includes('agentOptionsChanged: true') ||
      log.includes('[agentOptions Change] Diagnostic')
    );
    
    expect(changeDetectionLogs.length).toBeGreaterThan(0);
  });
});

