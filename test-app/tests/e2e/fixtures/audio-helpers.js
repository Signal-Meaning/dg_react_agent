/**
 * Audio testing fixtures and helpers
 * 
 * Provides reusable utilities for loading and sending audio samples in tests.
 * These fixtures simplify audio testing by encapsulating common patterns.
 * 
 * This is the DRY, canonical implementation for audio testing.
 * All tests should use these fixtures instead of duplicate implementations.
 * 
 * The helpers automatically handle:
 * - Format detection (WAV vs JSON)
 * - PCM extraction from WAV files
 * - Real-time streaming for better interim transcript generation
 */

/** 20 ms of audio at 16 kHz 16-bit mono (OpenAI Realtime Eval recommendation). Use for Realtime API tests. */
export const CHUNK_20MS_16K_MONO = 640;

/** 20 ms of audio at 24 kHz 16-bit mono. Use for OpenAI proxy VAD E2E (session default input is 24 kHz). */
export const CHUNK_20MS_24K_MONO = 960;

/**
 * Load and send an audio sample to the Deepgram component
 * Streams audio in real-time chunks to simulate live microphone input.
 * This produces better interim transcripts and more realistic behavior.
 * Automatically handles WAV and JSON formats.
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sampleName - Name of the audio sample (without format extension)
 * @param {Object} options - Streaming options
 * @param {number} options.sampleRate - Audio sample rate (default: 16000)
 * @param {number} options.bytesPerSample - Bytes per sample (default: 2 for 16-bit)
 * @param {number} options.channels - Number of channels (default: 1 for mono)
 * @param {number} options.chunkSize - Size of each chunk in bytes (default: 4096)
 * @returns {Promise<void>}
 */
