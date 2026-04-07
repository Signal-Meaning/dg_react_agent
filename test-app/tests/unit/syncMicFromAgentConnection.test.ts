/**
 * Issue #561 — agent disconnect clears mic-related UI state (policy helper).
 */

import { shouldClearMicOnAgentDisconnect } from '../../src/live-mode/syncMicFromAgentConnection';

describe('shouldClearMicOnAgentDisconnect (Issue #561)', () => {
  it.each([
    ['connecting', false],
    ['connected', false],
    ['closed', true],
    ['error', true],
  ] as const)('for %s returns %s', (state, expected) => {
    expect(shouldClearMicOnAgentDisconnect(state)).toBe(expected);
  });
});
