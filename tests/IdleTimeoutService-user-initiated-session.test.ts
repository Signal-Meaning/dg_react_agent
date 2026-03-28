/**
 * @jest-environment jsdom
 *
 * Issue #544: Idle disconnect is gated on hasSeenUserActivityThisSession until user/session
 * initiation (e.g. MEANINGFUL_USER_ACTIVITY UserInitiatedAgentStart from test-app start()).
 */

import { IdleTimeoutService } from '../src/utils/IdleTimeoutService';

describe('IdleTimeoutService user-initiated session (Issue #544)', () => {
  it('does not start idle countdown when agent is idle until meaningful session activity', () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    svc.onTimeout(onTimeout);
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    svc.updateStateDirectly({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    });

    expect(svc.isTimeoutActive()).toBe(false);

    svc.handleEvent({
      type: 'MEANINGFUL_USER_ACTIVITY',
      activity: 'UserInitiatedAgentStart',
    });

    svc.updateStateDirectly({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    });

    expect(svc.isTimeoutActive()).toBe(true);
    jest.advanceTimersByTime(5001);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
    svc.destroy();
  });
});