export async function loadAndSendAudioSample(page, sampleName, options = {}) {
  await page.evaluate(async ({ sample, streamOptions }) => {
    // Define helper functions in browser context
    async function loadAudioSample(sampleName) {
      let audioBuffer;
      
      // Try to load WAV file first (preferred for realistic interim transcripts)
      try {
        const wavResponse = await fetch(`/audio-samples/${sampleName}.wav`);
        if (wavResponse.ok) {
          console.log(`🎵 [AUDIO] Loading WAV file: ${sampleName}.wav`);
          const wavBlob = await wavResponse.blob();
          const wavArrayBuffer = await wavBlob.arrayBuffer();
          console.log(`✅ [AUDIO] Loaded WAV file: ${wavArrayBuffer.byteLength} bytes`);
          
          // Extract PCM data from WAV file (skip WAV header)
          const wavView = new Uint8Array(wavArrayBuffer);
          
          // Find the 'data' chunk (starts with 'data' at offset 36 or later)
          let dataOffset = 44; // Standard WAV header size
          let dataSize = 0;
          let foundData = false;
          
          // Search for 'data' chunk marker (more robust than assuming 44-byte header)
          for (let i = 36; i < wavView.length - 4; i++) {
            if (String.fromCharCode(wavView[i], wavView[i+1], wavView[i+2], wavView[i+3]) === 'data') {
              // Read the data chunk size (4 bytes after 'data' marker, little-endian)
              const sizeView = new DataView(wavArrayBuffer, i + 4, 4);
              dataSize = sizeView.getUint32(0, true); // true = little-endian
              dataOffset = i + 8; // Skip 'data' marker (4 bytes) and size field (4 bytes)
              foundData = true;
              break;
            }
          }
          
          if (!foundData) {
            // Fallback: assume standard 44-byte header and use remaining file size
            console.log('⚠️ [AUDIO] Could not find data chunk, assuming 44-byte header');
            dataOffset = 44;
            dataSize = wavArrayBuffer.byteLength - dataOffset;
          }
          
          // Extract exactly the PCM audio data
          if (dataSize > 0) {
            audioBuffer = wavArrayBuffer.slice(dataOffset, dataOffset + dataSize);
            console.log(`✅ [AUDIO] Extracted PCM data: ${audioBuffer.byteLength} bytes from data chunk (skipped ${dataOffset} byte header)`);
          } else {
            // Fallback: use remaining file if data size couldn't be determined
            audioBuffer = wavArrayBuffer.slice(dataOffset);
            console.log(`✅ [AUDIO] Extracted PCM data: ${audioBuffer.byteLength} bytes (from offset ${dataOffset} to end of file)`);
          }
          
          // Validate extracted audio is reasonable (at least 1 second of audio at 16kHz 16-bit mono = 32KB)
          // Very short audio samples (< 1 second) are likely corrupted or incomplete
          const minExpectedBytes = 32000; // 1 second minimum
          if (audioBuffer.byteLength < minExpectedBytes) {
            console.log(`⚠️ [AUDIO] Extracted WAV data is too short (${audioBuffer.byteLength} bytes < ${minExpectedBytes} bytes minimum). Falling back to JSON.`);
            throw new Error(`WAV file too short, using JSON fallback`);
          }
        } else {
          throw new Error('WAV file not found, trying JSON fallback');
        }
      } catch (wavError) {
        // Fallback to JSON format (TTS-generated samples)
        console.log(`🔄 [AUDIO] WAV not available, loading JSON: ${sampleName}`);
        const jsonResponse = await fetch(`/audio-samples/sample_${sampleName}.json`);
        if (!jsonResponse.ok) {
          throw new Error(`Failed to load audio sample (tried WAV and JSON): ${jsonResponse.status}`);
        }
        
        const audioData = await jsonResponse.json();
        
        // Convert base64 to ArrayBuffer
        const binaryString = atob(audioData.audioData);
        audioBuffer = new ArrayBuffer(binaryString.length);
        const audioView = new Uint8Array(audioBuffer);
        for (let i = 0; i < binaryString.length; i++) {
          audioView[i] = binaryString.charCodeAt(i);
        }
        console.log(`✅ [AUDIO] Loaded JSON sample: ${audioBuffer.byteLength} bytes`);
      }
      
      return audioBuffer;
    }
    
    async function streamAudioInRealTime(audioBuffer, sendChunk, options = {}) {
      const {
        sampleRate = 16000,
        bytesPerSample = 2,
        channels = 1,
        chunkSize = 4096
      } = options;
      
      const bytesPerSecond = sampleRate * bytesPerSample * channels; // 32000 bytes/second for 16kHz 16-bit mono
      
      // Calculate audio duration from PCM data size
      const audioDurationSeconds = audioBuffer.byteLength / bytesPerSecond;
      console.log(`📊 [STREAMING] Audio duration: ${audioDurationSeconds.toFixed(2)}s (${audioBuffer.byteLength} bytes at ${bytesPerSecond} bytes/s)`);
      
      // Split audio into chunks
      const totalChunks = Math.ceil(audioBuffer.byteLength / chunkSize);
      
      // Calculate chunk interval to match real-time playback
      const totalTimeMs = audioDurationSeconds * 1000;
      const chunkInterval = Math.floor(totalTimeMs / totalChunks);
      
      console.log(`🌊 [STREAMING] Sending ${totalChunks} chunks of ${chunkSize} bytes each with ${chunkInterval}ms intervals (real-time: ${audioDurationSeconds.toFixed(2)}s total)...`);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, audioBuffer.byteLength);
        const chunk = audioBuffer.slice(start, end);
        
        // Send chunk
        sendChunk(chunk);
        
        // Wait between chunks (except for the last one) to simulate real-time streaming
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, chunkInterval));
        }
      }
      
      console.log(`✅ [STREAMING] Audio streaming completed: ${totalChunks} chunks sent over ${(totalChunks * chunkInterval / 1000).toFixed(2)}s (real-time)`);
    }
    
    const deepgramComponent = window.deepgramRef?.current;
    if (!deepgramComponent || !deepgramComponent.sendAudioData) {
      throw new Error('DeepgramVoiceInteraction component not available');
    }
    
    // Load audio sample (handles both WAV and JSON)
    const audioBuffer = await loadAudioSample(sample);
    
    // Stream audio in real-time chunks
    await streamAudioInRealTime(
      audioBuffer,
      (chunk) => deepgramComponent.sendAudioData(chunk),
      streamOptions
    );
  }, { sample: sampleName, streamOptions: options });
}

/**
 * Load a 16 kHz sample, resample to 24 kHz, and send to the component.
 * Use for OpenAI proxy VAD E2E: session default input is 24 kHz, so server VAD
 * (speech_started / speech_stopped) only fires when input matches. See NEXT-STEPS.md §3.5.
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sampleName - Name of the audio sample (without format extension); must be 16 kHz
 * @returns {Promise<void>}
 */
