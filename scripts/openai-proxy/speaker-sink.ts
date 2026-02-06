/**
 * Node implementation of IAudioPlaybackSink using the speaker package.
 * Streams PCM to the system default output. Used by the OpenAI proxy CLI.
 */

import type { IAudioPlaybackSink } from '../../src/utils/audio/AudioPlaybackSink';
import { PCM_STREAM_FORMAT } from '../../src/utils/audio/AudioPlaybackSink';

function createSpeaker(): NodeJS.WritableStream | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Speaker = require('speaker');
    return new Speaker({
      channels: PCM_STREAM_FORMAT.channels,
      sampleRate: PCM_STREAM_FORMAT.sampleRate,
      bitDepth: PCM_STREAM_FORMAT.bitDepth,
    }) as NodeJS.WritableStream;
  } catch {
    return null;
  }
}

/**
 * Creates a playback sink that streams PCM to the system speaker, or null if speaker is unavailable.
 */
export function createSpeakerSink(): IAudioPlaybackSink | null {
  const stream = createSpeaker();
  if (!stream) return null;
  const s = stream as NodeJS.WritableStream & { end?: (cb?: () => void) => void; on?: (ev: string, fn: () => void) => void };
  return {
    write(chunk: ArrayBuffer | Buffer): void {
      const buf = chunk instanceof ArrayBuffer ? Buffer.from(chunk) : chunk;
      if (buf.length > 0) s.write(buf);
    },
    end(callback?: () => void): void {
      s.end?.(callback);
    },
  };
}
