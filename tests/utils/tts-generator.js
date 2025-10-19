/**
 * TTS Generator for Audio Simulation
 * 
 * This module provides Text-to-Speech (TTS) generation capabilities
 * for creating realistic audio samples for voice interaction testing.
 * It supports both Web Speech API and Deepgram TTS, allowing for
 * flexible testing scenarios.
 * 
 * Key Features:
 * - Dual TTS support: Web Speech API and Deepgram TTS
 * - PCM audio format conversion (16kHz, 16-bit, Mono)
 * - Silence padding for VAD event triggering
 * - Audio buffer management and optimization
 * - Configurable TTS provider selection
 */

class TTSGenerator {
  /**
   * Generate TTS audio using the specified provider
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @param {string} options.provider - TTS provider ('webspeech' or 'deepgram')
   * @param {string} options.voice - Voice to use (provider-specific)
   * @param {number} options.rate - Speech rate (0.1-10, default: 1)
   * @param {number} options.pitch - Voice pitch (0-2, default: 1)
   * @param {number} options.volume - Voice volume (0-1, default: 1)
   * @returns {Promise<ArrayBuffer>} - PCM audio data
   */
  static async generateTTSAudio(text, options = {}) {
    const {
      provider = 'webspeech', // Default to Web Speech API for compatibility
      voice = null,
      rate = 1,
      pitch = 1,
      volume = 1
    } = options;

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('TTS generation requires browser environment');
    }

