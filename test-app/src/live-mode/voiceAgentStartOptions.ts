/**
 * Maps proxy endpoint to `DeepgramVoiceInteractionHandle.start()` options for mic / Live / text-input focus.
 * Issue #561 / #560 — keep in sync with TDD-PLAN §2, `App.tsx`, and `DeepgramVoiceInteraction.start()` (Issue #439).
 *
 * **OpenAI proxy:** `transcription: false` does **not** mean “no user speech transcription.” The OpenAI Realtime
 * session (single WebSocket via the proxy) carries mic audio and `input_audio_transcription` / turn events on that
 * same connection. The flag tells the component **not** to open the **separate Deepgram Listen** transcription
 * WebSocket, which would be wrong for this protocol.
 *
 * **Deepgram direct:** `transcription: true` opens the Voice Agent + dedicated transcription service as configured.
 */
export function getVoiceAgentStartOptions(proxyEndpoint: string | undefined | null): {
  agent: true;
  transcription: boolean;
  userInitiated: true;
} {
  const useOpenAIProxy = (proxyEndpoint ?? '').includes('/openai');
  if (useOpenAIProxy) {
    return { agent: true, transcription: false, userInitiated: true };
  }
  return { agent: true, transcription: true, userInitiated: true };
}
