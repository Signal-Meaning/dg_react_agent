/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #433: No send until channel ready.
 * Tests that the component does not send user messages (text or audio) to the
 * backend until the channel has reported ready (SettingsApplied or session.created).
 */

import React from 'react';
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, createMockAgentOptions } from './fixtures/mocks';
import {
  resetTestState,
  setupConnectWithoutReceivingSettingsApplied,
  simulateSettingsApplied,
  MOCK_API_KEY,
  waitFor,
} from './utils/component-test-helpers';
import { act } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

function sentInjectUserMessageCalls(mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>): unknown[] {
  return (mockWebSocketManager.sendJSON.mock.calls || []).filter((call) => {
    const arg = call[0];
    const obj = typeof arg === 'string' ? JSON.parse(arg) : arg;
    return obj && obj.type === 'InjectUserMessage';
  });
}

describe('Issue #433: No send until channel ready', () => {
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

  describe('injectUserMessage before ready', () => {
    it('does not send InjectUserMessage until SettingsApplied (or session.created) has been received', async () => {
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

      const eventListener = await setupConnectWithoutReceivingSettingsApplied(ref, mockWebSocketManager);

      await act(async () => {
        ref.current?.injectUserMessage('hello');
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 7000));
      });

      expect(sentInjectUserMessageCalls(mockWebSocketManager).length).toBe(0);

      await act(async () => {
        await simulateSettingsApplied(eventListener);
      });

      await waitFor(
        () => {
          expect(sentInjectUserMessageCalls(mockWebSocketManager).length).toBe(1);
        },
        { timeout: 3000 }
      );
    }, 25000);
  });
});
