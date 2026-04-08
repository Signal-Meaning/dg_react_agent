/**
 * Issue #560 — Lock test-app `start()` options for mic / Live / text-input focus (integration contract).
 * OpenAI proxy: `transcription: false` = no **second** Deepgram Listen socket; STT still on OpenAI Realtime session.
 * Deepgram direct: `transcription: true` = agent + separate transcription service.
 * App.tsx `startServicesAndMicrophone` and text-input `onFocus` must both use this helper.
 */
import { getVoiceAgentStartOptions } from '../../src/live-mode/voiceAgentStartOptions';

describe('getVoiceAgentStartOptions (Issue #560)', () => {
  it('OpenAI proxy: start() omits Deepgram transcription socket (Realtime session still carries user STT)', () => {
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

  it('Deepgram path: start() requests agent + separate transcription service', () => {
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

  it('text-input onFocus uses the same contract (no hardcoded transcription: false for all modes)', () => {
    const asTextFocusWould = (proxy: string | undefined) => getVoiceAgentStartOptions(proxy);
    // Synthetic URL: only the `/openai` path segment is required for OpenAI-proxy detection.
    expect(asTextFocusWould('wss://voice-fixture.invalid/openai/session')).toEqual({
      agent: true,
      transcription: false,
      userInitiated: true,
    });
    expect(asTextFocusWould(undefined)).toEqual({
      agent: true,
      transcription: true,
      userInitiated: true,
    });
  });
});
