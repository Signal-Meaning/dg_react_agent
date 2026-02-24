/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * onContextWarning Callback Tests (Issue #480)
 *
 * When the component sends Settings on a reconnection and agentOptions.context
 * is missing or has no messages, it calls onContextWarning so the app can warn or log.
 * These tests validate that behavior.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import {
  createMockWebSocketManager,
  createMockAudioManager,
  createMockAgentOptions,
} from './fixtures/mocks';
import {
  resetTestState,
  setupComponentAndConnect,
  simulateConnection,
  simulateConnectionClose,
  waitForSettingsSent,
  MOCK_API_KEY,
  waitFor,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('onContextWarning Callback Tests (Issue #480)', () => {
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

  it('should call onContextWarning when reconnecting without context (no agentOptions.context.messages)', async () => {
    const onContextWarning = jest.fn();
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const agentOptions = createMockAgentOptions(); // no context

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
        onContextWarning={onContextWarning}
      />
    );

    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);

    expect(onContextWarning).not.toHaveBeenCalled();

    await simulateConnectionClose(eventListener);

    mockWebSocketManager.sendJSON.mockClear();
    await simulateConnection(eventListener, mockWebSocketManager, {
      isReconnection: true,
    });
    await waitForSettingsSent(mockWebSocketManager);

    await waitFor(() => {
      expect(onContextWarning).toHaveBeenCalledTimes(1);
    });
  });

  it('should NOT call onContextWarning on first connection without context', async () => {
    const onContextWarning = jest.fn();
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onContextWarning={onContextWarning}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);

    expect(onContextWarning).not.toHaveBeenCalled();
  });

  it('should NOT call onContextWarning when reconnecting with context (agentOptions.context.messages.length > 0)', async () => {
    const onContextWarning = jest.fn();
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const agentOptions = {
      ...createMockAgentOptions(),
      context: {
        messages: [
          { type: 'History', role: 'user' as const, content: 'Hello' },
          { type: 'History', role: 'assistant' as const, content: 'Hi there' },
        ],
      },
    };

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
        onContextWarning={onContextWarning}
      />
    );

    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);

    await simulateConnectionClose(eventListener);

    mockWebSocketManager.sendJSON.mockClear();
    await simulateConnection(eventListener, mockWebSocketManager, {
      isReconnection: true,
    });
    await waitForSettingsSent(mockWebSocketManager);

    expect(onContextWarning).not.toHaveBeenCalled();
  });

  it('should NOT call onContextWarning when callback is not provided', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
      />
    );

    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
    await simulateConnectionClose(eventListener);

    mockWebSocketManager.sendJSON.mockClear();
    await simulateConnection(eventListener, mockWebSocketManager, {
      isReconnection: true,
    });
    await waitForSettingsSent(mockWebSocketManager);

    const sendJSONCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: any[]) => call[0]?.type === 'Settings'
    );
    expect(sendJSONCalls.length).toBeGreaterThanOrEqual(1);
  });
});
