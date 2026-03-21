/**
 * @jest-environment jsdom
 *
 * TDD: useIdleTimeoutManager drives IdleTimeoutService only via applyCommittedInteractionState
 * from useLayoutEffect after committed interaction fields change.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { IdleTimeoutService } from '../../src/utils/IdleTimeoutService';
import { useIdleTimeoutManager } from '../../src/hooks/useIdleTimeoutManager';
import type { VoiceInteractionState } from '../../src/utils/state/VoiceInteractionState';
import { WebSocketManager } from '../../src/utils/websocket/WebSocketManager';

jest.mock('../../src/utils/websocket/WebSocketManager');

const baseState = (): VoiceInteractionState =>
  ({
    isUserSpeaking: false,
    agentState: 'idle',
    isPlaying: false,
  }) as VoiceInteractionState;

describe('useIdleTimeoutManager post-commit sync', () => {
  let applySpy: jest.SpyInstance;

  beforeEach(() => {
    applySpy = jest.spyOn(IdleTimeoutService.prototype, 'applyCommittedInteractionState');
  });

  afterEach(() => {
    applySpy.mockRestore();
  });

  it('calls applyCommittedInteractionState once per committed change to interaction fields', () => {
    const mockWs = {} as unknown as WebSocketManager;
    const ref = { current: mockWs };

    const { rerender } = renderHook(
      ({ s }: { s: VoiceInteractionState }) => useIdleTimeoutManager(s, ref, false),
      { initialProps: { s: baseState() } }
    );

    expect(applySpy).toHaveBeenCalledTimes(1);

    const s2 = { ...baseState(), agentState: 'speaking' } as VoiceInteractionState;
    act(() => {
      rerender({ s: s2 });
    });

    expect(applySpy).toHaveBeenCalledTimes(2);
    const lastCall = applySpy.mock.calls[1];
    expect(lastCall[0]).toMatchObject({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    });
    expect(lastCall[1]).toMatchObject({
      agentState: 'speaking',
      isPlaying: false,
      isUserSpeaking: false,
    });
  });
});
