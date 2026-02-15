/**
 * PCM playback sink types for OpenAI proxy CLI (Issue #414).
 * Minimal copy so the proxy does not depend on the React package.
 * Format matches OpenAI Realtime API session.audio.output.format.
 */

export const PCM_STREAM_FORMAT = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
} as const;

export interface IAudioPlaybackSink {
  write(chunk: ArrayBuffer | Buffer): void;
  end(callback?: () => void): void;
}
