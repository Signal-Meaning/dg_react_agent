/**
 * Issue #560: Microphone PCM must be true target-rate (e.g. 16 kHz) before OpenAI proxy
 * (proxy assumes 16 kHz then resamples to 24 kHz). AudioWorklet runs at AudioContext
 * sample rate; treating those samples as 16 kHz garbles upstream transcription.
 */

import { downsample, prepareMicPcmForAgent } from '../../src/utils/audio/AudioUtils';
import {
  CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ,
  TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ,
} from '../../src/utils/audio/mic-audio-contract';

/** Same wall-clock span: 0.1 s at proxy rate vs 0.1 s at typical context rate (integer frame counts). */
const SINE_TEST_DURATION_SEC = 0.1;
const N_FRAMES_AT_PROXY_RATE = Math.round(SINE_TEST_DURATION_SEC * CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ);
const N_FRAMES_AT_TYPICAL_CONTEXT_RATE = Math.round(
  SINE_TEST_DURATION_SEC * TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ
);

describe('prepareMicPcmForAgent (Issue #560)', () => {
  it('default target rate matches explicit CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ', () => {
    const f = new Float32Array([0.1]);
    const a = prepareMicPcmForAgent(f, CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ);
    const b = prepareMicPcmForAgent(f, CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ, CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ);
    expect(a.byteLength).toBe(b.byteLength);
  });

  it('at proxy-rate context, output length matches input (no resample)', () => {
    const n = N_FRAMES_AT_PROXY_RATE;
    const f = new Float32Array(n);
    const hz = CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ;
    for (let i = 0; i < n; i++) f[i] = Math.sin((2 * Math.PI * 440 * i) / hz) * 0.1;
    const out = prepareMicPcmForAgent(f, hz, hz);
    expect(out.byteLength).toBe(n * 2);
  });

  it('at typical AudioContext rate, downsamples to shorter PCM for proxy target', () => {
    const n = N_FRAMES_AT_TYPICAL_CONTEXT_RATE;
    const f = new Float32Array(n);
    const ctxHz = TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ;
    const targetHz = CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ;
    for (let i = 0; i < n; i++) f[i] = Math.sin((2 * Math.PI * 440 * i) / ctxHz) * 0.2;
    const out = prepareMicPcmForAgent(f, ctxHz, targetHz);
    const expectedSamples = downsample(f, ctxHz, targetHz).length;
    expect(out.byteLength).toBe(expectedSamples * 2);
    expect(expectedSamples).toBeGreaterThan(0);
    expect(expectedSamples).toBeLessThan(n);
  });

  it('produces little-endian int16 in [-32768, 32767]', () => {
    const f = new Float32Array([0, 1, -1, 0.5, -0.5]);
    const hz = CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ;
    const out = prepareMicPcmForAgent(f, hz, hz);
    const view = new DataView(out);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
  });
});
