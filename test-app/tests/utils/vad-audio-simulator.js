/**
 * VAD Audio Simulator for Realistic Testing
 * 
 * This module provides utilities for simulating realistic speech patterns
 * with proper silence padding to trigger VAD events in tests.
 * 
 * Key Features:
 * - Speech + silence simulation for VAD testing
 * - Audio sample library management
 * - Dynamic sample generation and caching
 * - Integration with existing test infrastructure
 */

import TTSGenerator from './tts-generator.js';
import AudioFileLoader from './audio-file-loader.js';
import fs from 'fs';
import path from 'path';

class VADAudioSimulator {
  constructor() {
    this.sampleCache = new Map();
    this.samplesDir = path.join(__dirname, '../fixtures/audio-samples');
    this.samplesConfigPath = path.join(this.samplesDir, 'samples.json');
    
    // Ensure samples directory exists
    this.ensureSamplesDirectory();
  }

  /**
   * Ensure the audio samples directory exists
   */
  ensureSamplesDirectory() {
    if (!fs.existsSync(this.samplesDir)) {
      fs.mkdirSync(this.samplesDir, { recursive: true });
      console.log('📁 [VAD] Created audio samples directory:', this.samplesDir);
    }
  }

  /**
   * Simulate speech with silence for VAD testing
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {string} phrase - Text to speak
   * @param {Object} options - Simulation options
   * @param {number} options.silenceDuration - Silence duration in ms (default: 1000)
   * @param {number} options.onsetSilence - Initial silence in ms (default: 300)
   * @param {boolean} options.generateNew - Force generation of new sample
   * @param {string} options.sampleName - Use specific sample from library
   * @returns {Promise<void>}
   */
  static async simulateSpeechWithSilence(page, phrase, options = {}) {
    const {
      silenceDuration = 1000,
      onsetSilence = 300,
      generateNew = false,
      sampleName = null
    } = options;

    // Create simple audio data that will trigger VAD events (in Node.js context)
    console.log('🔧 [VAD] Creating audio data in Node.js context:', { phrase, silenceDuration, onsetSilence });
    
    const sampleRate = 16000;
    const speechDuration = Math.max(1000, phrase.length * 100); // Estimate speech duration
    const totalDuration = onsetSilence + speechDuration + silenceDuration;
    const totalSamples = Math.floor((totalDuration / 1000) * sampleRate);
    
    console.log('🔧 [VAD] Audio parameters:', { sampleRate, speechDuration, totalDuration, totalSamples });
    
    const audioBuffer = new ArrayBuffer(totalSamples * 2); // 16-bit PCM
    const audioView = new Int16Array(audioBuffer);
    
    // Fill with silence, then speech pattern, then silence
    const onsetSamples = Math.floor((onsetSilence / 1000) * sampleRate);
    const speechSamples = Math.floor((speechDuration / 1000) * sampleRate);
    
    console.log('🔧 [VAD] Sample ranges:', { onsetSamples, speechSamples, totalSamples });
    
    for (let i = 0; i < totalSamples; i++) {
      if (i < onsetSamples || i >= onsetSamples + speechSamples) {
        // Silence periods
        audioView[i] = 0;
      } else {
        // Speech period - use a sine wave pattern that should trigger VAD
        const speechIndex = i - onsetSamples;
        const frequency = 440 + (speechIndex % 200); // Varying frequency
        const amplitude = 8000; // Strong enough to trigger VAD
        const sample = Math.sin(2 * Math.PI * frequency * speechIndex / sampleRate) * amplitude;
        audioView[i] = Math.floor(sample);
      }
    }
    
    const audioData = audioBuffer;
    
    console.log('🔧 [VAD] Created simple audio pattern:', {
      phrase,
      totalDuration,
      totalSamples,
      onsetSamples,
      speechSamples,
      audioBufferSize: audioData.byteLength
    });

    console.log('🔧 [VAD] Audio data received from browser context:', {
      audioDataSize: audioData ? audioData.byteLength : 'undefined',
      audioDataType: typeof audioData
    });

    // Convert ArrayBuffer to Uint8Array for serialization
    const audioBytes = new Uint8Array(audioData);
    
    // Send audio data to Deepgram component
    await page.evaluate((audioBytes) => {
      // Convert back to ArrayBuffer in browser context
      const audioData = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength);
      
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log('🎤 [VAD] Sending audio data to Deepgram component, size:', audioData ? audioData.byteLength : 'undefined');
        console.log('🎤 [VAD] Audio data type:', typeof audioData, 'is ArrayBuffer:', audioData instanceof ArrayBuffer);
        console.log('🎤 [VAD] First few bytes:', new Uint8Array(audioData.slice(0, 10)));
        deepgramComponent.sendAudioData(audioData);
        console.log('🎤 [VAD] Audio data sent successfully');
      } else {
        console.warn('🎤 [VAD] DeepgramVoiceInteraction not found or sendAudioData not available');
        console.warn('🎤 [VAD] deepgramRef:', !!window.deepgramRef);
        console.warn('🎤 [VAD] deepgramRef.current:', !!window.deepgramRef?.current);
        if (window.deepgramRef?.current) {
          console.warn('🎤 [VAD] Available methods:', Object.keys(window.deepgramRef.current));
        }
      }
    }, audioBytes);

    console.log('🎤 [VAD] Simulated speech:', {
      phrase,
      silenceDuration,
      onsetSilence,
      audioSize: audioData.byteLength
    });
  }

  /**
   * Load audio sample from library
   * @param {string} sampleName - Name of the sample
   * @param {Object} options - Loading options
   * @param {boolean} options.usePreRecorded - Use pre-recorded WAV file if available
   * @returns {Promise<ArrayBuffer>} - Audio data
   */
  static async loadAudioSample(sampleName, options = {}) {
    const { usePreRecorded = true } = options;
    const samplesDir = path.join(__dirname, '../fixtures/audio-samples');
    const samplePath = path.join(samplesDir, `${sampleName}.wav`);
    
    // Try to load pre-recorded WAV file first
    if (usePreRecorded && fs.existsSync(samplePath)) {
      try {
        console.log('🎵 [VAD] Loading pre-recorded audio sample:', sampleName);
        return await AudioFileLoader.createVADSample(samplePath, {
          onsetSilence: 300,
          offsetSilence: 1000
        });
      } catch (error) {
        console.warn('⚠️ [VAD] Failed to load pre-recorded sample, falling back to TTS:', error.message);
      }
    }

    // Fallback to TTS generation
    console.log('🎤 [VAD] Generating TTS sample:', sampleName);
    const config = await VADAudioSimulator.loadSamplesConfig();
    const sampleConfig = config[sampleName];
    
    if (!sampleConfig) {
      throw new Error(`Sample configuration not found: ${sampleName}`);
    }

    return await VADAudioSimulator.generateAndCacheSample(
      sampleConfig.text,
      sampleConfig.offsetSilenceDuration
    );
  }

  /**
   * Generate and cache new audio sample
   * @param {string} phrase - Text to generate
   * @param {number} silenceMs - Silence duration
   * @returns {Promise<ArrayBuffer>} - Generated audio data
   */
  static async generateAndCacheSample(phrase, silenceMs) {
    console.log('🎤 [VAD] Generating new audio sample:', { phrase, silenceMs });
    
    try {
      const audioData = await TTSGenerator.generateVADTestAudio(phrase, {
        offsetSilence: silenceMs,
        onsetSilence: 300
      });

      // Cache the sample
      if (!VADAudioSimulator.sampleCache) {
        VADAudioSimulator.sampleCache = new Map();
      }
      VADAudioSimulator.sampleCache.set(phrase, audioData);

      return audioData;
    } catch (error) {
      console.warn('⚠️ [VAD] TTS generation failed, using fallback audio:', error.message);
      
      // Fallback: Create a simple audio buffer with silence padding
      const fallbackAudio = VADAudioSimulator.createFallbackAudio(phrase, silenceMs);
      
      // Cache the fallback sample
      if (!VADAudioSimulator.sampleCache) {
        VADAudioSimulator.sampleCache = new Map();
      }
      VADAudioSimulator.sampleCache.set(phrase, fallbackAudio);

      return fallbackAudio;
    }
  }

  /**
   * Create fallback audio when TTS is not available
   * @param {string} phrase - Text phrase (for timing estimation)
   * @param {number} silenceMs - Silence duration
   * @returns {ArrayBuffer} - Fallback audio data
   */
  static createFallbackAudio(phrase, silenceMs) {
    // Estimate speech duration based on phrase length (roughly 150ms per word)
    const words = phrase.split(' ').length;
    const estimatedSpeechMs = Math.max(500, words * 150);
    
    // Calculate total duration including silence padding
    const totalDurationMs = 300 + estimatedSpeechMs + silenceMs; // onset + speech + offset
    const sampleRate = 16000;
    const totalSamples = Math.floor((totalDurationMs / 1000) * sampleRate);
    
    // Create audio buffer with some variation to simulate speech
    const audioBuffer = new ArrayBuffer(totalSamples * 2); // 16-bit = 2 bytes per sample
    const audioView = new Int16Array(audioBuffer);
    
    // Fill with low-level noise to simulate speech
    for (let i = 0; i < totalSamples; i++) {
      // Add some variation to simulate speech patterns
      const speechStart = Math.floor((300 / 1000) * sampleRate);
      const speechEnd = speechStart + Math.floor((estimatedSpeechMs / 1000) * sampleRate);
      
      if (i >= speechStart && i < speechEnd) {
        // Generate some variation during "speech" period
        audioView[i] = Math.floor((Math.random() - 0.5) * 1000);
      } else {
        // Silence for onset and offset periods
        audioView[i] = 0;
      }
    }
    
    console.log('🔧 [VAD] Created fallback audio:', {
      phrase,
      estimatedSpeechMs,
      silenceMs,
      totalDurationMs,
      totalSamples
    });
    
    return audioBuffer;
  }

  /**
   * Load samples configuration
   * @returns {Promise<Object>} - Samples configuration
   */
  static async loadSamplesConfig() {
    const configPath = path.join(__dirname, '../fixtures/audio-samples/samples.json');
    
    if (!fs.existsSync(configPath)) {
      // Return default configuration
      return {
        "hello": {
          "text": "Hello",
          "speechDuration": 1000,
          "onsetSilenceDuration": 300,
          "offsetSilenceDuration": 1000,
          "description": "Simple greeting"
        },
        "wait-one-moment": {
          "text": "Wait one moment",
          "speechDuration": 2000,
          "onsetSilenceDuration": 300,
          "offsetSilenceDuration": 1000,
          "description": "Pause request"
        },
        "thank-you": {
          "text": "Thank you",
          "speechDuration": 1000,
          "onsetSilenceDuration": 300,
          "offsetSilenceDuration": 1000,
          "description": "Polite acknowledgment"
        },
        "what-can-you-do": {
          "text": "What can you do?",
          "speechDuration": 2000,
          "onsetSilenceDuration": 300,
          "offsetSilenceDuration": 1000,
          "description": "Capability inquiry"
        }
      };
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  }

  /**
   * Create audio sample library
   * @returns {Promise<void>}
   */
  static async createAudioSampleLibrary() {
    const samplesDir = path.join(__dirname, '../fixtures/audio-samples');
    const configPath = path.join(samplesDir, 'samples.json');
    
    // Ensure directory exists
    if (!fs.existsSync(samplesDir)) {
      fs.mkdirSync(samplesDir, { recursive: true });
    }

    // Load or create configuration
    const config = await VADAudioSimulator.loadSamplesConfig();
    
    // Save configuration
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('📁 [VAD] Created audio samples configuration:', configPath);

    // Generate samples for each configuration
    for (const [sampleName, sampleConfig] of Object.entries(config)) {
      try {
        console.log(`🎤 [VAD] Generating sample: ${sampleName}`);
        const audioData = await TTSGenerator.generateVADTestAudio(sampleConfig.text, {
          offsetSilence: sampleConfig.offsetSilenceDuration,
          onsetSilence: sampleConfig.onsetSilenceDuration
        });
        
        // In a full implementation, you'd save as WAV file
        // For now, we'll just cache it
        if (!VADAudioSimulator.sampleCache) {
          VADAudioSimulator.sampleCache = new Map();
        }
        VADAudioSimulator.sampleCache.set(sampleName, audioData);
        
        console.log(`✅ [VAD] Generated sample: ${sampleName}`);
      } catch (error) {
        console.error(`❌ [VAD] Failed to generate sample ${sampleName}:`, error);
      }
    }
  }

  /**
   * Clear sample cache
   */
  static clearCache() {
    if (VADAudioSimulator.sampleCache) {
      VADAudioSimulator.sampleCache.clear();
      console.log('🗑️ [VAD] Cleared sample cache');
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  static getCacheStats() {
    if (!VADAudioSimulator.sampleCache) {
      return { size: 0, samples: [] };
    }

    return {
      size: VADAudioSimulator.sampleCache.size,
      samples: Array.from(VADAudioSimulator.sampleCache.keys())
    };
  }

  /**
   * Simulate realistic user conversation pattern
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {Array} phrases - Array of phrases to speak
   * @param {Object} options - Simulation options
   * @param {number} options.pauseBetween - Pause between phrases in ms
   * @param {number} options.silenceDuration - Silence after each phrase
   * @returns {Promise<void>}
   */
  static async simulateConversation(page, phrases, options = {}) {
    const {
      pauseBetween = 2000,
      silenceDuration = 1000
    } = options;

    console.log('🗣️ [VAD] Starting conversation simulation:', phrases);

    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i];
      
      // Simulate speech
      await VADAudioSimulator.simulateSpeechWithSilence(page, phrase, {
        silenceDuration
      });

      // Wait between phrases (except for the last one)
      if (i < phrases.length - 1) {
        await page.waitForTimeout(pauseBetween);
      }
    }

    console.log('✅ [VAD] Conversation simulation completed');
  }

  /**
   * Simulate streaming audio for more realistic VAD testing
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {string} phrase - Text to speak
   * @param {Object} options - Streaming options
   * @param {number} options.chunkSize - Size of each audio chunk in bytes
   * @param {number} options.chunkInterval - Interval between chunks in ms
   * @param {number} options.silenceDuration - Silence after speech
   * @param {boolean} options.usePreRecorded - Use pre-recorded audio if available
   * @returns {Promise<void>}
   */
  static async simulateStreamingAudio(page, phrase, options = {}) {
    const {
      chunkSize = 4096,
      chunkInterval = 100,
      silenceDuration = 1000,
      usePreRecorded = true
    } = options;

    console.log('🌊 [VAD] Starting streaming audio simulation:', {
      phrase,
      chunkSize,
      chunkInterval,
      silenceDuration
    });

    // Get audio data
    let audioData;
    if (usePreRecorded) {
      try {
        audioData = await VADAudioSimulator.loadAudioSample(phrase, { usePreRecorded: true });
      } catch (error) {
        console.log('🔄 [VAD] Falling back to TTS generation for streaming');
        audioData = await VADAudioSimulator.generateAndCacheSample(phrase, silenceDuration);
      }
    } else {
      audioData = await VADAudioSimulator.generateAndCacheSample(phrase, silenceDuration);
    }

    // Split into chunks
    const chunks = AudioFileLoader.splitIntoChunks(audioData, chunkSize);
    
    // Stream chunks to Deepgram component
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await page.evaluate((audioChunk) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (deepgramComponent && deepgramComponent.sendAudioData) {
          deepgramComponent.sendAudioData(audioChunk);
        }
      }, chunk);

      // Wait between chunks (except for the last one)
      if (i < chunks.length - 1) {
        await page.waitForTimeout(chunkInterval);
      }
    }

    console.log('✅ [VAD] Streaming audio simulation completed');
  }

  /**
   * Simulate realistic speech with natural pauses and variations
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {string} phrase - Text to speak
   * @param {Object} options - Natural speech options
   * @param {number} options.pauseProbability - Probability of adding pauses (0-1)
   * @param {number} options.maxPauseDuration - Maximum pause duration in ms
   * @param {number} options.silenceDuration - Silence after speech
   * @returns {Promise<void>}
   */
  static async simulateNaturalSpeech(page, phrase, options = {}) {
    const {
      pauseProbability = 0.3,
      maxPauseDuration = 500,
      silenceDuration = 1000
    } = options;

    console.log('🗣️ [VAD] Starting natural speech simulation:', {
      phrase,
      pauseProbability,
      maxPauseDuration
    });

    // Split phrase into words for natural pauses
    const words = phrase.split(' ');
    const chunks = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Generate audio for this word
      const wordAudio = await VADAudioSimulator.generateAndCacheSample(word, 0);
      chunks.push(wordAudio);
      
      // Add natural pause between words (except for the last word)
      if (i < words.length - 1 && Math.random() < pauseProbability) {
        const pauseDuration = Math.random() * maxPauseDuration;
        const pauseAudio = new ArrayBuffer(Math.floor((pauseDuration / 1000) * 16000 * 2)); // 16kHz, 16-bit
        chunks.push(pauseAudio);
      }
    }

    // Stream all chunks
    for (const chunk of chunks) {
      await page.evaluate((audioChunk) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (deepgramComponent && deepgramComponent.sendAudioData) {
          deepgramComponent.sendAudioData(audioChunk);
        }
      }, chunk);
      
      // Small delay between chunks
      await page.waitForTimeout(50);
    }

    // Add final silence
    const finalSilence = new ArrayBuffer(Math.floor((silenceDuration / 1000) * 16000 * 2));
    await page.evaluate((audioChunk) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        deepgramComponent.sendAudioData(audioChunk);
      }
    }, finalSilence);

    console.log('✅ [VAD] Natural speech simulation completed');
  }
}

// Initialize static cache
VADAudioSimulator.sampleCache = new Map();

export default VADAudioSimulator;
