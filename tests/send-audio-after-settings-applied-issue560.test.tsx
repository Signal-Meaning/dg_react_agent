/**
 * @jest-environment jsdom
 * @eslint-env jest
 *
 * Issue #560: After SettingsApplied / session.created, user PCM must not be blocked by the
 * 500ms post-Settings send delay (settingsSentTimeRef is only for the pre-confirmation window).
 */

import React from 'react';
import { render } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import {
  createMockWebSocketManager,
  createMockAudioManager,
  createMockAgentOptions,
  MOCK_API_KEY,
} from './fixtures/mocks';
import { resetTestState, setupComponentAndConnect } from './utils/component-test-helpers';
import { act } from '@testing-library/react';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('sendAudioData after settings confirmed (Issue #560)', () => {
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

  it('forwards binary audio immediately after SettingsApplied (no 500ms wait)', async () => {
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={createMockAgentOptions()}
      />
    );

    // Agent socket only: same mock backs agent + listen managers; transcription:false avoids a false-positive sendBinary from the listen path.
    await setupComponentAndConnect(ref, mockWebSocketManager, { agent: true, transcription: false });

    mockWebSocketManager.sendBinary.mockClear();

    await act(async () => {
      ref.current!.sendAudioData(new ArrayBuffer(64));
    });

    expect(mockWebSocketManager.sendBinary).toHaveBeenCalled();
  });
});
