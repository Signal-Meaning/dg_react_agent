/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #429: OpenAI proxy path — expose agentManagerRef / disableIdleTimeoutResets (handle API parity)
 *
 * Ensures the ref handle exposes getAgentManager() so apps can call
 * disableIdleTimeoutResets / enableIdleTimeoutResets on the agent manager
 * for idle-timeout coordination (e.g. during "thinking" activity).
 * Same handle shape for both Deepgram and OpenAI proxy paths.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAgentOptions, MOCK_API_KEY } from './fixtures/mocks';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const WebSocketManager = require('../src/utils/websocket/WebSocketManager').WebSocketManager;
const AudioManager = require('../src/utils/audio/AudioManager').AudioManager;

describe('Issue #429: getAgentManager and idle-timeout methods on handle', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: {
    initialize: jest.Mock;
    startRecording: jest.Mock;
    stopRecording: jest.Mock;
    getAudioContext: jest.Mock;
    [key: string]: unknown;
  };

  beforeEach(() => {
    mockWebSocketManager = {
      ...createMockWebSocketManager(),
      connect: jest.fn().mockResolvedValue(undefined),
      disableIdleTimeoutResets: jest.fn(),
      enableIdleTimeoutResets: jest.fn(),
    };
    WebSocketManager.mockImplementation(() => mockWebSocketManager);

    mockAudioManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn(),
      getAudioContext: jest.fn().mockReturnValue({ state: 'running', suspend: jest.fn(), resume: jest.fn() }),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
    };
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  it('ref exposes getAgentManager() that returns null before start', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    expect(typeof ref.current!.getAgentManager).toBe('function');
    const managerBeforeStart = ref.current!.getAgentManager();
    expect(managerBeforeStart).toBeNull();
  });

  it('getAgentManager() returns manager with disableIdleTimeoutResets and enableIdleTimeoutResets after start', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await act(async () => {
      await ref.current!.start({ agent: true });
    });

    const manager = ref.current!.getAgentManager();
    expect(manager).not.toBeNull();
    expect(typeof (manager as { disableIdleTimeoutResets: () => void }).disableIdleTimeoutResets).toBe('function');
    expect(typeof (manager as { enableIdleTimeoutResets: () => void }).enableIdleTimeoutResets).toBe('function');
  });

  it('disableIdleTimeoutResets and enableIdleTimeoutResets on returned manager do not throw', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    await act(async () => {
      await ref.current!.start({ agent: true });
    });

    const manager = ref.current!.getAgentManager();
    expect(manager).not.toBeNull();

    expect(() => (manager as { disableIdleTimeoutResets: () => void }).disableIdleTimeoutResets()).not.toThrow();
    expect(() => (manager as { enableIdleTimeoutResets: () => void }).enableIdleTimeoutResets()).not.toThrow();
  });
});
