/**
 * @jest-environment jsdom
 * @eslint-env jest
 *
 * AgentAudioDone / AgentDone are receipt-complete on the wire, not local playback complete.
 * Premature receipt while AudioManager still reports active playback must not arm idle timeout
 * or close the connection until playback actually finishes.
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

describe('Agent receipt (AgentAudioDone) vs playback — idle timeout', () => {
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

  it('does not close on idle when AgentAudioDone arrives while isPlaybackActive() is still true; closes after playback ends', async () => {
    mockAudioManager.isPlaybackActive.mockReturnValue(true);

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

    act(() => {
      mockWebSocketManager._constructorOptions?.onMeaningfulActivity?.('test');
    });

    // Ensure AudioManager exists (same as OpenAI proxy binary PCM path). handleAgentAudio is async and not awaited by the WS handler — flush microtasks before receipt events.
    await act(async () => {
      eventListener?.({ type: 'binary', data: new ArrayBuffer(64) });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(AudioManager).toHaveBeenCalled();

    act(() => {
      eventListener?.({ type: 'message', data: { type: 'AgentStartedSpeaking' } });
    });
    act(() => {
      eventListener?.({ type: 'message', data: { type: 'AgentAudioDone' } });
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Component must consult AudioManager before treating wire receipt as playback-complete
    expect(mockAudioManager.isPlaybackActive).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(IDLE_TIMEOUT_MS + TIMEOUT_BUFFER_MS);
    });

    expect(mockWebSocketManager.close).not.toHaveBeenCalled();

    const audioListener = mockAudioManager.addEventListener.mock.calls[0]?.[0] as
      | ((e: { type: string; isPlaying?: boolean }) => void)
      | undefined;
    expect(audioListener).toBeDefined();

    mockAudioManager.isPlaybackActive.mockReturnValue(false);

    await act(async () => {
      audioListener!({ type: 'playing', isPlaying: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(IDLE_TIMEOUT_MS + TIMEOUT_BUFFER_MS);
    });

    expect(mockWebSocketManager.close).toHaveBeenCalled();
  });
});
