/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options useEffect Must Run Test - Issue #318
 * 
 * Behavior-based tests: Verify that useEffect runs when agentOptions changes
 * by checking that Settings are re-sent, not by checking logs.
 * 
 * Test scenarios:
 * 1. Verify Settings re-sent when useMemo creates new reference (customer pattern)
 * 2. Verify Settings re-sent with customer useMemo pattern component
 * 3. Verify Settings re-sent even without diagnostic logging enabled
 * 4. Verify Settings re-sent when props.agentOptions changes
 * 
 * Issue #318: useEffect not running when agentOptions changes - dependency array issue
 */

import React, { useMemo, useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
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

describe('Agent Options useEffect Must Run - Issue #318', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedSettings: Array<{ type: string; agent?: any; [key: string]: any }>;

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

  test('should verify Settings re-sent when useMemo creates new reference (customer pattern)', async () => {
    // Behavior-based test: Verify Settings re-sent when agentOptions reference changes
    // This proves useEffect runs when it should
    
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
    
    // Clear captured settings to only track re-sent Settings
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
    
    // Wait for Settings to be re-sent
    // If useEffect doesn't run, Settings won't be re-sent, and this will timeout
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    // This assertion proves useEffect ran and detected the change
    const settingsWithFunctions = capturedSettings.find(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions && 
      s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
    expect(settingsWithFunctions!.agent.think.functions[0].name).toBe('test_function');
  });

  test('should verify Settings re-sent with customer useMemo pattern component', async () => {
    // Behavior-based test: Verify Settings re-sent using customer's exact pattern
    // If useEffect doesn't run, Settings won't be re-sent
    
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
    
    // Clear captured settings to only track re-sent Settings
    capturedSettings.length = 0;
    
    // Wait for hasFunctions to update (triggers useMemo to create new reference)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Wait for Settings to be re-sent
    // If useEffect doesn't run, Settings won't be re-sent
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    // This proves useEffect ran when agentOptions reference changed
    const settingsWithFunctions = capturedSettings.find(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions && 
      s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
    expect(settingsWithFunctions!.agent.think.functions[0].name).toBe('test');
  });

  test('should verify Settings re-sent even without diagnostic logging enabled', async () => {
    // Behavior-based test: Verify Settings re-sent even if diagnostic logging is disabled
    // We verify by checking that Settings is re-sent (which requires useEffect to run)
    
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
    
    // Wait for Settings to be re-sent
    // If useEffect doesn't run, Settings won't be re-sent, and this will timeout
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    // This is the functional verification (not just log checking)
    const settingsWithFunctions = capturedSettings.filter(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions && 
      s.agent.think.functions.length > 0
    );
    
    // If useEffect doesn't run, Settings won't be re-sent, and this will fail
    expect(settingsWithFunctions.length).toBeGreaterThan(0);
    expect(settingsWithFunctions[0].agent.think.functions[0].name).toBe('test');
  });

  test('should verify Settings re-sent when props.agentOptions changes', async () => {
    // Behavior-based test: Verify Settings re-sent when prop reference changes
    // This proves dependency array correctly tracks the prop
    
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
    capturedSettings.length = 0;
    
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
    
    // Wait for Settings to be re-sent
    // If useEffect doesn't run, Settings won't be re-sent
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Verify Settings was re-sent with functions
    // This proves useEffect ran when prop reference changed
    const settingsWithFunctions = capturedSettings.find(s => 
      s.type === 'Settings' &&
      s.agent?.think?.functions && 
      s.agent.think.functions.length > 0
    );
    
    expect(settingsWithFunctions).toBeDefined();
    expect(settingsWithFunctions!.agent.think.functions[0].name).toBe('test');
  });
});
