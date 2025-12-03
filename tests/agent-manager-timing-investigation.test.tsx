/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Manager Timing Investigation - Issue #311
 * 
 * This test investigates WHY agentManagerRef.current is null when agentOptions changes.
 * 
 * Hypothesis: The agentOptions useEffect runs BEFORE the agent manager is created,
 * or the manager is cleared during a re-render.
 * 
 * NOTE: Add .only to run this test individually: test.only(...)
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Agent Manager Timing Investigation - Issue #311', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let consoleLogs: string[];
  let agentManagerCreationLogs: string[];
  let agentManagerNullLogs: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    consoleLogs = [];
    agentManagerCreationLogs = [];
    agentManagerNullLogs = [];
    
    // Capture console logs
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      consoleLogs.push(message);
      
      // Track agent manager creation
      if (message.includes('Creating agent manager') || message.includes('agent manager created')) {
        agentManagerCreationLogs.push(message);
      }
      
      // Track when agentManager is null
      if (message.includes('agentManagerExists: false') || message.includes('agentManagerRef.current is null')) {
        agentManagerNullLogs.push(message);
      }
      
      originalLog(...args);
    };
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
    
    (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (window as any).__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  });

  test('should track when agentManager is created vs when agentOptions changes', async () => {
    // This test tracks the exact timing of agentManager creation
    // vs when the agentOptions useEffect runs
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Clear logs before connection
    consoleLogs.length = 0;
    agentManagerCreationLogs.length = 0;
    
    // Establish connection (this should create the agent manager)
    console.log('=== STEP 1: Establishing connection ===');
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Wait a bit for everything to settle
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    console.log('\n=== Agent Manager Creation Logs (after connection) ===');
    agentManagerCreationLogs.forEach(log => console.log(log));
    console.log('=== End Creation Logs ===\n');
    
    // Clear logs before updating agentOptions
    consoleLogs.length = 0;
    agentManagerNullLogs.length = 0;
    
    // Update agentOptions
    console.log('=== STEP 2: Updating agentOptions ===');
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
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    console.log('\n=== Diagnostic Logs (after agentOptions update) ===');
    const diagnosticLogs = consoleLogs.filter(log => 
      log.includes('[agentOptions Change] Diagnostic')
    );
    diagnosticLogs.forEach(log => console.log(log));
    console.log('=== End Diagnostic Logs ===\n');
    
    console.log('\n=== Agent Manager Null Logs ===');
    agentManagerNullLogs.forEach(log => console.log(log));
    console.log('=== End Null Logs ===\n');
    
    // Analysis
    console.log('\n=== ANALYSIS ===');
    console.log(`Agent manager creation logs: ${agentManagerCreationLogs.length}`);
    console.log(`Agent manager null logs: ${agentManagerNullLogs.length}`);
    console.log(`Diagnostic logs: ${diagnosticLogs.length}`);
    
    // Check if agentManager was null when change was detected
    const agentManagerWasNull = diagnosticLogs.some(log => 
      log.includes('agentManagerExists: false')
    );
    
    if (agentManagerWasNull) {
      console.error('\n❌ BUG CONFIRMED: agentManager was null when agentOptions changed!');
      console.error('   This prevents Settings from being re-sent.');
      console.error('   The agentOptions useEffect runs before agentManager is available.');
    } else {
      console.log('\n✅ agentManager exists when agentOptions changes');
    }
    
    // This test is for investigation - we want to see the logs
    // The actual assertion is in the analysis above
    expect(diagnosticLogs.length).toBeGreaterThan(0);
  });
  
  test('should verify agentManager exists immediately after connection', async () => {
    // This test verifies that agentManager exists right after connection
    // If this fails, the manager isn't being created during connection
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    const initialOptions = createAgentOptions({ functions: undefined });
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    // Establish connection
    await setupComponentAndConnect(ref, mockWebSocketManager);
    
    // Wait for connection to be fully established
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    // Check if agentManager was created
    const creationLogs = consoleLogs.filter(log => 
      log.includes('Creating agent manager') || 
      log.includes('agent manager created')
    );
    
    console.log('Agent manager creation logs:', creationLogs);
    
    // The manager should be created during connection
    expect(creationLogs.length).toBeGreaterThan(0);
    
    // Verify the mock was called (which means manager was created)
    expect(WebSocketManager).toHaveBeenCalled();
  });
});

