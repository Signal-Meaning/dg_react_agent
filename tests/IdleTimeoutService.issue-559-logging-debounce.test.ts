/**
 * @jest-environment jsdom
 *
 * Issue #559: idle "Started" line at debug + debounce identical logs within 100ms bursts.
 */

import { IdleTimeoutService } from '../src/utils/IdleTimeoutService';

const mockDebug = jest.fn();
const mockInfo = jest.fn();

jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    debug: (...args: unknown[]) => mockDebug(...args),
    info: (...args: unknown[]) => mockInfo(...args),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      debug: (...args: unknown[]) => mockDebug(...args),
      info: (...args: unknown[]) => mockInfo(...args),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(),
    })),
  }),
}));

function startedIdleLogCalls(): unknown[][] {
  return mockDebug.mock.calls.filter(
    (c) => typeof c[0] === 'string' && (c[0] as string).includes('Started idle timeout')
  );
}

/** Count Started-idle lines whether emitted at info (legacy) or debug (#559). */
function startedIdleMessageCallCount(): number {
  const has = (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('Started idle timeout');
  return mockDebug.mock.calls.filter(has).length + mockInfo.mock.calls.filter(has).length;
}

describe('IdleTimeoutService issue #559 (logging + debounce)', () => {
  beforeEach(() => {
    mockDebug.mockClear();
    mockInfo.mockClear();
  });

  it('does not emit Started idle timeout at info (debug only)', () => {
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
    const speaking = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: true };
    svc.applyCommittedInteractionState(idle, speaking);
    const done = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(speaking, done);

    jest.advanceTimersByTime(0);

    expect(mockInfo.mock.calls.some((c) => String(c[0]).includes('Started idle timeout'))).toBe(false);
    expect(startedIdleLogCalls().length).toBeGreaterThanOrEqual(1);

    jest.useRealTimers();
    svc.destroy();
  });

  it('debounces Started idle timeout debug logs within a 100ms burst of resets', () => {
    jest.useFakeTimers();
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    const idle = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(idle, idle);
    svc.applyCommittedInteractionState(idle, { ...idle, isUserSpeaking: true });
    svc.applyCommittedInteractionState(
      { ...idle, isUserSpeaking: true },
      { ...idle, isUserSpeaking: false }
    );
    jest.advanceTimersByTime(0);
    // Clear debounce window from the initial countdown start (mockClear does not reset service fields).
    jest.advanceTimersByTime(110);

    mockDebug.mockClear();
    mockInfo.mockClear();

    for (let i = 0; i < 6; i++) {
      svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: `key-${i}` });
      jest.advanceTimersByTime(15);
    }

    expect(startedIdleMessageCallCount()).toBe(1);
    expect(mockInfo.mock.calls.some((c) => String(c[0]).includes('Started idle timeout'))).toBe(false);

    jest.useRealTimers();
    svc.destroy();
  });

  it('allows another Started idle timeout log after the debounce window', () => {
    jest.useFakeTimers();
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    const idle = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
    svc.applyCommittedInteractionState(idle, idle);
    svc.applyCommittedInteractionState(idle, { ...idle, isUserSpeaking: true });
    svc.applyCommittedInteractionState(
      { ...idle, isUserSpeaking: true },
      { ...idle, isUserSpeaking: false }
    );
    jest.advanceTimersByTime(0);
    jest.advanceTimersByTime(110);

    mockDebug.mockClear();
    mockInfo.mockClear();

    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'a' });
    jest.advanceTimersByTime(120);
    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'b' });

    expect(startedIdleMessageCallCount()).toBe(2);

    jest.useRealTimers();
    svc.destroy();
  });
});
