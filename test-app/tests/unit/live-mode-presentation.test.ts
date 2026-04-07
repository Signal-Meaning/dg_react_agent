/**
 * Issue #561 — Live mode presentation helpers (TDD Phase A).
 */

import type { AgentState } from '@signal-meaning/voice-agent-react';
import {
  getLiveAgentPresentation,
  getLiveSessionPhase,
} from '../../src/live-mode/liveModePresentation';

describe('getLiveAgentPresentation (Issue #561)', () => {
  const agentStates: AgentState[] = [
    'idle',
    'listening',
    'thinking',
    'speaking',
    'entering_sleep',
    'sleeping',
  ];

  it.each(agentStates)('maps %s when no function call pending', (agentState) => {
    expect(getLiveAgentPresentation(agentState, {})).toBe(agentState);
    expect(getLiveAgentPresentation(agentState, { functionCallPending: false })).toBe(
      agentState
    );
  });

  it.each(agentStates)('returns tool when function call pending (overrides %s)', (agentState) => {
    expect(getLiveAgentPresentation(agentState, { functionCallPending: true })).toBe('tool');
  });
});

describe('getLiveSessionPhase (Issue #561)', () => {
  it('returns active when connected and microphone capturing', () => {
    expect(
      getLiveSessionPhase({ agentConnected: true, microphoneCapturing: true })
    ).toBe('active');
  });

  it('returns mic_off when connected but microphone not capturing', () => {
    expect(
      getLiveSessionPhase({ agentConnected: true, microphoneCapturing: false })
    ).toBe('mic_off');
  });

  it('returns disconnected when agent not connected', () => {
    expect(
      getLiveSessionPhase({ agentConnected: false, microphoneCapturing: false })
    ).toBe('disconnected');
    expect(
      getLiveSessionPhase({ agentConnected: false, microphoneCapturing: true })
    ).toBe('disconnected');
  });
});