    switch (provider) {
      case 'webspeech':
        return await TTSGenerator.generateWebSpeechTTS(text, { voice, rate, pitch, volume });
      case 'deepgram':
        return await TTSGenerator.generateDeepgramTTS(text, { voice, rate, pitch, volume });
      default:
        throw new Error(`Unsupported TTS provider: ${provider}`);
    }
  }

  /**
   * Generate TTS audio using Web Speech API
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<ArrayBuffer>} - PCM audio data
   */
  static async generateWebSpeechTTS(text, options = {}) {
    const { voice = null, rate = 1, pitch = 1, volume = 1 } = options;

    return new Promise((resolve, reject) => {
      // Check if Web Speech API is available
      if (!('speechSynthesis' in window)) {
        reject(new Error('Web Speech API not supported in this browser'));
        return;
      }

      // Create speech synthesis utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice properties
      if (voice) {
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }
      
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      
      // Explicitly prevent looping (Web Speech API doesn't loop by default, but be explicit)
      utterance.loop = false;
      utterance.repeat = false;

      // Create audio context for recording
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const audioBuffer = audioContext.createBuffer(1, sampleRate * 10, sampleRate); // 10 second buffer
      const audioData = audioBuffer.getChannelData(0);
      let audioIndex = 0;

      // Set up audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length && audioIndex < audioData.length; i++) {
          audioData[audioIndex++] = inputData[i];
        }
      };

      // Connect audio processing
      const source = audioContext.createMediaStreamSource(utterance);
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Set up timeout to prevent infinite audio generation
      const timeoutId = setTimeout(() => {
        console.warn('🎤 [TTS] Web Speech synthesis timeout - forcing cleanup');
        processor.disconnect();
        source.disconnect();
        speechSynthesis.cancel();
        reject(new Error('TTS generation timeout - audio may be looping'));
      }, 15000); // 15 second timeout

      // Handle speech events
      utterance.onstart = () => {
        console.log('🎤 [TTS] Web Speech synthesis started');
      };

      utterance.onend = () => {
        console.log('🎤 [TTS] Web Speech synthesis ended');
        clearTimeout(timeoutId);
        processor.disconnect();
        source.disconnect();
        
        // Convert to PCM format
        const pcmData = TTSGenerator.convertToPCM(audioData.slice(0, audioIndex), sampleRate);
        resolve(pcmData);
      };

      utterance.onerror = (event) => {
        console.error('🎤 [TTS] Web Speech synthesis error:', event.error);
        clearTimeout(timeoutId);
        processor.disconnect();
        source.disconnect();
        reject(new Error(`Web Speech synthesis failed: ${event.error}`));
      };

      // Start synthesis
      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Generate TTS audio using Deepgram TTS API
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<ArrayBuffer>} - PCM audio data
   */
  static async generateDeepgramTTS(text, options = {}) {
    const { 
      voice = 'aura-asteria-en', 
      rate = 1, 
      pitch = 1, 
      volume = 1 
    } = options;

    // Check if we have Deepgram API key
    if (!window.DEEPGRAM_API_KEY) {
      throw new Error('Deepgram API key is required for TTS generation');
    }

    try {
      console.log('🎤 [TTS] Generating Deepgram TTS audio:', { text, voice });

      const response = await fetch('https://api.deepgram.com/v1/speak?model=' + voice, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${window.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model: voice,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
          bit_depth: 16
        })
      });

      if (!response.ok) {
        throw new Error(`Deepgram TTS API error: ${response.status} ${response.statusText}`);
      }

      const audioArrayBuffer = await response.arrayBuffer();
      console.log('🎤 [TTS] Deepgram TTS audio generated:', { size: audioArrayBuffer.byteLength });

      return audioArrayBuffer;
    } catch (error) {
      console.error('🎤 [TTS] Deepgram TTS generation failed:', error);
      throw new Error(`Deepgram TTS generation failed: ${error.message}`);
    }
  }

  /**
   * Generate VAD test audio with silence padding
   * @param {string} text - Text to convert to speech
   * @param {Object} options - VAD test options
   * @param {number} options.onsetSilence - Silence before speech (ms)
   * @param {number} options.offsetSilence - Silence after speech (ms)
   * @param {string} options.provider - TTS provider to use
   * @returns {Promise<ArrayBuffer>} - VAD test audio data
   */
  static async generateVADTestAudio(text, options = {}) {
    const {
      onsetSilence = 300,
      offsetSilence = 1000,
      provider = 'webspeech'
    } = options;

    console.log('🎤 [TTS] Generating VAD test audio:', { text, onsetSilence, offsetSilence, provider });

    // Generate base TTS audio
    const baseAudio = await TTSGenerator.generateTTSAudio(text, { provider });

    // Add silence padding
    const paddedAudio = TTSGenerator.addSilencePadding(baseAudio, offsetSilence, onsetSilence);

    return paddedAudio;
  }

  /**
   * Add silence padding to audio data
   * @param {ArrayBuffer} audioData - Original audio data
   * @param {number} silenceMs - Silence duration in milliseconds
   * @param {number} onsetSilenceMs - Onset silence duration in milliseconds
   * @returns {ArrayBuffer} - Audio data with silence padding
   */
  static addSilencePadding(audioData, silenceMs, onsetSilenceMs = 300) {
    const sampleRate = 16000; // Deepgram standard
    const onsetSamples = Math.floor((onsetSilenceMs / 1000) * sampleRate);
    const offsetSamples = Math.floor((silenceMs / 1000) * sampleRate);
    
    // Create new buffer with silence padding
    const totalSamples = onsetSamples + (audioData.byteLength / 2) + offsetSamples;
    const paddedBuffer = new ArrayBuffer(totalSamples * 2);
    const paddedView = new Int16Array(paddedBuffer);
    const originalView = new Int16Array(audioData);
    
    // Fill onset silence (zeros)
    for (let i = 0; i < onsetSamples; i++) {
      paddedView[i] = 0;
    }
    
    // Copy original audio
    for (let i = 0; i < originalView.length; i++) {
      paddedView[onsetSamples + i] = originalView[i];
    }
    
    // Fill offset silence (zeros)
    for (let i = 0; i < offsetSamples; i++) {
      paddedView[onsetSamples + originalView.length + i] = 0;
    }
    
    console.log('🔇 [TTS] Added silence padding:', {
      onsetSilenceMs,
      offsetSilenceMs: silenceMs,
      totalSamples: totalSamples,
      originalSamples: originalView.length
    });
    
    return paddedBuffer;
  }

  /**
   * Convert audio data to PCM format
   * @param {Float32Array} audioData - Audio data to convert
   * @param {number} sourceSampleRate - Source sample rate
   * @param {number} targetSampleRate - Target sample rate (default: 16000)
   * @param {number} targetBitDepth - Target bit depth (default: 16)
   * @returns {ArrayBuffer} - PCM audio data
   */
  static convertToPCM(audioData, sourceSampleRate, targetSampleRate = 16000, targetBitDepth = 16) {
    // Simple resampling (linear interpolation)
    const ratio = sourceSampleRate / targetSampleRate;
    const targetLength = Math.floor(audioData.length / ratio);
    const resampledData = new Float32Array(targetLength);
    
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < audioData.length) {
        resampledData[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        resampledData[i] = audioData[index] || 0;
      }
    }
    
    // Convert to 16-bit PCM
    const pcmBuffer = new ArrayBuffer(resampledData.length * 2);
    const pcmView = new Int16Array(pcmBuffer);
    
    for (let i = 0; i < resampledData.length; i++) {
      pcmView[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32767));
    }
    
    console.log('🔄 [TTS] Converted to PCM:', {
      sourceSampleRate,
      targetSampleRate,
      sourceLength: audioData.length,
      targetLength: resampledData.length,
      bitDepth: targetBitDepth
    });
    
    return pcmBuffer;
  }

  /**
   * Get available TTS providers
   * @returns {string[]} - Array of available providers
   */
  static getAvailableProviders() {
    const providers = [];
    
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        providers.push('webspeech');
      }
      if (window.DEEPGRAM_API_KEY) {
        providers.push('deepgram');
      }
    }
    
    return providers;
  }

  /**
   * Get available voices for a provider
   * @param {string} provider - TTS provider
   * @returns {Promise<string[]>} - Array of available voice names
   */
  static async getAvailableVoices(provider = 'webspeech') {
    if (provider === 'webspeech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return new Promise((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          resolve(voices.map(v => v.name));
        } else {
          speechSynthesis.onvoiceschanged = () => {
            const voices = speechSynthesis.getVoices();
            resolve(voices.map(v => v.name));
          };
        }
      });
    } else if (provider === 'deepgram') {
      // Deepgram TTS voices
      return [
        'aura-asteria-en',
        'aura-luna-en',
        'aura-stella-en',
        'aura-athena-en',
        'aura-hera-en',
        'aura-orion-en',
        'aura-arcas-en',
        'aura-perseus-en',
        'aura-angus-en',
        'aura-orpheus-en',
        'aura-helios-en',
        'aura-zeus-en'
      ];
    }
    
    return [];
  }
}

module.exports = TTSGenerator;