/**
 * @jest-environment jsdom
 *
 * Issue #559: idle "Started" line at debug + debounce identical logs within configured ms bursts.
 */

import {
  IdleTimeoutService,
  DEFAULT_IDLE_TIMEOUT_START_LOG_DEBOUNCE_MS,
  IDLE_TIMEOUT_STARTED_LOG_MARKER,
} from '../src/utils/IdleTimeoutService';

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

function startedIdleDebugCalls(): unknown[][] {
  return mockDebug.mock.calls.filter(
    (c) => typeof c[0] === 'string' && (c[0] as string).includes(IDLE_TIMEOUT_STARTED_LOG_MARKER)
  );
}

/** Drive user-speak → user-stop so the idle countdown arms (same path as post-commit tests). */
function arrangeIdleCountdownArmed(svc: IdleTimeoutService): void {
  const idle = { agentState: 'idle' as const, isPlaying: false, isUserSpeaking: false };
  svc.applyCommittedInteractionState(idle, idle);
  svc.applyCommittedInteractionState(idle, { ...idle, isUserSpeaking: true });
  svc.applyCommittedInteractionState(
    { ...idle, isUserSpeaking: true },
    { ...idle, isUserSpeaking: false }
  );
  jest.advanceTimersByTime(0);
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

    arrangeIdleCountdownArmed(svc);

    expect(mockInfo.mock.calls.some((c) => String(c[0]).includes(IDLE_TIMEOUT_STARTED_LOG_MARKER))).toBe(
      false
    );
    expect(startedIdleDebugCalls().length).toBeGreaterThanOrEqual(1);

    jest.useRealTimers();
    svc.destroy();
  });

  it('debounces Started idle timeout debug logs within a burst shorter than idleTimeoutStartLogDebounceMs', () => {
    jest.useFakeTimers();
    const debounceMs = DEFAULT_IDLE_TIMEOUT_START_LOG_DEBOUNCE_MS;
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    arrangeIdleCountdownArmed(svc);
    jest.advanceTimersByTime(debounceMs + 10);

    mockDebug.mockClear();
    mockInfo.mockClear();

    for (let i = 0; i < 6; i++) {
      svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: `key-${i}` });
      jest.advanceTimersByTime(15);
    }

    expect(startedIdleDebugCalls().length).toBe(1);
    expect(mockInfo.mock.calls.some((c) => String(c[0]).includes(IDLE_TIMEOUT_STARTED_LOG_MARKER))).toBe(
      false
    );

    jest.useRealTimers();
    svc.destroy();
  });

  it('allows another Started idle timeout log after the debounce window', () => {
    jest.useFakeTimers();
    const debounceMs = DEFAULT_IDLE_TIMEOUT_START_LOG_DEBOUNCE_MS;
    const svc = new IdleTimeoutService({ timeoutMs: 5000, debug: false });
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    arrangeIdleCountdownArmed(svc);
    jest.advanceTimersByTime(debounceMs + 10);

    mockDebug.mockClear();
    mockInfo.mockClear();

    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'a' });
    jest.advanceTimersByTime(debounceMs + 20);
    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'b' });

    expect(startedIdleDebugCalls().length).toBe(2);

    jest.useRealTimers();
    svc.destroy();
  });

  it('respects idleTimeoutStartLogDebounceMs override', () => {
    jest.useFakeTimers();
    const customDebounce = 300;
    const svc = new IdleTimeoutService({
      timeoutMs: 5000,
      debug: false,
      idleTimeoutStartLogDebounceMs: customDebounce,
    });
    svc.setStateGetter(() => ({
      agentState: 'idle',
      isPlaying: false,
      isUserSpeaking: false,
    }));

    arrangeIdleCountdownArmed(svc);
    jest.advanceTimersByTime(customDebounce + 10);

    mockDebug.mockClear();

    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'a' });
    jest.advanceTimersByTime(200);
    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'b' });

    expect(startedIdleDebugCalls().length).toBe(1);

    jest.advanceTimersByTime(customDebounce);
    svc.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'c' });

    expect(startedIdleDebugCalls().length).toBe(2);

    jest.useRealTimers();
    svc.destroy();
  });
});
