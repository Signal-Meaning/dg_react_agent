/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #487 (voice-commerce #1058): Idle timeout must NOT fire while waiting for
 * next agent message after the app has sent a function result.
 *
 * This integration test validates the fix at the **component** level: we inject
 * a FunctionCallRequest, the app sends FunctionCallResponse, then we wait less than
 * idle_timeout with no further messages. The connection must still be open (close()
 * must not be called). Unit tests in unified-timeout-coordination.test.js cover
 * IdleTimeoutService in isolation; this test ensures the component wires events
 * correctly so the scenario is satisfied end-to-end in the test environment.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, AgentFunction } from '../../src/types';
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
const WAIT_MS = IDLE_TIMEOUT_MS - 500; // Just under idle timeout

describe('Issue #487: Idle timeout after function result (component integration)', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTestState();

    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should NOT close connection on idle timeout within window after app sends function result', async () => {
    const functions: AgentFunction[] = [
      {
        name: 'create_mandate',
        description: 'Create mandate',
        parameters: { type: 'object', properties: {} },
      },
    ];
    const agentOptions = createAgentOptions({
      functions,
      idleTimeoutMs: IDLE_TIMEOUT_MS,
    });
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
        onFunctionCallRequest={(functionCall, sendResponse) => {
          sendResponse({ id: functionCall.id, result: { ok: true } });
        }}
      />
    );

    await setupComponentAndConnect(ref, mockWebSocketManager);
    const eventListener = await waitForEventListener(mockWebSocketManager);

    // Inject FunctionCallRequest (model sent e.g. create_mandate)
    const functionCallRequest = {
      type: 'FunctionCallRequest',
      functions: [
        {
          id: 'fc-1',
          name: 'create_mandate',
          arguments: '{}',
          client_side: true,
        },
      ],
    };

    act(() => {
      eventListener?.({ type: 'message', data: functionCallRequest });
    });

    // Allow handler to run and send FunctionCallResponse (synchronous in this test)
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWebSocketManager.close).not.toHaveBeenCalled();

    // Wait just under idle timeout with no further messages (model has not sent next message yet)
    act(() => {
      jest.advanceTimersByTime(WAIT_MS);
    });

    // Connection must still be open: component must NOT have closed due to idle timeout
    expect(mockWebSocketManager.close).not.toHaveBeenCalled();
  });
});
