/**
 * Pluggable PCM playback sink for streaming agent TTS audio.
 *
 * Shared contract so the same streaming logic can target:
 * - Browser: Web Audio API (AudioManager.queueAudio)
 * - Node: system output via the speaker package (CLI)
 *
 * Format matches OpenAI Realtime API session.audio.output.format: type "audio/pcm", rate 24000,
 * 16-bit signed integer, little-endian, mono. See:
 * https://platform.openai.com/docs/api-reference/realtime-server-events/response/output_audio/delta
 */

/** PCM format for agent TTS streaming (OpenAI Realtime output: audio/pcm, 24 kHz, 16-bit LE, mono). */
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