export async function loadAndSendAudioSampleAt24k(page, sampleName) {
  await page.evaluate(async ({ sample }) => {
    async function loadAudioSample(name) {
      let audioBuffer;
      try {
        const wavResponse = await fetch(`/audio-samples/${name}.wav`);
        if (wavResponse.ok) {
          const wavBlob = await wavResponse.blob();
          const wavArrayBuffer = await wavBlob.arrayBuffer();
          const wavView = new Uint8Array(wavArrayBuffer);
          let dataOffset = 44;
          let dataSize = 0;
          for (let i = 36; i < wavView.length - 4; i++) {
            if (String.fromCharCode(wavView[i], wavView[i+1], wavView[i+2], wavView[i+3]) === 'data') {
              const sizeView = new DataView(wavArrayBuffer, i + 4, 4);
              dataSize = sizeView.getUint32(0, true);
              dataOffset = i + 8;
              break;
            }
          }
          if (dataSize > 0) {
            audioBuffer = wavArrayBuffer.slice(dataOffset, dataOffset + dataSize);
          } else {
            audioBuffer = wavArrayBuffer.slice(dataOffset);
          }
          return audioBuffer;
        }
      } catch {
        // fallback to JSON
      }
      const jsonResponse = await fetch(`/audio-samples/sample_${name}.json`);
      if (!jsonResponse.ok) throw new Error(`Failed to load audio sample: ${name}`);
      const audioData = await jsonResponse.json();
      const binaryString = atob(audioData.audioData);
      audioBuffer = new ArrayBuffer(binaryString.length);
      const audioView = new Uint8Array(audioBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        audioView[i] = binaryString.charCodeAt(i);
      }
      return audioBuffer;
    }

    function resample16kTo24k(pcm16ArrayBuffer) {
      const view = new Int16Array(pcm16ArrayBuffer);
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
      return out.buffer;
    }

    async function streamAudioInRealTime(audioBuffer, sendChunk, options = {}) {
      const { sampleRate = 24000, bytesPerSample = 2, channels = 1, chunkSize = 960 } = options;
      const bytesPerSecond = sampleRate * bytesPerSample * channels;
      const audioDurationSeconds = audioBuffer.byteLength / bytesPerSecond;
      const totalChunks = Math.ceil(audioBuffer.byteLength / chunkSize);
      const totalTimeMs = audioDurationSeconds * 1000;
      const chunkInterval = Math.floor(totalTimeMs / totalChunks);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, audioBuffer.byteLength);
        sendChunk(audioBuffer.slice(start, end));
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, chunkInterval));
        }
      }
    }

    const deepgramComponent = window.deepgramRef?.current;
    if (!deepgramComponent || !deepgramComponent.sendAudioData) {
      throw new Error('DeepgramVoiceInteraction component not available');
    }
    const buffer16k = await loadAudioSample(sample);
    const buffer24k = resample16kTo24k(buffer16k);
    await streamAudioInRealTime(
      buffer24k,
      (chunk) => deepgramComponent.sendAudioData(chunk),
      { sampleRate: 24000, bytesPerSample: 2, channels: 1, chunkSize: 960 }
    );
  }, { sample: sampleName });
}

/**
 * Wait for VAD events to be detected by checking data-testid elements
 * 
 * This is the DRY, canonical implementation for VAD event detection.
 * All tests should use this instead of duplicate implementations.
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<string>} eventTypes - Event types to check (e.g., ['UserStartedSpeaking', 'UtteranceEnd', 'UserStoppedSpeaking'])
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise<number>} Number of events detected
 */
export async function waitForVADEvents(page, eventTypes = ['UserStartedSpeaking', 'UtteranceEnd'], timeout = 5000) {
  const vadSelectors = {
    'UserStartedSpeaking': '[data-testid="user-started-speaking"]',
    'UtteranceEnd': '[data-testid="utterance-end"]',
    'UserStoppedSpeaking': '[data-testid="user-stopped-speaking"]',
  };

  const startTime = Date.now();
  const detectedEventTypes = new Set();

  while (Date.now() - startTime < timeout) {
    for (const eventType of eventTypes) {
      const selector = vadSelectors[eventType];
      if (!selector) continue;

      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          const value = (await element.textContent())?.trim() || '';
          if (value && value !== 'Not detected') {
            detectedEventTypes.add(eventType);
          }
        }
      } catch {
        // Element might not exist yet, continue
      }
    }

    // If we detected at least one event, that's sufficient (don't wait for all)
    if (detectedEventTypes.size > 0) {
      break;
    }

    await page.waitForTimeout(200);
  }

  return detectedEventTypes.size;
}

