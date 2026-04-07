/**
 * Live mode “assistant presence” visual (Issue #561).
 * Phase-1: SVG lip frame + vertical level bars. Animates when `active` (TTS / speaking).
 * Full waveform-mouth spec: docs/issues/ISSUE-561/DESIGN-LIVE-AGENT-VISUAL.md
 */

export interface LiveAgentVisualProps {
  /** True while assistant audio is playing or agent state is speaking. */
  active: boolean;
}

const BAR_COUNT = 7;

export function LiveAgentVisual({ active }: LiveAgentVisualProps) {
  return (
    <figure
      data-testid="live-agent-visual"
      aria-label={
        active
          ? 'Assistant mouth visualizer: lip outline and level bars while speaking'
          : 'Assistant mouth visualizer: idle lip outline and subtle bar motion'
      }
      style={{
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <svg
        width={240}
        height={56}
        viewBox="0 0 240 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ opacity: active ? 0.95 : 0.5 }}
      >
        <path
          d="M 20 28 Q 120 8 220 28"
          stroke="url(#liveMouthGrad)"
          strokeWidth={active ? 3.2 : 2.4}
          strokeLinecap="round"
          fill="none"
          style={{
            filter: active ? 'drop-shadow(0 0 6px rgba(248,250,252,0.45))' : 'none',
          }}
        />
        <path
          d="M 24 34 Q 120 48 216 34"
          stroke="url(#liveMouthGrad)"
          strokeWidth={active ? 3 : 2.2}
          strokeLinecap="round"
          fill="none"
        />
        <defs>
          <linearGradient id="liveMouthGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.55)" />
          </linearGradient>
        </defs>
      </svg>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 5,
          height: 72,
          paddingBottom: 4,
        }}
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            data-testid={`live-agent-visual-bar-${i}`}
            style={{
              display: 'block',
              width: 7,
              borderRadius: 4,
              background: 'linear-gradient(to top, rgba(100,116,139,0.5), #f1f5f9)',
              transformOrigin: '50% 100%',
              boxShadow: active ? '0 0 10px rgba(248,250,252,0.25)' : 'none',
              animation: active
                ? `liveAgentBarSpeak 0.48s ease-in-out ${i * 0.055}s infinite alternate`
                : `liveAgentBarIdle 2.4s ease-in-out ${i * 0.12}s infinite alternate`,
            }}
          />
        ))}
        <style>{`
          @keyframes liveAgentBarSpeak {
            from { height: 14px; opacity: 0.65; }
            to { height: 58px; opacity: 1; }
          }
          @keyframes liveAgentBarIdle {
            from { height: 10px; opacity: 0.4; }
            to { height: 22px; opacity: 0.7; }
          }
        `}</style>
      </div>
    </figure>
  );
}
