/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Reconnect Settings context isolation (E2E test 9 / Issue #489)
 *
 * E2E test 9 fails with "Settings on reconnect did not include context". This unit test
 * narrows the defect: if the COMPONENT sends context when agentOptions are updated to
 * include context before reconnect, the bug is in the test-app (not passing context).
 * If this test FAILS (second Settings has no context), the bug is in the component
 * (stale agentOptionsRef or wrong code path on reconnect).
 */

import React, { useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import {
  createMockWebSocketManager,
  createMockAudioManager,
  createMockAgentOptions,
  MOCK_API_KEY,
} from './fixtures/mocks';
import {
  resetTestState,
  setupComponentAndConnect,
  simulateConnectionClose,
  simulateConnection,
  waitForSettingsSent,
} from './utils/component-test-helpers';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

const baseOptions = {
  ...createMockAgentOptions(),
  language: 'en' as const,
  listenModel: 'nova-2',
  thinkProviderType: 'open_ai' as const,
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.',
};

const optionsWithoutContext = { ...baseOptions, context: undefined };

const optionsWithContext = {
  ...baseOptions,
  context: {
    messages: [
      { type: 'History' as const, role: 'user' as const, content: 'What is the capital of France?' },
      { type: 'History' as const, role: 'assistant' as const, content: 'Paris.' },
    ],
  },
};

describe('Reconnect Settings context isolation (test 9)', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  const STORAGE_KEY = 'dg_voice_conversation';

  /** Valid conversation for localStorage (component expects role + content). */
  const storedConversation = [
    { role: 'user' as const, content: 'Stored user message.' },
    { role: 'assistant' as const, content: 'Stored assistant reply.' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('dg_conversation');
    }
    (window as unknown as { __e2eRestoredAgentContext?: unknown }).__e2eRestoredAgentContext = undefined;
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  it('sends Settings with agent.context on reconnect when agentOptions updated to include context before reconnect', async () => {
    const settingsSent: Array<{ type: string; agent?: { context?: unknown } }> = [];
    mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
      const m = msg as { type: string; agent?: { context?: unknown } };
      if (m?.type === 'Settings') {
        settingsSent.push({ type: m.type, agent: m.agent ? { context: m.agent.context } : undefined });
      }
    });

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const setOptionsWithContextRef = { current: null as (() => void) | null };
    const Wrapper = () => {
      const [agentOptions, setAgentOptions] = useState<typeof optionsWithoutContext>(optionsWithoutContext);
      setOptionsWithContextRef.current = () => setAgentOptions(optionsWithContext as typeof optionsWithoutContext);
      return (
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );
    };

    render(<Wrapper />);
    await waitFor(() => expect(ref.current).toBeTruthy());

    // 1) First connection with no context -> first Settings (no context)
    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
    expect(settingsSent.length).toBeGreaterThanOrEqual(1);
    expect(settingsSent[0].agent?.context).toBeFalsy();

    // 2) Simulate disconnect (resets hasSentSettingsRef so next connect sends Settings again)
    await simulateConnectionClose(eventListener);

    // 3) Update agentOptions to include context (simulates app updating conversationForDisplay before reconnect)
    await act(async () => {
      setOptionsWithContextRef.current?.();
    });

    // 4) Reconnect -> component should send second Settings WITH context (from agentOptionsRef.current)
    await simulateConnection(eventListener, mockWebSocketManager);
    await waitFor(
      () => expect(settingsSent.length).toBeGreaterThanOrEqual(2),
      { timeout: 3000 }
    );

    const secondSettings = settingsSent[settingsSent.length - 1];
    expect(secondSettings.agent?.context).toBeDefined();
    const ctx = secondSettings.agent?.context as { messages?: unknown[] } | undefined;
    expect(ctx?.messages).toBeDefined();
    expect(Array.isArray(ctx?.messages) && ctx.messages.length).toBeGreaterThan(0);
  });

  /**
   * Exposes defect: when refs are empty (e.g. first connection or after remount), the component
   * must still send Settings with agent.context from localStorage so session can be retained.
   * If getHistoryForSettings → getItem is not used or storageKeys are wrong, this fails.
   */
  it('sends Settings with agent.context from localStorage when refs are empty on first connection', async () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedConversation));

    const settingsSent: Array<{ type: string; agent?: { context?: unknown } }> = [];
    mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
      const m = msg as { type: string; agent?: { context?: unknown } };
      if (m?.type === 'Settings') {
        settingsSent.push({ type: m.type, agent: m.agent ? { context: m.agent.context } : undefined });
      }
    });

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={optionsWithoutContext}
      />
    );
    await waitFor(() => expect(ref.current).toBeTruthy());

    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
    expect(settingsSent.length).toBeGreaterThanOrEqual(1);
    const firstSettings = settingsSent[0];
    expect(firstSettings.agent?.context).toBeDefined();
    const ctx = firstSettings.agent?.context as { messages?: Array<{ role: string; content: string }> } | undefined;
    expect(ctx?.messages).toBeDefined();
    expect(Array.isArray(ctx?.messages) && ctx.messages.length).toBe(2);
    expect(ctx?.messages?.[0].role).toBe('user');
    expect(ctx?.messages?.[0].content).toBe('Stored user message.');
  });

  /**
   * Exposes defect: when getAgentOptions returns options with no/empty context, the component
   * must still send context from getContextForSend (e.g. window fallback). If the component
   * used only getAgentOptions().context, it would send empty; it must use effectiveContext.
   */
  it('sends Settings with agent.context from window fallback when getAgentOptions returns empty context', async () => {
    // Clear storage so context comes only from window (previous test may have left data; connection-handler preload would otherwise use it).
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('dg_conversation');
    }
    const e2eContext = {
      messages: [
        { type: 'History' as const, role: 'user' as const, content: 'E2E restored user.' },
        { type: 'History' as const, role: 'assistant' as const, content: 'E2E restored assistant.' },
      ],
    };
    (window as unknown as { __e2eRestoredAgentContext: typeof e2eContext }).__e2eRestoredAgentContext = e2eContext;

    const settingsSent: Array<{ type: string; agent?: { context?: unknown } }> = [];
    mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
      const m = msg as { type: string; agent?: { context?: unknown } };
      if (m?.type === 'Settings') {
        settingsSent.push({ type: m.type, agent: m.agent ? { context: m.agent.context } : undefined });
      }
    });

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const optionsWithEmptyContext = { ...baseOptions, context: { messages: [] } };
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={optionsWithEmptyContext}
        getAgentOptions={() => optionsWithEmptyContext}
      />
    );
    await waitFor(() => expect(ref.current).toBeTruthy());

    await setupComponentAndConnect(ref, mockWebSocketManager);
    expect(settingsSent.length).toBeGreaterThanOrEqual(1);
    const firstSettings = settingsSent[0];
    expect(firstSettings.agent?.context).toBeDefined();
    const ctx = firstSettings.agent?.context as { messages?: Array<{ role: string; content: string }> } | undefined;
    expect(Array.isArray(ctx?.messages) && ctx.messages.length).toBe(2);
    expect(ctx?.messages?.[0].content).toBe('E2E restored user.');
  });

  /**
   * Exposes defect: when refs and getAgentOptions are empty, the component must still send
   * Settings with agent.context from window.__e2eRestoredAgentContext (E2E fallback).
   * If the hook fallback is not used in the component path or result is dropped, this fails.
   */
  it('sends Settings with agent.context from window.__e2eRestoredAgentContext when refs and storage are empty', async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('dg_conversation');
    }
    const e2eContext = {
      messages: [
        { type: 'History' as const, role: 'user' as const, content: 'E2E restored user.' },
        { type: 'History' as const, role: 'assistant' as const, content: 'E2E restored assistant.' },
      ],
    };
    (window as unknown as { __e2eRestoredAgentContext: typeof e2eContext }).__e2eRestoredAgentContext = e2eContext;

    const settingsSent: Array<{ type: string; agent?: { context?: unknown } }> = [];
    mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
      const m = msg as { type: string; agent?: { context?: unknown } };
      if (m?.type === 'Settings') {
        settingsSent.push({ type: m.type, agent: m.agent ? { context: m.agent.context } : undefined });
      }
    });

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={optionsWithoutContext}
      />
    );
    await waitFor(() => expect(ref.current).toBeTruthy());

    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
    expect(settingsSent.length).toBeGreaterThanOrEqual(1);
    const firstSettings = settingsSent[0];
    expect(firstSettings.agent?.context).toBeDefined();
    const ctx = firstSettings.agent?.context as { messages?: Array<{ role: string; content: string }> } | undefined;
    expect(ctx?.messages).toBeDefined();
    expect(Array.isArray(ctx?.messages) && ctx.messages.length).toBe(2);
    expect(ctx?.messages?.[0].content).toBe('E2E restored user.');
  });
});
