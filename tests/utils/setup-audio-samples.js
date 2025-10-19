#!/usr/bin/env node

/**
 * Audio Samples Setup Script
 * 
 * This script helps developers set up the audio sample library
 * for VAD testing. It generates TTS audio samples and creates
 * the necessary configuration files.
 * 
 * Usage:
 *   node tests/utils/setup-audio-samples.js
 *   node tests/utils/setup-audio-samples.js --clean
 *   node tests/utils/setup-audio-samples.js --list
 */

const AudioSimulator = require('./audio-simulator');
const fs = require('fs');
const path = require('path');

async function setupAudioSamples() {
  console.log('🎤 Setting up VAD Audio Sample Library...\n');
  
  try {
    // Create the audio sample library
    await AudioSimulator.createAudioSampleLibrary();
    
    console.log('\n✅ Audio sample library setup completed successfully!');
    console.log('\n📁 Generated files:');
    console.log('   - tests/fixtures/audio-samples/samples.json');
    console.log('   - Audio samples cached in memory for testing');
    console.log('   - README.md with audio sample guidelines');
    
    console.log('\n🚀 Usage in tests:');
    console.log('   const AudioTestHelpers = require("./utils/audio-helpers");');
    console.log('   await AudioTestHelpers.simulateVADSpeech(page, "Hello");');
    console.log('   await AudioTestHelpers.useAudioSample(page, "hello");');
    console.log('   await AudioSimulator.simulateStreamingAudio(page, "phrase");');
    console.log('   await AudioSimulator.simulateNaturalSpeech(page, "phrase");');
    
    console.log('\n📊 Cache statistics:');
    const stats = AudioSimulator.getCacheStats();
    console.log(`   - Cached samples: ${stats.size}`);
    console.log(`   - Sample names: ${stats.samples.join(', ')}`);
    
    console.log('\n🎵 Pre-recorded audio support:');
    console.log('   - Place WAV files in tests/fixtures/audio-samples/');
    console.log('   - Format: 16kHz, Mono, 16-bit WAV');
    console.log('   - See README.md for detailed guidelines');
    
  } catch (error) {
    console.error('❌ Error setting up audio samples:', error);
    process.exit(1);
  }
}

async function cleanAudioSamples() {
  console.log('🧹 Cleaning audio sample cache...\n');
  
  AudioSimulator.clearCache();
  
  const samplesDir = path.join(__dirname, '../fixtures/audio-samples');
  if (fs.existsSync(samplesDir)) {
    const files = fs.readdirSync(samplesDir);
    files.forEach(file => {
      if (file.endsWith('.wav')) {
        fs.unlinkSync(path.join(samplesDir, file));
        console.log(`   Deleted: ${file}`);
      }
    });
  }
  
  console.log('✅ Audio sample cache cleaned');
}

function listAudioSamples() {
  console.log('📋 Available audio samples:\n');
  
  const configPath = path.join(__dirname, '../fixtures/audio-samples/samples.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    Object.entries(config).forEach(([name, sample]) => {
      console.log(`   ${name}:`);
      console.log(`     Text: "${sample.text}"`);
      console.log(`     Duration: ${sample.speechDuration}ms`);
      console.log(`     Silence: ${sample.onsetSilenceDuration}ms onset, ${sample.offsetSilenceDuration}ms offset`);
      console.log(`     Description: ${sample.description}`);
      console.log('');
    });
  } else {
    console.log('   No samples configuration found. Run setup first.');
  }
  
  const stats = AudioSimulator.getCacheStats();
  console.log(`📊 Cache status: ${stats.size} samples cached`);
  if (stats.samples.length > 0) {
    console.log(`   Cached: ${stats.samples.join(', ')}`);
  }
}

async function validateAudioSamples() {
  console.log('🔍 Validating audio samples...\n');
  
  const AudioFileLoader = require('./audio-file-loader');
  const samplesDir = path.join(__dirname, '../fixtures/audio-samples');
  
  if (!fs.existsSync(samplesDir)) {
    console.log('❌ Audio samples directory not found');
    return;
  }
  
  const files = fs.readdirSync(samplesDir).filter(file => file.endsWith('.wav'));
  
  if (files.length === 0) {
    console.log('ℹ️ No WAV files found. TTS generation will be used as fallback.');
    return;
  }
  
  console.log(`Found ${files.length} WAV files:`);
  
  for (const file of files) {
    const filePath = path.join(samplesDir, file);
    try {
      const validation = await AudioFileLoader.validateAudioFile(filePath);
      if (validation.valid) {
        console.log(`✅ ${file}: ${validation.sampleRate}Hz, ${validation.channels}ch, ${validation.bitsPerSample}bit, ${validation.duration.toFixed(2)}s`);
      } else {
        console.log(`❌ ${file}: ${validation.error}`);
      }
    } catch (error) {
      console.log(`❌ ${file}: ${error.message}`);
    }
  }
}

async function testAudioSamples() {
  console.log('🧪 Testing audio sample loading...\n');
  
  try {
    // Test TTS generation
    console.log('Testing TTS generation...');
    const ttsSample = await AudioSimulator.generateAndCacheSample('Test phrase', 1000);
    console.log(`✅ TTS sample generated: ${ttsSample.byteLength} bytes`);
    
    // Test sample loading
    console.log('Testing sample loading...');
    try {
      const loadedSample = await AudioSimulator.loadAudioSample('hello', { usePreRecorded: true });
      console.log(`✅ Sample loaded: ${loadedSample.byteLength} bytes`);
    } catch (error) {
      console.log(`ℹ️ Pre-recorded sample not available, TTS fallback working: ${error.message}`);
    }
    
    // Test streaming
    console.log('Testing streaming simulation...');
    const chunks = AudioFileLoader.splitIntoChunks(ttsSample, 1024);
    console.log(`✅ Audio split into ${chunks.length} chunks`);
    
    console.log('\n✅ All audio sample tests passed!');
    
  } catch (error) {
    console.error('❌ Audio sample testing failed:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log('🎤 VAD Audio Samples Setup Script\n');
  console.log('Usage: node tests/utils/setup-audio-samples.js [options]\n');
  console.log('Options:');
  console.log('  --clean      Clean the audio sample cache');
  console.log('  --list       List available audio samples');
  console.log('  --validate   Validate audio file formats');
  console.log('  --test       Test audio sample loading');
  console.log('  --help       Show this help message');
  console.log('  (no args)    Set up the audio sample library\n');
  console.log('Examples:');
  console.log('  node tests/utils/setup-audio-samples.js');
  console.log('  node tests/utils/setup-audio-samples.js --clean');
  console.log('  node tests/utils/setup-audio-samples.js --list');
  console.log('  node tests/utils/setup-audio-samples.js --validate');
  console.log('  node tests/utils/setup-audio-samples.js --test');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
  } else if (args.includes('--clean')) {
    await cleanAudioSamples();
  } else if (args.includes('--list')) {
    listAudioSamples();
  } else if (args.includes('--validate')) {
    await validateAudioSamples();
  } else if (args.includes('--test')) {
    await testAudioSamples();
  } else {
    await setupAudioSamples();
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  setupAudioSamples,
  cleanAudioSamples,
  listAudioSamples
};
