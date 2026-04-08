/**
 * Issue #560: End-to-end numeric contract from browser mic float (typical 48 kHz context)
 * → true 16 kHz PCM (`prepareMicPcmForAgent`) → OpenAI proxy 16→24 k resampler input.
 *
 * If the package ever skips downsampling and sends 48 kHz–paced int16 labeled as 16 kHz,
 * wall-clock duration per byte is wrong and upstream STT degrades; these tests lock the
 * intended byte ratios and the client→proxy chain.
 */

import { Pcm16Mono16kTo24kStreamResampler } from '../../packages/voice-agent-backend/scripts/openai-proxy/pcm-resample-16k-to-24k';
import {
  float32MonoToPcm16LeSymmetric,
  prepareMicPcmForAgent,
} from '../../src/utils/audio/AudioUtils';
import {
  CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ,
  TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ,
} from '../../src/utils/audio/mic-audio-contract';

describe('Issue #560 mic PCM → proxy resampler chain', () => {
  const sine48k = (seconds: number): Float32Array => {
    const n = Math.round(seconds * TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ);
    const f = new Float32Array(n);
    const hz = TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ;
    for (let i = 0; i < n; i++) {
      f[i] = 0.12 * Math.sin((2 * Math.PI * 440 * i) / hz);
    }
    return f;
  };

  it('prepareMicPcmForAgent yields ~16 kHz sample count for wall-clock duration (48 kHz context)', () => {
    const seconds = 0.25;
    const f32 = sine48k(seconds);
    const pcm = prepareMicPcmForAgent(f32, TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ);
    const samples16k = pcm.byteLength / 2;
    const expected = seconds * CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ;
    expect(samples16k).toBeGreaterThan(expected * 0.95);
    expect(samples16k).toBeLessThan(expected * 1.05);
  });

  it('buggy path (float→int16 at context rate without downsample) emits ~3× more samples than prepareMicPcmForAgent at 48 kHz', () => {
    const f32 = sine48k(0.15);
    const correct = prepareMicPcmForAgent(f32, TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ);
    const wrong = float32MonoToPcm16LeSymmetric(f32);
    expect(wrong.byteLength / correct.byteLength).toBeGreaterThan(2.7);
    expect(wrong.byteLength / correct.byteLength).toBeLessThan(3.2);
  });

  it('16 kHz PCM from prepareMicPcmForAgent feeds proxy resampler with ~1.5× sample expansion (16→24 kHz)', () => {
    const seconds = 0.2;
    const f32 = sine48k(seconds);
    const pcm = Buffer.from(prepareMicPcmForAgent(f32, TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ));
    const inSamples = pcm.length / 2;
    const r = new Pcm16Mono16kTo24kStreamResampler();
    let outBytes = 0;
    const chunk = 4096;
    for (let o = 0; o < pcm.length; o += chunk) {
      outBytes += r.push(pcm.subarray(o, Math.min(o + chunk, pcm.length))).length;
    }
    const outSamples = outBytes / 2;
    const ratio = outSamples / inSamples;
    expect(ratio).toBeGreaterThan(1.45);
    expect(ratio).toBeLessThan(1.55);
  });
});
