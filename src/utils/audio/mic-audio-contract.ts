/**
 * OpenAI Realtime–aligned PCM sample rates used by this package (mic uplink, agent TTS playback).
 *
 * ## Mic uplink (binary WebSocket → proxy)
 * {@link CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ} — `packages/voice-agent-backend/.../pcm-resample-16k-to-24k.ts`
 * assumes this as `INPUT_RATE` before `input_audio_buffer.append` at {@link OPENAI_REALTIME_OUTPUT_PCM_SAMPLE_RATE_HZ}.
 * If you change it, update the proxy resampler and session expectations (translator / openai-audio-constants).
 *
 * ## Agent TTS playback (downstream)
 * {@link OPENAI_REALTIME_OUTPUT_PCM_SAMPLE_RATE_HZ} matches default `session.audio.output.format` for `audio/pcm`
 * (`response.output_audio.delta`). `AudioManager` uses a dedicated playback `AudioContext` at this rate (Issue #414).
 */
export const CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ = 16000 as const;

/** Default Realtime agent output: `audio/pcm` rate for decoding TTS in Web Audio (Issue #414). */
export const OPENAI_REALTIME_OUTPUT_PCM_SAMPLE_RATE_HZ = 24000 as const;

/**
 * Common `AudioContext` / AudioWorklet rate on many desktop browsers when capture does not run at
 * {@link CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ}. `prepareMicPcmForAgent` downsamples from this (or any
 * context rate) into the proxy PCM rate. Use in tests and documentation; not a runtime guarantee.
 */
export const TYPICAL_AUDIO_CONTEXT_SAMPLE_RATE_HZ = 48000 as const;
