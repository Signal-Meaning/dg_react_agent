import { getLogger } from '../logger';

const log = getLogger();

/**
 * Audio processing utilities for smooth real-time audio playback
 *
 * Format and conversion follow:
 * - OpenAI Realtime API: session.audio.output.format is {"type":"audio/pcm","rate":24000};
 *   response.output_audio.delta carries base64-encoded PCM in that format.
 *   https://platform.openai.com/docs/api-reference/realtime-server-events/response/output_audio/delta
 *   Realtime guide input_audio_buffer.append uses 16-bit PCM little-endian (setInt16(..., true));
 *   output uses the same session format. https://platform.openai.com/docs/guides/realtime-conversations
 * - Web Audio API: AudioBuffer stores "non-interleaved IEEE 754 32-bit linear PCM" in range -1 to +1.
 *   https://webaudio.github.io/web-audio-api/#dom-audiobuffer-getchanneldata
 */

/**
 * Creates an AudioBuffer from raw 16-bit PCM data conforming to OpenAI Realtime output format
 * (audio/pcm, rate 24000, 16-bit signed integer, little-endian).
 *
 * @param audioContext The Web Audio API AudioContext (sample rate must match data, e.g. 24000 for Realtime output)
 * @param data ArrayBuffer containing 16-bit little-endian PCM (2 bytes per sample)
 * @param sampleRate Sample rate of the audio data (default 24000 per Realtime API)
 * @returns AudioBuffer ready for playback, or undefined if data is empty
 */
export function createAudioBuffer(
  audioContext: AudioContext, 
  data: ArrayBuffer, 
  sampleRate: number = 24000
): AudioBuffer | undefined {
  // PCM16 = 2 bytes per sample. Do NOT drop bytes in the streaming path — AudioManager.queueAudio carries the odd byte
  // into the next chunk; callers in the playback pipeline must pass even-length data. Truncation here is only a last-resort
  // fallback for non-streaming callers; dropping a byte misaligns the stream and causes buzzing.
  let processedData = data;
  if (data.byteLength % 2 !== 0) {
    processedData = data.slice(0, data.byteLength - 1);
    log.warn('[createAudioBuffer] Odd length — truncated to even; avoid in streaming path (use carry in queueAudio)', { bytes: data.byteLength });
  }

  const numSamples = processedData.byteLength / 2;
  if (numSamples === 0) {
    log.error('Received audio data is empty');
    return undefined;
  }

  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channelData = buffer.getChannelData(0);
  const view = new DataView(processedData);

  // 16-bit little-endian PCM (per Realtime API) → Float32 in [-1, 1] (per Web Audio API AudioBuffer)
  for (let i = 0; i < numSamples; i++) {
    channelData[i] = view.getInt16(i * 2, true) / 32768;
  }

  return buffer;
}

/**
 * Plays an AudioBuffer with precise timing to ensure continuous playback
 * @param audioContext The Web Audio API AudioContext
 * @param buffer AudioBuffer to play
 * @param startTimeRef Reference to the start time (to maintain continuity between chunks)
 * @param analyzer Optional AudioAnalyser node for volume analysis
 * @returns AudioBufferSourceNode that's playing the buffer
 */
export function playAudioBuffer(
  audioContext: AudioContext, 
  buffer: AudioBuffer, 
  startTimeRef: { current: number },
  analyzer?: AnalyserNode
): AudioBufferSourceNode {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  
  if (analyzer) {
    source.connect(analyzer);
    analyzer.connect(audioContext.destination);
  } else {
    source.connect(audioContext.destination);
  }

  const currentTime = audioContext.currentTime;
  if (startTimeRef.current < currentTime) {
    startTimeRef.current = currentTime;
  }

  source.start(startTimeRef.current);
  startTimeRef.current += buffer.duration;

  return source;
}

/**
 * Downsamples audio data from one sample rate to another
 * @param buffer Float32Array of audio samples
 * @param fromSampleRate Original sample rate
 * @param toSampleRate Target sample rate
 * @returns Downsampled Float32Array
 */
export function downsample(
  buffer: Float32Array, 
  fromSampleRate: number, 
  toSampleRate: number
): Float32Array {
  if (fromSampleRate === toSampleRate) {
    return buffer;
  }
  
  const sampleRateRatio = fromSampleRate / toSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0, count = 0;
    
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    
    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  
  return result;
}

/**
 * Converts Float32Array audio data to Int16Array format
 * @param buffer Float32Array of audio samples
 * @returns ArrayBuffer containing Int16 audio data
 */
export function convertFloat32ToInt16(buffer: Float32Array): ArrayBuffer {
  let l = buffer.length;
  const buf = new Int16Array(l);
  
  while (l--) {
    buf[l] = Math.min(1, buffer[l]) * 0x7fff;
  }
  
  return buf.buffer;
}

/**
 * Normalizes audio volume using frequency data from an analyzer
 * @param analyzer AudioAnalyser node
 * @param dataArray Uint8Array to store analyzer data
 * @param normalizationFactor Factor to normalize against (higher = quieter)
 * @returns Normalized volume level between 0-1
 */
export function normalizeVolume(
  analyzer: AnalyserNode, 
  dataArray: Uint8Array, 
  normalizationFactor: number
): number {
  analyzer.getByteFrequencyData(dataArray);
  const sum = dataArray.reduce((acc, val) => acc + val, 0);
  const average = sum / dataArray.length;
  return Math.min(average / normalizationFactor, 1);
} 