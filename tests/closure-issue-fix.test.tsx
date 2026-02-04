/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Closure Issue Fix Tests - Issue #307
 * 
 * These tests verify the fix for the closure issue where sendAgentSettings
 * captures a stale agentOptions value from closure, preventing functions from
 * being included in Settings messages.
 * 
 * Test scenarios:
 * 1. Functions included when agentOptions has functions from start (baseline)
 * 2. Functions included when agentOptions updated after connection (closure issue)
 * 3. Ref always has latest agentOptions value (closure fix verification)
 * 4. Multiple agentOptions updates work correctly
 * 
 * Issue #307: Functions Not Included in Settings Message - Closure Issue
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
  verifySettingsNoFunctions,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager classes
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Closure Issue Fix Tests - Issue #307', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedSettings: Array<{ type: string; agent?: any; [key: string]: any }>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    // Capture Settings messages
    capturedSettings = createSettingsCapture(mockWebSocketManager);
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Baseline: Functions included when present from start', () => {
    it('should include functions in Settings when agentOptions has functions from initial render', async () => {
      const functions: AgentFunction[] = [
        {
          name: 'search_products',
          description: 'Search for products',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      ];

      const agentOptions = createAgentOptions({ functions });
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);

      // Verify functions are included
      const settings = capturedSettings[0];
      verifySettingsStructure(settings);
      verifySettingsHasFunctions(settings, 1);
      expect(settings.agent.think.functions[0].name).toBe('search_products');
    });
  });

  describe('Closure Issue: Functions included when agentOptions updated after connection', () => {
    it('should include functions when agentOptions is updated after connection is established', async () => {
      // This test verifies the closure issue fix:
      // 1. Component renders with agentOptions WITHOUT functions
      // 2. Connection is established and Settings is sent (without functions)
      // 3. agentOptions is updated to include functions
      // 4. Component should re-send Settings WITH functions (using latest agentOptions from ref)
      
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // Initial agentOptions without functions
      let agentOptions = createAgentOptions({ functions: undefined });
      
      const { rerender } = render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );

      // Setup connection and wait for first Settings (without functions)
      await setupComponentAndConnect(ref, mockWebSocketManager);

      // Verify first Settings does NOT have functions
      const firstSettings = capturedSettings[0];
      verifySettingsStructure(firstSettings);
      expect(firstSettings.agent?.think?.functions).toBeUndefined();

      // Clear captured settings to track re-sent message
      capturedSettings.length = 0;

      // Update agentOptions to include functions
      const functions: AgentFunction[] = [
        {
          name: 'get_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];

      agentOptions = createAgentOptions({ functions });

      // Re-render with updated agentOptions
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
        await new Promise((r) => setTimeout(r, 400));
      });

      // Issue #399: Settings sent only once per connection — no re-send when agentOptions changes
      expect(capturedSettings.length).toBe(0);
      const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
        (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
      );
      expect(settingsCalls.length).toBe(1);
    });

    it('should send Settings only once when agentOptions changes (Issue #399)', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const functions1: AgentFunction[] = [
        { name: 'function1', description: 'First function', parameters: { type: 'object', properties: {} } }
      ];
      let agentOptions = createAgentOptions({ functions: functions1 });
      const { rerender } = render(
        <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const firstSettings = capturedSettings[0];
      verifySettingsHasFunctions(firstSettings, 1);
      expect(firstSettings.agent.think.functions[0].name).toBe('function1');

      capturedSettings.length = 0;
      const functions2: AgentFunction[] = [
        { name: 'function2', description: 'Second function', parameters: { type: 'object', properties: {} } }
      ];
      agentOptions = createAgentOptions({ functions: functions2 });
      await act(async () => {
        rerender(
          <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
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

    it('should not re-send Settings when agentOptions gains functions after connection (Issue #399)', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      let agentOptions = createAgentOptions({ functions: undefined });
      const { rerender } = render(
        <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      const firstSettings = capturedSettings[0];
      expect(firstSettings.agent?.think?.functions).toBeUndefined();

      capturedSettings.length = 0;
      const functions: AgentFunction[] = [
        {
          name: 'search_products',
          description: 'Search for products',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Search query' } },
            required: ['query']
          }
        }
      ];
      agentOptions = createAgentOptions({ functions });
      await act(async () => {
        rerender(
          <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
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
  });

  describe('Multiple agentOptions updates', () => {
    it('should send Settings only once despite multiple agentOptions updates (Issue #399)', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const functions1: AgentFunction[] = [
        { name: 'func1', description: 'Function 1', parameters: { type: 'object', properties: {} } }
      ];
      let agentOptions = createAgentOptions({ functions: functions1 });
      const { rerender } = render(
        <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
      );

      await setupComponentAndConnect(ref, mockWebSocketManager);
      expect(capturedSettings[0].agent.think.functions[0].name).toBe('func1');

      capturedSettings.length = 0;
      agentOptions = createAgentOptions({
        functions: [{ name: 'func2', description: 'Function 2', parameters: { type: 'object', properties: {} } }]
      });
      await act(async () => {
        rerender(
          <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 400));
      });
      capturedSettings.length = 0;
      agentOptions = createAgentOptions({
        functions: [{ name: 'func3', description: 'Function 3', parameters: { type: 'object', properties: {} } }]
      });
      await act(async () => {
        rerender(
          <DeepgramVoiceInteraction ref={ref} apiKey={MOCK_API_KEY} agentOptions={agentOptions} />
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
  });
});

