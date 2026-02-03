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
 *
 * Issue #388: Adds a "closing on first send" mock and tests for agent reply
 * after inject (see docs/issues/ISSUE-388/RESOLUTION-PLAN.md).
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

/**
 * Issue #388: WebSocketManager mock that simulates upstream closing after the first
 * sendJSON call (e.g. OpenAI closing with code 1000 after first message).
 * The component registers an event listener via addEventListener; on first sendJSON
 * we invoke that listener with { type: 'state', state: 'closed' }.
 */
function createClosingWebSocketManagerMock(): ReturnType<typeof createMockWebSocketManager> {
  const base = createMockWebSocketManager();
  let stateListener: ((event: { type: string; state?: string }) => void) | null = null;
  let sendCount = 0;

  base.addEventListener = jest.fn((listener: (event: unknown) => void) => {
    stateListener = listener as (event: { type: string; state?: string }) => void;
    return jest.fn();
  });

  base.sendJSON = jest.fn((...args: unknown[]) => {
    sendCount += 1;
    if (sendCount === 1 && stateListener) {
      stateListener({ type: 'state', state: 'closed' });
    }
  });

  return base;
}

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

describe('Issue #388: upstream close and agent reply after inject', () => {
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioManager = createMockAudioManager();
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  it('reports onConnectionStateChange(agent, closed) when mock closes after first send', async () => {
    const mockWebSocketManager = createClosingWebSocketManagerMock();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);

    const ref = React.createRef<any>();
    const onConnectionStateChange = jest.fn();
    const onUserMessage = jest.fn();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onUserMessage={onUserMessage}
        onConnectionStateChange={onConnectionStateChange}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await setupComponentAndConnect(ref, mockWebSocketManager, { agent: true });

    await act(async () => {
      await ref.current.injectUserMessage('hi');
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith('agent', 'closed');
    expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
  });

  it('does NOT call onAgentUtterance when upstream closes after first send', async () => {
    const mockWebSocketManager = createClosingWebSocketManagerMock();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);

    const ref = React.createRef<any>();
    const onAgentUtterance = jest.fn();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onAgentUtterance={onAgentUtterance}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await setupComponentAndConnect(ref, mockWebSocketManager, { agent: true });

    await act(async () => {
      await ref.current.injectUserMessage('hi');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(onAgentUtterance).not.toHaveBeenCalled();
  });

  it('calls onAgentUtterance after injectUserMessage when connection stays open (simulated reply)', async () => {
    const mockWebSocketManager = createMockWebSocketManager();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);

    const ref = React.createRef<any>();
    const onAgentUtterance = jest.fn();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onAgentUtterance={onAgentUtterance}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager, { agent: true });

    await act(async () => {
      await ref.current.injectUserMessage('hi');
    });

    expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();

    await act(async () => {
      eventListener?.({
        type: 'message',
        data: {
          type: 'ConversationText',
          role: 'assistant',
          content: 'Hello! How can I help?',
        },
      });
    });

    expect(onAgentUtterance).toHaveBeenCalledTimes(1);
    expect(onAgentUtterance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'llm',
        text: 'Hello! How can I help?',
      })
    );
  });

  it.skip('receives agent reply (onAgentUtterance) within 10s after injectUserMessage when connection stays open (fails with closing mock)', async () => {
    // Issue #388: Encodes desired product behavior. With the closing mock, upstream
    // closes after first send so no agent reply is ever delivered; this test would fail.
    // Un-skip when upstream (or proxy) keeps the connection open and delivers a reply.
    const mockWebSocketManager = createClosingWebSocketManagerMock();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);

    const onAgentUtterance = jest.fn();
    const ref = React.createRef<any>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onAgentUtterance={onAgentUtterance}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await setupComponentAndConnect(ref, mockWebSocketManager, { agent: true });

    await act(async () => {
      await ref.current.injectUserMessage('hi');
    });

    const timeoutMs = 10000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });
      if (onAgentUtterance.mock.calls.length > 0) return;
    }

    expect(onAgentUtterance).toHaveBeenCalled();
  }, 15000);
});
