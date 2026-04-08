#!/usr/bin/env node
/**
 * Single source of truth for the microphone AudioWorklet: AudioWorkletProcessor.js
 * This script embeds it into microphone-worklet-inline.generated.ts for AudioManager (Blob URL).
 * Run after editing the processor: npm run generate:mic-worklet
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const processorPath = join(root, 'src/utils/audio/AudioWorkletProcessor.js');
const outPath = join(root, 'src/utils/audio/microphone-worklet-inline.generated.ts');
const src = readFileSync(processorPath, 'utf8');
const body =
  '/* eslint-disable */\n' +
  '/**\n' +
  ' * AUTO-GENERATED from AudioWorkletProcessor.js — do not edit.\n' +
  ' * Run: npm run generate:mic-worklet\n' +
  ' */\n' +
  `export const MICROPHONE_WORKLET_INLINE_SOURCE = ${JSON.stringify(src)};\n`;
writeFileSync(outPath, body, 'utf8');
console.log('Wrote', outPath);
