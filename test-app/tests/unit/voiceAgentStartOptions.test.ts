/**
 * Issue #560 — Lock test-app `start()` options for mic / Live (integration contract).
 * Mirrors #561 policy: OpenAI proxy → agent only; Deepgram direct → agent + transcription.
 */
import { getVoiceAgentStartOptions } from '../../src/live-mode/voiceAgentStartOptions';

describe('getVoiceAgentStartOptions (Issue #560)', () => {
  it('uses agent-only start when proxy endpoint is OpenAI', () => {
    expect(getVoiceAgentStartOptions('wss://localhost:8080/openai/realtime')).toEqual({
      agent: true,
      transcription: false,
      userInitiated: true,
    });
    expect(getVoiceAgentStartOptions('/openai')).toEqual({
      agent: true,
      transcription: false,
      userInitiated: true,
    });
  });

  it('starts transcription with agent when not OpenAI proxy', () => {
    expect(getVoiceAgentStartOptions('wss://agent.deepgram.com/v1/agent/converse')).toEqual({
      agent: true,
      transcription: true,
      userInitiated: true,
    });
    expect(getVoiceAgentStartOptions('')).toEqual({
      agent: true,
      transcription: true,
      userInitiated: true,
    });
    expect(getVoiceAgentStartOptions(undefined)).toEqual({
      agent: true,
      transcription: true,
      userInitiated: true,
    });
  });
});
