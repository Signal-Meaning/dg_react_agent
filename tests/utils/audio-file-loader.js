/**
 * Audio File Loader for Pre-recorded Audio Testing
 * 
 * This module provides utilities for loading and using pre-recorded audio files
 * in VAD tests, complementing the TTS generation approach.
 * 
 * Key Features:
 * - WAV file loading and conversion
 * - Audio format validation
 * - Chunk-based audio streaming simulation
 * - Integration with VAD Audio Simulator
 */

const fs = require('fs');
const path = require('path');

class AudioFileLoader {
  /**
   * Load audio file and convert to ArrayBuffer
   * @param {string} filePath - Path to audio file
   * @returns {Promise<ArrayBuffer>} - Audio data as ArrayBuffer
   */
  static async loadAudioFile(filePath) {
    try {
      const fullPath = path.resolve(filePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Audio file not found: ${fullPath}`);
      }
      
      const audioBuffer = fs.readFileSync(fullPath);
      const arrayBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      );
      
      console.log('🎵 [AUDIO] Loaded audio file:', {
        path: fullPath,
        size: arrayBuffer.byteLength,
        sizeKB: Math.round(arrayBuffer.byteLength / 1024)
      });
      
      return arrayBuffer;
    } catch (error) {
      console.error('❌ [AUDIO] Failed to load audio file:', error);
      throw error;
    }
  }

  /**
   * Load audio file from fixtures directory
   * @param {string} fileName - Name of the audio file
   * @returns {Promise<ArrayBuffer>} - Audio data as ArrayBuffer
   */
  static async loadFixtureAudio(fileName) {
    const fixturesDir = path.join(__dirname, '../fixtures/audio-samples');
    const filePath = path.join(fixturesDir, fileName);
    return await this.loadAudioFile(filePath);
  }

  /**
   * Load TTS/speech fixture from JSON (tests/fixtures/audio-samples/sample_<name>.json).
   * Format: 16 kHz 16-bit mono PCM, base64 in audioData; metadata.sampleRate.
   * Used by OpenAI proxy integration tests for speech-like input (RESOLUTION-PLAN §7).
   * @param {string} sampleName - Sample name (e.g. 'hello', 'realistic_speech_test')
   * @returns {{ buffer: Buffer; sampleRate: number }} - PCM buffer and sample rate (16000)
   */
  static loadFixtureJsonAudioSync(sampleName) {
    const fixturesDir = path.join(__dirname, '../fixtures/audio-samples');
    const filePath = path.join(fixturesDir, `sample_${sampleName}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio fixture not found: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const buffer = Buffer.from(data.audioData, 'base64');
    const sampleRate = data.metadata?.sampleRate ?? 16000;
    return { buffer, sampleRate };
  }

  /**
   * Resample 16 kHz 16-bit mono PCM to 24 kHz (linear interpolation).
   * OpenAI proxy session expects 24 kHz input.
   * @param {Buffer|ArrayBuffer} pcm16k - 16 kHz 16-bit mono PCM
   * @returns {Buffer} - 24 kHz 16-bit mono PCM
   */
  static resample16kTo24kPcm(pcm16k) {
    const buf = Buffer.isBuffer(pcm16k) ? pcm16k : Buffer.from(pcm16k);
    const view = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
    const inputSamples = view.length;
    const outputSamples = Math.floor(inputSamples * 24 / 16);
    const out = new Int16Array(outputSamples);
    for (let j = 0; j < outputSamples; j++) {
      const srcIndex = j / 1.5;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, inputSamples - 1);
      const frac = srcIndex - i0;
      out[j] = Math.round(view[i0] + frac * (view[i1] - view[i0]));
    }
    return Buffer.from(out.buffer, 0, out.byteLength);
  }

  /**
   * Load speech-like PCM at 24 kHz for OpenAI proxy tests (Issue #414).
   * Uses project TTS/recorded speech fixtures; resamples 16k→24k. Returns at least minBytes (default 4800 = 100ms).
   * @param {string} sampleName - Fixture name (e.g. 'hello', 'realistic_speech_test')
   * @param {number} minBytes - Minimum bytes to return (default 4800 = 100ms at 24 kHz)
   * @returns {Buffer} - 24 kHz 16-bit mono PCM, length >= minBytes
   */
  static loadSpeechLikePcm24kFromFixture(sampleName, minBytes = 4800) {
    const { buffer } = this.loadFixtureJsonAudioSync(sampleName);
    const pcm24k = this.resample16kTo24kPcm(buffer);
    if (pcm24k.length < minBytes) {
      throw new Error(`Fixture ${sampleName} too short after resample: ${pcm24k.length} < ${minBytes}`);
    }
    return pcm24k;
  }

  /**
   * Convert audio file to PCM format suitable for Deepgram
   * @param {ArrayBuffer} audioData - Raw audio data
   * @param {Object} options - Conversion options
   * @param {number} options.targetSampleRate - Target sample rate (default: 16000)
   * @param {number} options.targetChannels - Target channels (default: 1)
   * @param {number} options.targetBitDepth - Target bit depth (default: 16)
   * @returns {ArrayBuffer} - Converted PCM data
   */
  static convertToPCM(audioData, options = {}) {
    const {
      targetSampleRate = 16000,
      targetChannels = 1,
      targetBitDepth = 16
    } = options;

    // For now, return the data as-is
    // In a full implementation, you'd use a library like node-wav or ffmpeg
    // to properly convert the audio format
    
    console.log('🔄 [AUDIO] Converted to PCM format:', {
      originalSize: audioData.byteLength,
      targetSampleRate,
      targetChannels,
      targetBitDepth
    });
    
    return audioData;
  }

  /**
   * Split audio into chunks for streaming simulation
   * @param {ArrayBuffer} audioData - Audio data
   * @param {number} chunkSize - Size of each chunk in bytes
   * @returns {Array<ArrayBuffer>} - Array of audio chunks
   */
  static splitIntoChunks(audioData, chunkSize = 4096) {
    const chunks = [];
    const totalBytes = audioData.byteLength;
    
    for (let offset = 0; offset < totalBytes; offset += chunkSize) {
      const endOffset = Math.min(offset + chunkSize, totalBytes);
      const chunk = audioData.slice(offset, endOffset);
      chunks.push(chunk);
    }
    
    console.log('✂️ [AUDIO] Split into chunks:', {
      totalSize: totalBytes,
      chunkSize,
      totalChunks: chunks.length,
      lastChunkSize: chunks[chunks.length - 1]?.byteLength || 0
    });
    
    return chunks;
  }

  /**
   * Add silence padding to audio data
   * @param {ArrayBuffer} audioData - Original audio data
   * @param {number} onsetSilenceMs - Initial silence in milliseconds
   * @param {number} offsetSilenceMs - Ending silence in milliseconds
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @returns {ArrayBuffer} - Audio with silence padding
   */
  static addSilencePadding(audioData, onsetSilenceMs, offsetSilenceMs, sampleRate = 16000) {
    const onsetSamples = Math.floor((onsetSilenceMs / 1000) * sampleRate);
    const offsetSamples = Math.floor((offsetSilenceMs / 1000) * sampleRate);
    
    // Convert to Int16Array for manipulation
    const originalSamples = new Int16Array(audioData);
    const totalSamples = onsetSamples + originalSamples.length + offsetSamples;
    
    // Create new buffer with silence padding
    const paddedSamples = new Int16Array(totalSamples);
    
    // Add onset silence (zeros)
    for (let i = 0; i < onsetSamples; i++) {
      paddedSamples[i] = 0;
    }
    
    // Add original audio
    for (let i = 0; i < originalSamples.length; i++) {
      paddedSamples[onsetSamples + i] = originalSamples[i];
    }
    
    // Add offset silence (zeros)
    for (let i = 0; i < offsetSamples; i++) {
      paddedSamples[onsetSamples + originalSamples.length + i] = 0;
    }
    
    console.log('🔇 [AUDIO] Added silence padding:', {
      onsetMs: onsetSilenceMs,
      offsetMs: offsetSilenceMs,
      onsetSamples,
      offsetSamples,
      originalSamples: originalSamples.length,
      totalSamples: paddedSamples.length
    });
    
    return paddedSamples.buffer;
  }

  /**
   * Validate audio file format
   * @param {string} filePath - Path to audio file
   * @returns {Promise<Object>} - Audio file information
   */
  static async validateAudioFile(filePath) {
    try {
      const audioBuffer = fs.readFileSync(filePath);
      
      // Basic WAV header validation
      const header = new Uint8Array(audioBuffer, 0, 44);
      const riffHeader = String.fromCharCode(...header.slice(0, 4));
      const waveHeader = String.fromCharCode(...header.slice(8, 12));
      
      if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
        throw new Error('Invalid WAV file format');
      }
      
      // Extract audio properties from WAV header
      const sampleRate = new DataView(audioBuffer.buffer, 24, 4).getUint32(0, true);
      const channels = new DataView(audioBuffer.buffer, 22, 2).getUint16(0, true);
      const bitsPerSample = new DataView(audioBuffer.buffer, 34, 2).getUint16(0, true);
      const dataSize = new DataView(audioBuffer.buffer, 40, 4).getUint32(0, true);
      
      const info = {
        valid: true,
        sampleRate,
        channels,
        bitsPerSample,
        dataSize,
        duration: dataSize / (sampleRate * channels * (bitsPerSample / 8)),
        fileSize: audioBuffer.length
      };
      
      console.log('✅ [AUDIO] File validation successful:', info);
      return info;
      
    } catch (error) {
      console.error('❌ [AUDIO] File validation failed:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Create audio sample from file with VAD-optimized settings
   * @param {string} filePath - Path to audio file
   * @param {Object} options - VAD options
   * @param {number} options.onsetSilence - Initial silence in ms
   * @param {number} options.offsetSilence - Ending silence in ms
   * @returns {Promise<ArrayBuffer>} - VAD-optimized audio data
   */
  static async createVADSample(filePath, options = {}) {
    const {
      onsetSilence = 300,
      offsetSilence = 1000
    } = options;

    // Load and validate the audio file
    const validation = await this.validateAudioFile(filePath);
    if (!validation.valid) {
      throw new Error(`Invalid audio file: ${validation.error}`);
    }

    // Load the audio data
    const audioData = await this.loadAudioFile(filePath);
    
    // Convert to PCM format
    const pcmData = this.convertToPCM(audioData, {
      targetSampleRate: 16000,
      targetChannels: 1,
      targetBitDepth: 16
    });
    
    // Add silence padding for VAD testing
    const vadSample = this.addSilencePadding(pcmData, onsetSilence, offsetSilence);
    
    console.log('🎯 [AUDIO] Created VAD sample:', {
      file: path.basename(filePath),
      originalDuration: validation.duration,
      onsetSilence,
      offsetSilence,
      finalSize: vadSample.byteLength
    });
    
    return vadSample;
  }
}

module.exports = AudioFileLoader;
