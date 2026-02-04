/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent Options useEffect Must Run Test - Issue #318, Issue #399
 * 
 * Issue #399: Settings are sent only once per connection. We do NOT re-send when
 * agentOptions changes. These tests now assert that Settings is not re-sent after
 * agentOptions change (connection stays open; no SETTINGS_ALREADY_APPLIED).
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

describe('Agent Options useEffect Must Run - Issue #318', () => {
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

  test('should NOT re-send Settings when useMemo creates new reference (Issue #399)', async () => {
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
        name: 'test_function',
        description: 'Test function',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Test query' } },
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

  test('should NOT re-send Settings with customer useMemo pattern (Issue #399)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
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
    await setupComponentAndConnect(ref, mockWebSocketManager);
    clearCapturedSettings(capturedSettings);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Issue #399: Settings sent only once per connection — no re-send when useMemo updates
    expect(capturedSettings.length).toBe(0);
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
  });

  test('should NOT re-send Settings even without diagnostic logging (Issue #399)', async () => {
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

  test('should NOT re-send Settings when props.agentOptions changes (Issue #399)', async () => {
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
