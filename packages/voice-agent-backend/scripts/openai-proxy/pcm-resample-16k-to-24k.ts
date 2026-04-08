/**
 * Linear PCM16 mono: 16 kHz → 24 kHz for OpenAI Realtime input (Issue #560).
 * dg_react_agent AudioManager emits true 16 kHz PCM16 (main thread downsamples from AudioContext rate when needed);
 * mapSettingsToSessionUpdate declares input rate 24000.
 * Without resampling, upstream misinterprets samples and transcription/VAD fail.
 */

/** Must match `CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ` in `src/utils/audio/mic-audio-contract.ts`. */
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
/** Input-sample index advance per emitted output sample (16000/24000 = 2/3). */
const STEP = INPUT_RATE / OUTPUT_RATE;

function clampToInt16(v: number): number {
  if (v <= -32768) return -32768;
  if (v >= 32767) return 32767;
  return Math.round(v);
}

function int16SamplesToBuffer(samples: number[]): Buffer {
  const arr = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) arr[i] = samples[i];
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/**
 * Stateful stream resampler for one WebSocket connection. Not thread-safe.
 */
export class Pcm16Mono16kTo24kStreamResampler {
  private buf = new Int16Array(0);
  private pos = 0;

  /**
   * Append one chunk of little-endian PCM16 mono at 16 kHz.
   * Returns PCM16 mono at 24 kHz for this chunk (may be empty if more input is needed).
   */
  push(pcm16le: Buffer): Buffer {
    if (pcm16le.length === 0) {
      return Buffer.alloc(0);
    }
    if (pcm16le.length % 2 !== 0) {
      throw new Error('Pcm16Mono16kTo24kStreamResampler: odd byte length');
    }
    // Copy so Int16Array is not built on a pooled Buffer with odd byteOffset (ws often uses subarrays;
    // Int16Array requires byteOffset % 2 === 0 or it throws — Issue #560 integration regression).
    const aligned = Buffer.from(pcm16le);
    const incoming = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 2);
    const merged = new Int16Array(this.buf.length + incoming.length);
    merged.set(this.buf, 0);
    merged.set(incoming, this.buf.length);
    this.buf = merged;

    const out: number[] = [];
    while (true) {
      const i0 = Math.floor(this.pos);
      const i1 = i0 + 1;
      if (i1 >= this.buf.length) break;
      const f = this.pos - i0;
      const s0 = this.buf[i0];
      const s1 = this.buf[i1];
      const v = s0 * (1 - f) + s1 * f;
      out.push(clampToInt16(v));
      this.pos += STEP;
    }

    const discard = Math.floor(this.pos);
    if (discard > 0 && discard <= this.buf.length) {
      this.buf = this.buf.subarray(discard);
      this.pos -= discard;
    }

    return int16SamplesToBuffer(out);
  }
}
