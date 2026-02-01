/**
 * @jest-environment jsdom
 * @eslint-env jest
 *
 * Issue #380: OpenAI injectUserMessage – upstream closes after first message
 *
 * Reproduces the scenario where the upstream (e.g. OpenAI) WebSocket closes with
 * code 1000 shortly after the first injectUserMessage. The component should
 * notify the host via onConnectionStateChange('agent', 'closed').
 *
 * This test uses a mock WebSocketManager that does not close by itself; we
 * simulate the upstream close by firing a state event after the first message.
 * E2E tests (openai-inject-connection-stability.spec.js) assert agent response
 * with real APIs.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';
import {
  createMockWebSocketManager,
  createMockAudioManager,
  createMockAgentOptions,
  MOCK_API_KEY,
} from './fixtures/mocks';
import { setupComponentAndConnect } from './utils/component-test-helpers';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const WebSocketManager = require('../src/utils/websocket/WebSocketManager').WebSocketManager;
const AudioManager = require('../src/utils/audio/AudioManager').AudioManager;

describe('Issue #380: injectUserMessage upstream close', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  it('notifies onConnectionStateChange(agent, closed) when upstream closes after first injectUserMessage', async () => {
    const ref = React.createRef<any>();
    const onConnectionStateChange = jest.fn();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onConnectionStateChange={onConnectionStateChange}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await setupComponentAndConnect(ref, mockWebSocketManager, { agent: true });

    await act(async () => {
      await ref.current.injectUserMessage('hi');
    });

    expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();

    const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function'
    )?.[0] as (event: { type: string; state?: string }) => void;

    expect(eventListener).toBeDefined();

    await act(async () => {
      eventListener({ type: 'state', state: 'closed' });
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith('agent', 'closed');
  });
});
