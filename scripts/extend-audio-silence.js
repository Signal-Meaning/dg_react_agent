#!/usr/bin/env node

/**
 * Extend silence in existing audio samples to test UtteranceEnd detection
 */

const fs = require('fs');
const path = require('path');

// Read the existing audio sample
const samplePath = path.join(__dirname, '..', 'tests', 'fixtures', 'audio-samples', 'sample_hello.json');
const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

console.log('🎵 Original audio sample metadata:');
console.log('  Phrase:', sampleData.metadata.phrase);
console.log('  Total duration:', sampleData.metadata.totalDuration, 'ms');
console.log('  Speech duration:', sampleData.metadata.speechDuration, 'ms');
console.log('  Silence:', sampleData.metadata.silenceMs, 'ms');
console.log('  Onset silence:', sampleData.metadata.onsetSilence, 'ms');

// Calculate new silence duration (extend offset silence to 2000ms)
const newOffsetSilence = 2000; // 2 seconds of silence
const newTotalDuration = sampleData.metadata.onsetSilence + sampleData.metadata.speechDuration + newOffsetSilence;
const newTotalSamples = Math.floor((newTotalDuration / 1000) * sampleData.metadata.sampleRate);
const newOffsetSamples = Math.floor((newOffsetSilence / 1000) * sampleData.metadata.sampleRate);

console.log('\n🎵 New audio sample metadata:');
console.log('  New offset silence:', newOffsetSilence, 'ms');
console.log('  New total duration:', newTotalDuration, 'ms');
console.log('  New total samples:', newTotalSamples);
console.log('  New offset samples:', newOffsetSamples);

// Convert base64 to binary
const binaryString = atob(sampleData.audioData);
const originalBuffer = Buffer.from(binaryString, 'binary');

// Calculate original audio structure
const bytesPerSample = 2; // 16-bit audio
const originalOnsetSamples = sampleData.metadata.onsetSamples;
const originalSpeechSamples = sampleData.metadata.speechSamples;
const originalOffsetSamples = Math.floor((sampleData.metadata.silenceMs - sampleData.metadata.onsetSilence) / 1000 * sampleData.metadata.sampleRate);

console.log('\n🔍 Original audio structure:');
console.log('  Onset samples:', originalOnsetSamples);
console.log('  Speech samples:', originalSpeechSamples);
console.log('  Original offset samples:', originalOffsetSamples);

// Extract the speech portion (skip onset silence, take speech, skip original offset)
const onsetBytes = originalOnsetSamples * bytesPerSample;
const speechBytes = originalSpeechSamples * bytesPerSample;
const speechBuffer = originalBuffer.slice(onsetBytes, onsetBytes + speechBytes);

// Create new silence buffers
const newOnsetSilenceBuffer = Buffer.alloc(originalOnsetSamples * bytesPerSample, 0);
const newOffsetSilenceBuffer = Buffer.alloc(newOffsetSamples * bytesPerSample, 0);

// Combine: onset silence + speech + new offset silence
const newAudioBuffer = Buffer.concat([
  newOnsetSilenceBuffer,
  speechBuffer,
  newOffsetSilenceBuffer
]);

// Convert back to base64
const newAudioData = newAudioBuffer.toString('base64');

// Update metadata
const newMetadata = {
  ...sampleData.metadata,
  totalDuration: newTotalDuration,
  silenceMs: sampleData.metadata.onsetSilence + newOffsetSilence,
  totalSamples: newTotalSamples,
  offsetSamples: newOffsetSamples
};

// Create new sample data
const newSampleData = {
  ...sampleData,
  audioData: newAudioData,
  metadata: newMetadata
};

// Write the extended sample
const extendedSamplePath = path.join(__dirname, '..', 'tests', 'fixtures', 'audio-samples', 'sample_hello_extended.json');
fs.writeFileSync(extendedSamplePath, JSON.stringify(newSampleData, null, 2));

console.log('\n✅ Extended audio sample created:');
console.log('  File:', extendedSamplePath);
console.log('  New total duration:', newTotalDuration, 'ms');
console.log('  New offset silence:', newOffsetSilence, 'ms');
console.log('  Should trigger UtteranceEnd with utterance_end_ms = 1500ms');
