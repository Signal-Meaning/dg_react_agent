/**
 * Pluggable PCM playback sink for streaming agent TTS audio.
 *
 * Shared contract so the same streaming logic can target:
 * - Browser: Web Audio API (AudioManager.queueAudio)
 * - Node: system output via the speaker package (CLI)
 *
 * Format is typically PCM 24 kHz mono 16-bit (e.g. OpenAI Realtime, Deepgram).
 */

/** PCM format used for agent TTS streaming (e.g. OpenAI Realtime output_audio). */
export const PCM_STREAM_FORMAT = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
} as const;

/**
 * Sink that accepts raw PCM chunks and optional end-of-stream.
 * Implementations: WebAudioPlaybackSink (browser), SpeakerSink (Node).
 */
export interface IAudioPlaybackSink {
  /** Append a PCM chunk (ArrayBuffer in browser, Buffer in Node). */
  write(chunk: ArrayBuffer | Buffer): void;
  /** Signal end of stream. callback (if provided) runs when playback has finished (e.g. speaker closed). */
  end(callback?: () => void): void;
}
