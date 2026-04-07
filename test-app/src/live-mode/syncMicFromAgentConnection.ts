import type { ConnectionState } from '@signal-meaning/voice-agent-react';

/**
 * When the agent WebSocket ends (idle timeout, error, explicit stop), the test-app must
 * clear mic/capture UI state so Enable Mic / Resume microphone match reality (Issue #561).
 */
export function shouldClearMicOnAgentDisconnect(state: ConnectionState): boolean {
  return state === 'closed' || state === 'error';
}
