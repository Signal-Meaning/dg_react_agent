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

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
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
});
