/**
 * Audio Simulator for Deepgram Voice Interaction Testing
 * 
 * This module provides realistic audio simulation for testing voice interactions
 * with the Deepgram Voice Agent. It generates audio that mimics human speech
 * patterns for comprehensive testing scenarios.
 * 
 * Key Features:
 * - Deepgram TTS integration for realistic speech generation
 * - Realistic speech timing and patterns
 * - Audio format conversion for Deepgram compatibility
 * - Error handling without fallback audio
 */

const TTSGenerator = require('./tts-generator');
const AudioFileLoader = require('./audio-file-loader');
const fs = require('fs');
const path = require('path');

class AudioSimulator {
  static sampleCache = new Map();
  
  constructor() {
    this.sampleCache = new Map();
  }

  /**
   * Simulate realistic speech with silence padding
   * @param {import('@playwright/test').Page} page - Playwright page instance
   * @param {string} phrase - Text to speak
   * @param {Object} options - Simulation options
   * @param {number} options.silenceDuration - Silence duration after speech (ms)
   * @param {number} options.onsetSilence - Silence duration before speech (ms)
   * @param {string} options.sampleName - Use pre-recorded sample instead of TTS
   * @param {boolean} options.usePreRecorded - Whether to use pre-recorded audio
   * @param {boolean} options.generateNew - Force generation of new sample
   */
  static async simulateSpeech(page, phrase, options = {}) {
    const {
      silenceDuration = 1000,
      onsetSilence = 300,
      sampleName = null,
      usePreRecorded = true,
      generateNew = false
    } = options;

    console.log('🎤 [Audio] Simulating speech:', { phrase, silenceDuration, onsetSilence });

    let audioData;

    if (sampleName) {
      // Use pre-recorded sample from library
      audioData = await AudioSimulator.loadAudioSample(sampleName);
    } else if (generateNew || !AudioSimulator.sampleCache.has(phrase)) {
      // Generate new sample using Deepgram TTS
      audioData = await AudioSimulator.generateAndCacheSample(phrase, silenceDuration);
    } else {
      // Use cached sample
      audioData = AudioSimulator.sampleCache.get(phrase);
    }

    // Send audio data to Deepgram component
    await page.evaluate((audioData) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log('🎤 [Audio] Sending audio data to Deepgram component');
        deepgramComponent.sendAudioData(audioData);
      } else {
        console.warn('🎤 [Audio] DeepgramVoiceInteraction not found or sendAudioData not available');
      }
    }, audioData);

    console.log('🎤 [Audio] Simulated speech:', {
      phrase,
      silenceDuration,
      onsetSilence,
      audioSize: audioData.byteLength
    });
  }

  /**
   * Load audio sample from library or generate new one
   * @param {string} sampleName - Name of the sample to load
   * @param {Object} options - Loading options
   * @returns {Promise<ArrayBuffer>} - Audio data
   */
  static async loadAudioSample(sampleName, options = {}) {
    const { usePreRecorded = true } = options;
    const samplesDir = path.join(__dirname, '../fixtures/audio-samples');
    const samplePath = path.join(samplesDir, `${sampleName}.wav`);

    if (usePreRecorded && fs.existsSync(samplePath)) {
      try {
        console.log('🎵 [Audio] Loading pre-recorded audio sample:', sampleName);
        return await AudioFileLoader.createVADSample(samplePath, {
          onsetSilence: 300,
          offsetSilence: 1000
        });
      } catch (error) {
        console.warn('⚠️ [Audio] Failed to load pre-recorded sample, falling back to TTS:', error.message);
      }
    }

    // Fallback to TTS generation
    console.log('🎤 [Audio] Generating TTS sample:', sampleName);
    const config = await AudioSimulator.loadSamplesConfig();
    const sampleConfig = config[sampleName];

    if (!sampleConfig) {
      throw new Error(`Sample configuration not found: ${sampleName}`);
    }

    return await AudioSimulator.generateAndCacheSample(
      sampleConfig.text,
      sampleConfig.offsetSilenceDuration
    );
  }

  /**
   * Generate and cache new audio sample using Deepgram TTS
   * @param {string} phrase - Text to generate
   * @param {number} silenceMs - Silence duration
   * @returns {Promise<ArrayBuffer>} - Generated audio data
   */
  static async generateAndCacheSample(phrase, silenceMs) {
    console.log('🎤 [Audio] Generating new audio sample:', { phrase, silenceMs });
    
    try {
      const audioData = await TTSGenerator.generateVADTestAudio(phrase, {
        offsetSilence: silenceMs,
        onsetSilence: 300
      });

      // Cache the sample
      if (!AudioSimulator.sampleCache) {
        AudioSimulator.sampleCache = new Map();
      }
      AudioSimulator.sampleCache.set(phrase, audioData);

      return audioData;
    } catch (error) {
      // Throw error instead of using fallback
      throw new Error(`Audio generation failed: ${error.message}`);
    }
  }

  /**
   * Load samples configuration
   * @returns {Promise<Object>} - Samples configuration
   */
  static async loadSamplesConfig() {
    const configPath = path.join(__dirname, '../fixtures/audio-samples/samples.json');
    
    try {
      const configData = await fs.promises.readFile(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to load samples configuration: ${error.message}`);
    }
  }

  /**
   * Simulate conversation with multiple phrases
   * @param {import('@playwright/test').Page} page - Playwright page instance
   * @param {string[]} phrases - Array of phrases to speak
   * @param {Object} options - Simulation options
   */
  static async simulateConversation(page, phrases, options = {}) {
    const { pauseBetween = 2000, ...speechOptions } = options;
    
    console.log('💬 [Audio] Simulating conversation with', phrases.length, 'phrases');
    
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i];
      
      await AudioSimulator.simulateSpeech(page, phrase, speechOptions);
      
      // Pause between phrases (except for the last one)
      if (i < phrases.length - 1) {
        await page.waitForTimeout(pauseBetween);
      }
    }
  }

  /**
   * Simulate streaming audio for realistic real-time simulation
   * @param {import('@playwright/test').Page} page - Playwright page instance
   * @param {string} phrase - Text to speak
   * @param {Object} options - Streaming options
   */
  static async simulateStreamingAudio(page, phrase, options = {}) {
    const {
      chunkSize = 4096,
      chunkInterval = 100,
      silenceDuration = 1000,
      usePreRecorded = true
    } = options;

    console.log('🌊 [Audio] Simulating streaming audio:', { phrase, chunkSize, chunkInterval });

    // Generate or load audio data
    let audioData;
    if (usePreRecorded) {
      try {
        audioData = await AudioSimulator.loadAudioSample(phrase, { usePreRecorded: true });
      } catch (error) {
        console.warn('⚠️ [Audio] Pre-recorded audio not available, generating new sample');
        audioData = await AudioSimulator.generateAndCacheSample(phrase, silenceDuration);
      }
    } else {
      audioData = await AudioSimulator.generateAndCacheSample(phrase, silenceDuration);
    }

    // Split audio into chunks
    const chunks = AudioFileLoader.splitIntoChunks(audioData, chunkSize);
    
    // Send chunks with intervals
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await page.evaluate((chunkData) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (deepgramComponent && deepgramComponent.sendAudioData) {
          deepgramComponent.sendAudioData(chunkData);
        }
      }, chunk);

      // Wait between chunks (except for the last one)
      if (i < chunks.length - 1) {
        await page.waitForTimeout(chunkInterval);
      }
    }

    console.log('🌊 [Audio] Streaming simulation completed:', {
      phrase,
      totalChunks: chunks.length,
      totalDuration: chunks.length * chunkInterval
    });
  }

  /**
   * Simulate natural speech with pauses and variations
   * @param {import('@playwright/test').Page} page - Playwright page instance
   * @param {string} phrase - Text to speak
   * @param {Object} options - Natural speech options
   */
  static async simulateNaturalSpeech(page, phrase, options = {}) {
    const {
      pauseProbability = 0.3,
      maxPauseDuration = 500,
      silenceDuration = 1000
    } = options;

    console.log('🗣️ [Audio] Simulating natural speech:', { phrase, pauseProbability });

    // Split phrase into words
    const words = phrase.split(' ');
    const wordChunks = [];
    
    // Group words with potential pauses
    let currentChunk = [];
    for (let i = 0; i < words.length; i++) {
      currentChunk.push(words[i]);
      
      // Randomly add pauses between words
      if (Math.random() < pauseProbability && i < words.length - 1) {
        wordChunks.push(currentChunk.join(' '));
        currentChunk = [];
      }
    }
    
    // Add remaining words
    if (currentChunk.length > 0) {
      wordChunks.push(currentChunk.join(' '));
    }

    // Simulate each word chunk
    for (let i = 0; i < wordChunks.length; i++) {
      const chunk = wordChunks[i];
      
      await AudioSimulator.simulateSpeech(page, chunk, {
        silenceDuration: i === wordChunks.length - 1 ? silenceDuration : 0
      });
      
      // Add pause between chunks (except for the last one)
      if (i < wordChunks.length - 1) {
        const pauseDuration = Math.random() * maxPauseDuration;
        await page.waitForTimeout(pauseDuration);
      }
    }

    console.log('🗣️ [Audio] Natural speech simulation completed:', {
      phrase,
      wordChunks: wordChunks.length,
      totalWords: words.length
    });
  }

  /**
   * Clear audio sample cache
   */
  static clearCache() {
    if (AudioSimulator.sampleCache) {
      AudioSimulator.sampleCache.clear();
      console.log('🧹 [Audio] Cache cleared');
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  static getCacheStats() {
    return {
      size: AudioSimulator.sampleCache ? AudioSimulator.sampleCache.size : 0,
      samples: AudioSimulator.sampleCache ? Array.from(AudioSimulator.sampleCache.keys()) : []
    };
  }
}

module.exports = AudioSimulator;
