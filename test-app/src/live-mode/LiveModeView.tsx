import type { LiveAgentPresentation, LiveSessionPhase } from './liveModePresentation';

export type LiveVoicePhase = 'idle' | 'speaking';

export interface LiveModeViewProps {
  agentPresentation: LiveAgentPresentation;
  sessionPhase: LiveSessionPhase;
  voicePhase: LiveVoicePhase;
  /** Leave Live mode (full layout). */
  onEndLive?: () => void;
  /** Reconnect capture while staying in Live (mic_off / disconnected). */
  onResumeMic?: () => void;
}

/**
 * Glanceable Live / voice-first shell for Issue #561. No WebSocket logic — parent maps component state.
 */
export function LiveModeView({
  agentPresentation,
  sessionPhase,
  voicePhase,
  onEndLive,
  onResumeMic,
}: LiveModeViewProps) {
  const showResumeMic =
    !!onResumeMic && (sessionPhase === 'mic_off' || sessionPhase === 'disconnected');

  return (
    <div data-testid="live-mode-root" role="region" aria-label="Live voice mode">
      <div data-testid="live-voice-state">{voicePhase}</div>
      <div data-testid="live-agent-state">{agentPresentation}</div>
      <div data-testid="live-session-phase">{sessionPhase}</div>
      {onEndLive ? (
        <button type="button" data-testid="live-end-live-button" onClick={onEndLive}>
          End Live
        </button>
      ) : null}
      {showResumeMic ? (
        <button type="button" data-testid="live-resume-mic-button" onClick={onResumeMic}>
          Resume microphone
        </button>
      ) : null}
    </div>
  );
}
