/**
 * OpenAI proxy: PCM16 mono 16 kHz → 24 kHz resampling (Issue #560).
 * dg_react_agent AudioManager emits 16 kHz PCM16 to the proxy (downsampled from AudioContext rate when needed); Realtime session.input declares rate 24000.
 */

import { Pcm16Mono16kTo24kStreamResampler } from '../packages/voice-agent-backend/scripts/openai-proxy/pcm-resample-16k-to-24k';

describe('Pcm16Mono16kTo24kStreamResampler', () => {
  it('returns empty buffer for empty input', () => {
    const r = new Pcm16Mono16kTo24kStreamResampler();
    expect(r.push(Buffer.alloc(0)).byteLength).toBe(0);
  });

  it('throws on odd byte length', () => {
    const r = new Pcm16Mono16kTo24kStreamResampler();
    expect(() => r.push(Buffer.from([0x00, 0x01, 0x02]))).toThrow(/odd byte length/);
  });

  it('accepts ws-style Buffer subarray with odd byteOffset (pooled backing store)', () => {
    const pool = Buffer.alloc(961);
    for (let i = 0; i < 480; i++) {
      pool.writeInt16LE(100, 1 + i * 2);
    }
    const slice = pool.subarray(1, 961);
    expect(slice.byteOffset % 2).toBe(1);
    const r = new Pcm16Mono16kTo24kStreamResampler();
    expect(() => r.push(slice)).not.toThrow();
    const out = r.push(slice);
    expect(out.byteLength).toBeGreaterThan(0);
  });

  it('two consecutive 4096-sample chunks produce 12287 upstream samples (linear interp holds one input at end until more audio)', () => {
    const r = new Pcm16Mono16kTo24kStreamResampler();
    const frame = (n: number) => {
      const b = Buffer.alloc(n * 2);
      for (let i = 0; i < n; i++) {
        b.writeInt16LE(100, i * 2);
      }
      return b;
    };
    const out = Buffer.concat([r.push(frame(4096)), r.push(frame(4096))]);
    expect(out.byteLength / 2).toBe(12287);
    const view = new Int16Array(out.buffer, out.byteOffset, out.byteLength / 2);
    for (let i = 0; i < view.length; i++) {
      expect(view[i]).toBe(100);
    }
  });

  it('250 × 16-bit samples in one chunk yield 374 × 24 kHz samples (748 bytes; one sample held for lookahead)', () => {
    const r = new Pcm16Mono16kTo24kStreamResampler();
    const input = Buffer.alloc(500);
    for (let i = 0; i < 250; i++) {
      input.writeInt16LE(0, i * 2);
    }
    const out = r.push(input);
    expect(out.byteLength).toBe(748);
  });

  it('chunked input matches single-buffer resample (streaming phase continuity)', () => {
    const parts: Buffer[] = [];
    let off = 0;
    for (let p = 0; p < 5; p++) {
      const byteLen = 800 + p * 100;
      const b = Buffer.alloc(byteLen);
      for (let i = 0; i < byteLen / 2; i++) {
        b.writeInt16LE((off + i) % 30000, i * 2);
      }
      off += byteLen / 2;
      parts.push(b);
    }
    const combined = Buffer.concat(parts);
    const r1 = new Pcm16Mono16kTo24kStreamResampler();
    const expected = r1.push(combined);
    const r2 = new Pcm16Mono16kTo24kStreamResampler();
    let got = Buffer.alloc(0);
    for (const part of parts) {
      got = Buffer.concat([got, r2.push(part)]);
    }
    expect(got.equals(expected)).toBe(true);
  });
});
