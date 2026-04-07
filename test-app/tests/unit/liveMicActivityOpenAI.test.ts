/**
 * Issue #561 — Live Mic activity for OpenAI proxy (transcript-driven; no UserStartedSpeaking).
 */

import {
  openAiInputTranscriptImpliesUserSpeaking,
  openAiTranscriptShouldEndMicActivityPulse,
} from '../../src/live-mode/liveMicActivityOpenAI';

describe('liveMicActivityOpenAI', () => {
  describe('openAiInputTranscriptImpliesUserSpeaking', () => {
    it('is false for empty or whitespace transcript', () => {
      expect(openAiInputTranscriptImpliesUserSpeaking({ transcript: '' })).toBe(false);
      expect(openAiInputTranscriptImpliesUserSpeaking({ transcript: '   ' })).toBe(false);
    });

    it('is true when transcript has non-whitespace content', () => {
      expect(openAiInputTranscriptImpliesUserSpeaking({ transcript: 'hello' })).toBe(true);
      expect(openAiInputTranscriptImpliesUserSpeaking({ transcript: ' hi ' })).toBe(true);
    });
  });

  describe('openAiTranscriptShouldEndMicActivityPulse', () => {
    it('is true when final or speech_final', () => {
      expect(openAiTranscriptShouldEndMicActivityPulse({ is_final: true, speech_final: false })).toBe(
        true
      );
      expect(openAiTranscriptShouldEndMicActivityPulse({ is_final: false, speech_final: true })).toBe(
        true
      );
    });

    it('is false when neither final flag is set', () => {
      expect(openAiTranscriptShouldEndMicActivityPulse({ is_final: false, speech_final: false })).toBe(
        false
      );
    });
  });
});
