/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #489: Idle timeout should start after greeting completes (AgentAudioDone).
 *
 * Component integration test: connect → user activity → AgentStartedSpeaking →
 * AgentAudioDone → advance timers → assert close() called.
 * Isolates the full path so failures show in CI instead of only in E2E.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../../src/types';
import { createMockWebSocketManager, createMockAudioManager } from '../fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  waitForEventListener,
  MOCK_API_KEY,
} from '../utils/component-test-helpers';
import DeepgramVoiceInteraction from '../../src/components/DeepgramVoiceInteraction';

jest.mock('../../src/utils/websocket/WebSocketManager');
jest.mock('../../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../../src/utils/audio/AudioManager');

const IDLE_TIMEOUT_MS = 10000;
const TIMEOUT_BUFFER_MS = 500;

describe('Issue #489: Greeting idle timeout (component integration)', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager> & {
    _constructorOptions?: { onMeaningfulActivity?: (activity: string) => void };
  };
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTestState();

    mockWebSocketManager = createMockWebSocketManager() as ReturnType<typeof createMockWebSocketManager> & {
      _constructorOptions?: { onMeaningfulActivity?: (activity: string) => void };
    };
    mockAudioManager = createMockAudioManager();
    WebSocketManager.mockImplementation((options: any) => {
      mockWebSocketManager._constructorOptions = options;
      return mockWebSocketManager;
    });
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should close connection after AgentAudioDone when user activity occurred (greeting idle timeout)', async () => {
    const agentOptions = createAgentOptions({ idleTimeoutMs: IDLE_TIMEOUT_MS });
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    const eventListener = await waitForEventListener(mockWebSocketManager);

    // 1. Simulate meaningful user activity so IdleTimeoutService allows timeout to start
    act(() => {
      mockWebSocketManager._constructorOptions?.onMeaningfulActivity?.('test');
    });

    // 2. Simulate greeting: agent started speaking, then done (proxy sends AgentAudioDone after first ConversationText)
    act(() => {
      eventListener?.({ type: 'message', data: { type: 'AgentStartedSpeaking' } });
    });
    act(() => {
      eventListener?.({ type: 'message', data: { type: 'AgentAudioDone' } });
    });

    // Allow state updates to flush (PLAYBACK_STATE_CHANGE, AGENT_STATE_CHANGE)
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWebSocketManager.close).not.toHaveBeenCalled();

    // 3. Advance past idle timeout; connection should close
    act(() => {
      jest.advanceTimersByTime(IDLE_TIMEOUT_MS + TIMEOUT_BUFFER_MS);
    });

    expect(mockWebSocketManager.close).toHaveBeenCalled();
  });
});
