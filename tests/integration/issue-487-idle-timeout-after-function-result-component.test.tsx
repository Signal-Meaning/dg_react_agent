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

type MockWsWithOptions = ReturnType<typeof createMockWebSocketManager> & {
  _constructorOptions?: { onMeaningfulActivity?: (activity: string) => void };
};

describe('Issue #487: Idle timeout after function result (component integration)', () => {
  let mockWebSocketManager: MockWsWithOptions;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTestState();

    mockWebSocketManager = createMockWebSocketManager() as MockWsWithOptions;
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

  /**
   * Idle is enabled when the agent is done for the turn. When muted, "done" is when text is displayed
   * (ConversationText assistant); we must not insist on audio. This test: after function result,
   * AgentThinking → ConversationText (assistant) with no AgentAudioDone should still allow transition
   * to idle so idle timeout can run.
   */
  it('should close connection after function result when ConversationText (assistant) received (do not insist on audio when muted)', async () => {
    const functions: AgentFunction[] = [
      {
        name: 'test_fn',
        description: 'Test',
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

    // 1. User activity so IdleTimeoutService allows timeout to start later
    act(() => {
      mockWebSocketManager._constructorOptions?.onMeaningfulActivity?.('test');
    });

    // 2. FunctionCallRequest → app sends FunctionCallResponse
    act(() => {
      eventListener?.({
        type: 'message',
        data: {
          type: 'FunctionCallRequest',
          functions: [{ id: 'fc-1', name: 'test_fn', arguments: '{}', client_side: true }],
        },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    // 3. AgentThinking (proxy sent after FunctionCallResponse) → component in "thinking"
    act(() => {
      eventListener?.({ type: 'message', data: { type: 'AgentThinking', content: '' } });
    });

    // 4. ConversationText (assistant) — no AgentAudioDone (text-only / API did not send response.done)
    act(() => {
      eventListener?.({
        type: 'message',
        data: { type: 'ConversationText', role: 'assistant', content: 'Done.' },
      });
    });

    // 5. Advance past text-only defer (200ms) so component transitions thinking → idle
    act(() => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWebSocketManager.close).not.toHaveBeenCalled();

    // 6. Advance past idle timeout; connection should close (component must not insist on AgentAudioDone)
    act(() => {
      jest.advanceTimersByTime(IDLE_TIMEOUT_MS + 500);
    });

    expect(mockWebSocketManager.close).toHaveBeenCalled();
  });
});
