/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Component VAD callbacks: UserStartedSpeaking and UtteranceEnd
 *
 * Phase 2 of COMPONENT-PROXY-INTERFACE-TDD (Issue #414).
 * Asserts that when the component receives the unified wire messages
 * (UserStartedSpeaking, UtteranceEnd with channel and last_word_end),
 * it calls onUserStartedSpeaking and onUtteranceEnd with the expected shape.
 * Any backend (Deepgram or OpenAI proxy) that sends these messages will
 * trigger the same callbacks.
 *
 * See: docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md §2.1, Phase 2.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, createMockAgentOptions } from './fixtures/mocks';
import {
  resetTestState,
  setupConnectAndReceiveSettingsApplied,
  MOCK_API_KEY,
  waitFor,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Component VAD callbacks (Issue #414 COMPONENT-PROXY-INTERFACE-TDD Phase 2)', () => {
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

  describe('UserStartedSpeaking', () => {
    it('calls onUserStartedSpeaking when component receives UserStartedSpeaking message', async () => {
      const onUserStartedSpeaking = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onUserStartedSpeaking={onUserStartedSpeaking}
        />
      );

      const eventListener = await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);
      expect(eventListener).toBeDefined();

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      });

      const userStartedMessage = { type: 'UserStartedSpeaking' };
      await act(async () => {
        eventListener!({ type: 'message', data: userStartedMessage });
      });

      await waitFor(() => {
        expect(onUserStartedSpeaking).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('UtteranceEnd', () => {
    it('calls onUtteranceEnd with channel and lastWordEnd when component receives UtteranceEnd message', async () => {
      const onUtteranceEnd = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onUtteranceEnd={onUtteranceEnd}
        />
      );

      const eventListener = await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);
      expect(eventListener).toBeDefined();

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      });

      // Wire shape from proxy (COMPONENT-PROXY-INTERFACE-TDD §2.1): last_word_end snake_case
      const utteranceEndMessage = { type: 'UtteranceEnd', channel: [0, 1], last_word_end: 0 };
      await act(async () => {
        eventListener!({ type: 'message', data: utteranceEndMessage });
      });

      await waitFor(() => {
        expect(onUtteranceEnd).toHaveBeenCalledTimes(1);
        expect(onUtteranceEnd).toHaveBeenCalledWith({ channel: [0, 1], lastWordEnd: 0 });
      });
    });

    it('calls onUtteranceEnd with defaults when UtteranceEnd message omits channel or last_word_end', async () => {
      const onUtteranceEnd = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onUtteranceEnd={onUtteranceEnd}
        />
      );

      const eventListener = await setupConnectAndReceiveSettingsApplied(ref, mockWebSocketManager);
      expect(eventListener).toBeDefined();

      await waitFor(() => {
        expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
      });

      // Minimal wire shape (component applies defaults per index.tsx)
      const utteranceEndMessage = { type: 'UtteranceEnd' };
      await act(async () => {
        eventListener!({ type: 'message', data: utteranceEndMessage });
      });

      await waitFor(() => {
        expect(onUtteranceEnd).toHaveBeenCalledTimes(1);
        expect(onUtteranceEnd).toHaveBeenCalledWith({ channel: [0, 1], lastWordEnd: 0 });
      });
    });
  });
});
