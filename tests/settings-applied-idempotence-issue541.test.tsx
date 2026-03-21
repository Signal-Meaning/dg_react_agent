/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #541: Duplicate SettingsApplied must not double-send queued InjectUserMessage.
 * Multiple upstream session.updated → multiple SettingsApplied is valid; drain queue once.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, createMockAgentOptions } from './fixtures/mocks';
import {
  resetTestState,
  setupConnectWithoutReceivingSettingsApplied,
  simulateSettingsApplied,
  MOCK_API_KEY,
  waitFor,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

function injectCalls(mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>): unknown[] {
  return (mockWebSocketManager.sendJSON.mock.calls || []).filter((call) => {
    const arg = call[0];
    const obj = typeof arg === 'string' ? JSON.parse(arg) : arg;
    return obj && obj.type === 'InjectUserMessage';
  });
}

describe('Issue #541: SettingsApplied idempotence (inject queue)', () => {
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

  it('second SettingsApplied does not send InjectUserMessage again (queue drained once)', async () => {
    const onSettingsApplied = jest.fn();
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
        onSettingsApplied={onSettingsApplied}
      />
    );

    const eventListener = await setupConnectWithoutReceivingSettingsApplied(ref, mockWebSocketManager);

    await act(async () => {
      await ref.current?.injectUserMessage('hello once');
    });

    await act(async () => {
      await simulateSettingsApplied(eventListener);
    });

    await waitFor(() => {
      expect(injectCalls(mockWebSocketManager).length).toBe(1);
      expect(onSettingsApplied).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await simulateSettingsApplied(eventListener);
    });

    await waitFor(() => {
      expect(onSettingsApplied).toHaveBeenCalledTimes(2);
    });

    expect(injectCalls(mockWebSocketManager).length).toBe(1);
  });
});
