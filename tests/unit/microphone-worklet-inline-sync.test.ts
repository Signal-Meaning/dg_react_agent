/**
 * DRY guard: AudioManager loads the worklet from microphone-worklet-inline.generated.ts,
 * which must match AudioWorkletProcessor.js (regenerate: npm run generate:mic-worklet).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

function expectedGeneratedFile(processorSource: string): string {
  return (
    '/* eslint-disable */\n' +
    '/**\n' +
    ' * AUTO-GENERATED from AudioWorkletProcessor.js — do not edit.\n' +
    ' * Run: npm run generate:mic-worklet\n' +
    ' */\n' +
    `export const MICROPHONE_WORKLET_INLINE_SOURCE = ${JSON.stringify(processorSource)};\n`
  );
}

describe('microphone worklet inline (DRY)', () => {
  it('generated TS matches AudioWorkletProcessor.js', () => {
    const root = join(__dirname, '../..');
    const processorPath = join(root, 'src/utils/audio/AudioWorkletProcessor.js');
    const generatedPath = join(root, 'src/utils/audio/microphone-worklet-inline.generated.ts');
    const processor = readFileSync(processorPath, 'utf8');
    const generated = readFileSync(generatedPath, 'utf8');
    expect(generated).toBe(expectedGeneratedFile(processor));
  });
});
