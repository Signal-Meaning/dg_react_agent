import type { CSSProperties } from 'react';
import type { ConversationRole } from '@signal-meaning/voice-agent-react';
import type { LiveAgentPresentation, LiveSessionPhase } from './liveModePresentation';
import { LiveAgentVisual } from './LiveAgentVisual';

export type LiveVoicePhase = 'idle' | 'speaking';

export type LiveConversationMessage = {
  role: ConversationRole;
  content: string;
  timestamp?: number;
};

export interface LiveModeViewProps {
  agentPresentation: LiveAgentPresentation;
  sessionPhase: LiveSessionPhase;
  voicePhase: LiveVoicePhase;
  /** Assistant is audibly responding (playback or speaking state). */
  agentOutputActive?: boolean;
  /** Same list as debug “Conversation History” (Issue #561 visibility in Live). */
  conversationMessages?: LiveConversationMessage[];
  /** Leave Live mode (full layout). */
  onEndLive?: () => void;
  /** Reconnect capture while staying in Live (mic_off / disconnected). */
  onResumeMic?: () => void;
}

/** Shared horizontal span for history, activity rows, and footer buttons (Issue #561). */
const liveContentColumn: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  alignSelf: 'stretch',
};

const statusGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '4px 14px',
  fontSize: '13px',
  lineHeight: 1.4,
  ...liveContentColumn,
};

const muted = 'rgba(226, 232, 240, 0.55)';

const liveActionButton: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.22)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

/**
 * Glanceable Live / voice-first shell for Issue #561. No WebSocket logic — parent maps component state.
 * Primary actions sit above conversation history (Issue #560 / manual UX).
 */
export function LiveModeView({
  agentPresentation,
  sessionPhase,
  voicePhase,
  agentOutputActive = false,
  conversationMessages = [],
  onEndLive,
  onResumeMic,
}: LiveModeViewProps) {
  const showResumeMic =
    !!onResumeMic && (sessionPhase === 'mic_off' || sessionPhase === 'disconnected');

  return (
    <div
      data-testid="live-mode-root"
      role="region"
      aria-label="Live voice mode"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
        minHeight: 0,
        height: '100%',
        color: '#e2e8f0',
      }}
    >
      <div
        data-testid="live-mode-main"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 18,
          padding: '20px 16px 12px',
          overflowY: 'auto',
        }}
      >
        <LiveAgentVisual active={agentOutputActive} />

        {(onEndLive || showResumeMic) ? (
          <div
            data-testid="live-mode-footer"
            style={{
              ...liveContentColumn,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingBottom: 4,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {onEndLive ? (
              <button type="button" data-testid="live-end-live-button" onClick={onEndLive} style={liveActionButton}>
                End Live
              </button>
            ) : null}
            {showResumeMic ? (
              <button type="button" data-testid="live-resume-mic-button" onClick={onResumeMic} style={liveActionButton}>
                Resume microphone
              </button>
            ) : null}
          </div>
        ) : null}

        <section
          data-testid="live-conversation-history"
          aria-label="Conversation history"
          style={{
            ...liveContentColumn,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '10px 12px',
            maxHeight: 'min(42vh, 320px)',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: muted }}>
            Conversation history
          </h2>
          {conversationMessages.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: muted }}>(No messages yet)</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {conversationMessages.map((msg, index) => (
                <li
                  key={`${index}-${msg.timestamp ?? index}`}
                  data-testid={`live-conversation-message-${index}`}
                  data-role={msg.role}
                  style={{
                    padding: '6px 8px',
                    marginBottom: 4,
                    backgroundColor: msg.role === 'user' ? '#2d3748' : '#1a365d',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, marginRight: 8 }}>{msg.role}:</span>
                  <span>{msg.content}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <dl style={statusGrid} aria-label="Live session status" data-testid="live-activity-status">
          <dt style={{ color: muted }} id="live-status-mic">
            Mic activity
          </dt>
          <dd data-testid="live-voice-state" style={{ margin: 0 }} aria-labelledby="live-status-mic">
            {voicePhase}
          </dd>
          <dt style={{ color: muted }} id="live-status-assistant">
            Assistant activity
          </dt>
          <dd data-testid="live-agent-state" style={{ margin: 0 }} aria-labelledby="live-status-assistant">
            {agentPresentation}
          </dd>
          <dt style={{ color: muted }} id="live-status-session">
            Session
          </dt>
          <dd data-testid="live-session-phase" style={{ margin: 0 }} aria-labelledby="live-status-session">
            {sessionPhase}
          </dd>
        </dl>
      </div>

      {/* Spacer so content clears bottom safe area when actions moved above history */}
      <div style={{ flexShrink: 0, height: 12 }} aria-hidden />
    </div>
  );
}
