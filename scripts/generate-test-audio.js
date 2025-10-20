#!/usr/bin/env node

/**
 * Generate TTS audio samples for testing using Deepgram TTS REST API
 * This script runs in Node.js and generates audio files that can be used by the tests
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Test phrases to generate
const TEST_PHRASES = [
  'Hello, how are you today?',
  'Hello',
  'Hello there',
  'This is a custom test phrase for dynamic generation',
  'Quick response',
  'Long pause response',
  'Realistic speech test'
];

// Deepgram TTS configuration
const DEEPGRAM_CONFIG = {
  apiKey: process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY,
  baseUrl: 'https://api.deepgram.com/v1/speak',
  voice: 'aura-2-apollo-en', // Default voice for testing
  model: 'aura-2-apollo-en',
  encoding: 'linear16',
  sampleRate: 16000,
  channels: 1
};

/**
 * Generate TTS audio using Deepgram REST API
 * @param {string} text - Text to convert to speech
 * @param {Object} options - TTS options
 * @returns {Promise<Buffer>} - Audio data as Buffer
 */
async function generateTTSAudio(text, options = {}) {
  const {
    voice = DEEPGRAM_CONFIG.voice,
    model = DEEPGRAM_CONFIG.model,
    encoding = DEEPGRAM_CONFIG.encoding,
    sampleRate = DEEPGRAM_CONFIG.sampleRate
  } = options;

  if (!DEEPGRAM_CONFIG.apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required');
  }

  const requestBody = {
    text
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      voice,
      encoding,
      sample_rate: sampleRate.toString()
    });
    
    const options = {
      hostname: 'api.deepgram.com',
      port: 443,
      path: `/v1/speak?${queryParams}`,
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', (chunk) => {
          errorBody += chunk;
        });
        res.on('end', () => {
          reject(new Error(`Deepgram TTS API error: ${res.statusCode} ${res.statusMessage}\nResponse: ${errorBody}`));
        });
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const audioBuffer = Buffer.concat(chunks);
        resolve(audioBuffer);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Add silence padding to audio buffer
 * @param {Buffer} audioBuffer - Original audio buffer
 * @param {number} onsetSilenceMs - Silence before speech (ms)
 * @param {number} offsetSilenceMs - Silence after speech (ms)
 * @param {number} sampleRate - Audio sample rate
 * @returns {Buffer} - Audio buffer with silence padding
 */
function addSilencePadding(audioBuffer, onsetSilenceMs = 300, offsetSilenceMs = 1000, sampleRate = 16000) {
  const bytesPerSample = 2; // 16-bit audio
  const onsetSamples = Math.floor((onsetSilenceMs / 1000) * sampleRate);
  const offsetSamples = Math.floor((offsetSilenceMs / 1000) * sampleRate);
  
  const silenceBuffer = Buffer.alloc((onsetSamples + offsetSamples) * bytesPerSample, 0);
  
  return Buffer.concat([silenceBuffer.slice(0, onsetSamples * bytesPerSample), audioBuffer, silenceBuffer.slice(0, offsetSamples * bytesPerSample)]);
}

/**
 * Generate audio samples for all test phrases
 */
async function generateAllSamples() {
  console.log('🎤 Generating TTS audio samples using Deepgram API...');
  
  if (!DEEPGRAM_CONFIG.apiKey) {
    console.error('❌ Deepgram API key is required');
    console.error('   Set it with: export DEEPGRAM_API_KEY=your-api-key-here');
    console.error('   Or: export VITE_DEEPGRAM_API_KEY=your-api-key-here');
    process.exit(1);
  }
  
  const outputDir = path.join(__dirname, '..', 'tests', 'fixtures', 'audio-samples');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const samples = {};
  
  for (const phrase of TEST_PHRASES) {
    console.log(`🎤 Generating TTS sample for: "${phrase}"`);
    
    try {
      // Generate TTS audio using Deepgram API
      const ttsAudio = await generateTTSAudio(phrase, {
        voice: DEEPGRAM_CONFIG.voice,
        model: DEEPGRAM_CONFIG.model
      });
      
      // Add silence padding for VAD testing (2000ms to exceed utterance_end_ms threshold)
      const paddedAudio = addSilencePadding(ttsAudio, 300, 2000, DEEPGRAM_CONFIG.sampleRate);
      
      const filename = `sample_${phrase.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.json`;
      const filepath = path.join(outputDir, filename);
      
      // Convert to base64 for JSON storage
      const base64 = paddedAudio.toString('base64');
      
      const sampleData = {
        phrase,
        audioData: base64,
        metadata: {
          phrase,
          sampleRate: DEEPGRAM_CONFIG.sampleRate,
          channels: DEEPGRAM_CONFIG.channels,
          encoding: DEEPGRAM_CONFIG.encoding,
          voice: DEEPGRAM_CONFIG.voice,
          model: DEEPGRAM_CONFIG.model,
          totalDuration: paddedAudio.length / (DEEPGRAM_CONFIG.sampleRate * 2), // 16-bit = 2 bytes per sample
          onsetSilence: 300,
          offsetSilence: 2000,
          totalSamples: paddedAudio.length / 2, // 16-bit = 2 bytes per sample
          onsetSamples: Math.floor((300 / 1000) * DEEPGRAM_CONFIG.sampleRate),
          speechSamples: ttsAudio.length / 2,
          offsetSamples: Math.floor((2000 / 1000) * DEEPGRAM_CONFIG.sampleRate)
        }
      };
      
      fs.writeFileSync(filepath, JSON.stringify(sampleData, null, 2));
      samples[phrase] = sampleData;
      
      console.log(`✅ Generated: ${filename} (${paddedAudio.length} bytes)`);
    } catch (error) {
      console.error(`❌ Failed to generate sample for "${phrase}":`, error.message);
      throw error; // Fail fast - no fallbacks
    }
  }
  
  // Generate index file
  const indexFile = path.join(outputDir, 'index.json');
  fs.writeFileSync(indexFile, JSON.stringify(samples, null, 2));
  
  console.log(`✅ Generated ${TEST_PHRASES.length} TTS audio samples using Deepgram API`);
  console.log(`📁 Samples saved to: ${outputDir}`);
  console.log(`📄 Index file: ${indexFile}`);
}

// Run the generation
if (require.main === module) {
  generateAllSamples().catch(console.error);
}

module.exports = {
  generateAllSamples,
  TEST_PHRASES
};
