import type { TranscriptResponse } from '@signal-meaning/voice-agent-react';

/**
 * OpenAI Realtime proxy uses `turn_detection: null` (proxy-owned session.audio.input), so upstream
 * does not emit `input_audio_buffer.speech_started` → the component never receives `UserStartedSpeaking`.
 * User speech is still reflected as `conversation.item.input_audio_transcription.*` → `onTranscriptUpdate`.
 *
 * @see packages/voice-agent-backend/scripts/openai-proxy/translator.ts (turn_detection: null)
 */
export function openAiInputTranscriptImpliesUserSpeaking(
  transcript: Pick<TranscriptResponse, 'transcript'>
): boolean {
  return Boolean(transcript.transcript?.trim());
}

/** After a final segment, mic activity can return to idle after a short debounce. */
export function openAiTranscriptShouldEndMicActivityPulse(
  transcript: Pick<TranscriptResponse, 'is_final' | 'speech_final'>
): boolean {
  return transcript.is_final === true || transcript.speech_final === true;
}
