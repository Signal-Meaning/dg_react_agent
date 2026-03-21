/**
 * @jest-environment jsdom
 *
 * TDD: IdleTimeoutService.applyCommittedInteractionState — single post-commit entry point
 * for React interaction snapshot (user speaking, agent phase, playback). Parity with the
 * former hook sequence: merge snapshot then emit semantic transitions.
 */

import { IdleTimeoutService } from '../src/utils/IdleTimeoutService';

describe('IdleTimeoutService.applyCommittedInteractionState', () => {
  it('is defined (post-commit API exists)', () => {
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    expect(typeof svc.applyCommittedInteractionState).toBe('function');
    svc.destroy();
  });

  it('no-ops when prev and next are identical for the three fields', () => {
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    const snap = { agentState: 'idle', isPlaying: false, isUserSpeaking: false };
    const handleSpy = jest.spyOn(svc as unknown as { handleEvent: (e: unknown) => void }, 'handleEvent');
    svc.applyCommittedInteractionState(snap, snap);
    expect(handleSpy).not.toHaveBeenCalled();
    handleSpy.mockRestore();
    svc.destroy();
  });

  it('starts idle disconnect flow like UTTERANCE_END path: idle → user stops path via committed snapshot', () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const svc = new IdleTimeoutService({ timeoutMs: 10000, debug: false });
    svc.onTimeout(onTimeout);
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    const idle = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(idle, idle);

    const speakingUser = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: true };
    svc.applyCommittedInteractionState(idle, speakingUser);

    const userDone = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(speakingUser, userDone);

    expect(svc.isTimeoutActive()).toBe(true);
    jest.advanceTimersByTime(10001);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
    svc.destroy();
  });

  it('clears running idle countdown when committed snapshot moves to speaking (mid-turn protection)', () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const svc = new IdleTimeoutService({ timeoutMs: 10000, debug: false });
    svc.onTimeout(onTimeout);

    const idle = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(idle, idle);
    svc.handleEvent({ type: 'UTTERANCE_END' });
    expect(svc.isTimeoutActive()).toBe(true);

    const speaking = { agentState: 'speaking' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(
      { agentState: 'idle', isPlaying: false, isUserSpeaking: false },
      speaking
    );

    expect(svc.isTimeoutActive()).toBe(false);
    jest.advanceTimersByTime(10001);
    expect(onTimeout).not.toHaveBeenCalled();

    jest.useRealTimers();
    svc.destroy();
  });
});
