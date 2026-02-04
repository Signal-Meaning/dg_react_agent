/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #399: SETTINGS_ALREADY_APPLIED — connection closes after second Settings send
 *
 * TDD: Settings must be sent only once per connection. When agentOptions changes
 * after the first Settings has been sent (and optionally applied), we must NOT
 * send Settings again, to avoid the server responding with SETTINGS_ALREADY_APPLIED
 * and closing the connection.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  setupComponentAndConnect,
  createSettingsCapture,
  clearCapturedSettings,
  MOCK_API_KEY,
  type CapturedSettings,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Issue #399: Settings sent only once per connection', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedSettings: CapturedSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();

    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();

    capturedSettings = createSettingsCapture(mockWebSocketManager);

    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should not re-send Settings when agentOptions changes after connection (avoids SETTINGS_ALREADY_APPLIED)', async () => {
    // RED: This test defines the desired behavior. With current code we re-send
    // when agentOptions changes, causing SETTINGS_ALREADY_APPLIED and connection close.
    // We want: Settings sent only once per connection.

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();

    const initialOptions = createAgentOptions({ functions: undefined });
    const { rerender } = render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={initialOptions}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);

    const settingsCountAfterConnect = capturedSettings.length;
    expect(settingsCountAfterConnect).toBe(1);

    // Change agentOptions (new reference, different content: add functions)
    const updatedOptions = createAgentOptions({
      functions: [
        {
          name: 'test_function',
          description: 'Test',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    await act(async () => {
      rerender(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={updatedOptions}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Issue #399: Settings must be sent only once per connection. No second Settings.
    const settingsCalls = mockWebSocketManager.sendJSON.mock.calls.filter(
      (call: unknown[]) => call[0] && (call[0] as { type?: string }).type === 'Settings'
    );
    expect(settingsCalls.length).toBe(1);
    expect(capturedSettings.length).toBe(1);
  });
});
