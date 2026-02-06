/**
 * Browser implementation of IAudioPlaybackSink using AudioManager (Web Audio API).
 * Each write() is passed to queueAudio(); end() is a no-op (playback continuity
 * is handled inside AudioManager).
 */

import type { IAudioPlaybackSink } from './AudioPlaybackSink';

export interface IQueueAudio {
  queueAudio(data: ArrayBuffer): Promise<void>;
}

function toArrayBuffer(chunk: ArrayBuffer | Buffer): ArrayBuffer {
  if (chunk instanceof ArrayBuffer) return chunk;
  const b = chunk as Buffer;
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

/**
 * Sink that forwards PCM chunks to an AudioManager (or any object with queueAudio).
 */
export class WebAudioPlaybackSink implements IAudioPlaybackSink {
  constructor(private readonly target: IQueueAudio) {}

  write(chunk: ArrayBuffer | Buffer): void {
    this.target.queueAudio(toArrayBuffer(chunk)).catch(() => {
      // Let AudioManager / caller handle errors; avoid unhandled rejection
    });
  }

  end(callback?: () => void): void {
    if (callback) callback();
  }
}
