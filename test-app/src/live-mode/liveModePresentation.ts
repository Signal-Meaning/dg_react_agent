import type { AgentState } from '@signal-meaning/voice-agent-react';

/**
 * High-level agent row for Live mode UI / E2E (Issue #561).
 * Adds `tool` when a function call is in flight, regardless of underlying agent state.
 */
export type LiveAgentPresentation = AgentState | 'tool';

export function getLiveAgentPresentation(
  agentState: AgentState,
  context: { functionCallPending?: boolean }
): LiveAgentPresentation {
  if (context.functionCallPending) {
    return 'tool';
  }
  return agentState;
}

/**
 * Connection + mic snapshot for Live mode (Issue #561).
 * - `active` — agent socket connected and microphone capture is on (hands-free path).
 * - `mic_off` — still connected but capture off; user can **resume mic** without leaving Live.
 * - `disconnected` — agent not connected (idle timeout, error, explicit stop, etc.); show stopped; resume may need reconnect + mic per app policy.
 */
export type LiveSessionPhase = 'active' | 'mic_off' | 'disconnected';

export function getLiveSessionPhase(params: {
  agentConnected: boolean;
  microphoneCapturing: boolean;
}): LiveSessionPhase {
  if (!params.agentConnected) {
    return 'disconnected';
  }
  if (params.microphoneCapturing) {
    return 'active';
  }
  return 'mic_off';
}
