/**
 * OpenAI proxy translation layer – unit tests (Issue #381)
 *
 * Tests pure mapping functions: component (Deepgram Voice Agent protocol) ↔ OpenAI Realtime.
 * TDD: tests define expected behavior; see docs/issues/ISSUE-381/UNIT-TEST-PLAN.md.
 */

import {
  mapSettingsToSessionUpdate,
  mapInjectUserMessageToConversationItemCreate,
  mapSessionUpdatedToSettingsApplied,
  mapOutputTextDoneToConversationText,
  mapOutputAudioTranscriptDoneToConversationText,
  mapErrorToComponentError,
  binaryToInputAudioBufferAppend,
} from '../scripts/openai-proxy/translator';

describe('OpenAI proxy translator (Issue #381)', () => {
  describe('1. Session / config handling', () => {
    it('maps Settings to session.update with type realtime and instructions from think.prompt', () => {
      const settings = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'You are helpful.', provider: { model: 'gpt-4o-realtime-preview' } } },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.type).toBe('session.update');
      expect(out.session.type).toBe('realtime');
      expect(out.session.instructions).toBe('You are helpful.');
      expect(out.session.model).toBe('gpt-4o-realtime-preview');
    });

    it('maps Settings with missing think to default instructions and model (no voice in session - API rejects session.voice)', () => {
      const settings = { type: 'Settings' as const };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.instructions).toBe('');
      expect(out.session.model).toBe('gpt-realtime');
      expect(out.session).not.toHaveProperty('voice');
    });

    it('maps Settings.agent.think.functions to session.update tools', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            functions: [
              { name: 'get_time', description: 'Get current time', parameters: { type: 'object' } },
            ],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.tools).toHaveLength(1);
      expect(out.session.tools![0]).toEqual({
        type: 'function',
        name: 'get_time',
        description: 'Get current time',
        parameters: { type: 'object' },
      });
    });
  });

  describe('2. Client event handling (InjectUserMessage)', () => {
    it('maps InjectUserMessage to conversation.item.create with input_text', () => {
      const msg = { type: 'InjectUserMessage' as const, content: 'hi' };
      const out = mapInjectUserMessageToConversationItemCreate(msg);
      expect(out.type).toBe('conversation.item.create');
      expect(out.item.type).toBe('message');
      expect(out.item.role).toBe('user');
      expect(out.item.content).toEqual([{ type: 'input_text', text: 'hi' }]);
    });

    it('handles empty content as empty string', () => {
      const msg = { type: 'InjectUserMessage' as const, content: '' };
      const out = mapInjectUserMessageToConversationItemCreate(msg);
      expect(out.item.content).toEqual([{ type: 'input_text', text: '' }]);
    });
  });

  describe('3. Server event handling (to component)', () => {
    it('maps session.updated to SettingsApplied', () => {
      const out = mapSessionUpdatedToSettingsApplied({ type: 'session.updated', session: {} });
      expect(out).toEqual({ type: 'SettingsApplied' });
    });

    it('maps response.output_text.done to ConversationText (assistant)', () => {
      const event = { type: 'response.output_text.done' as const, text: 'Hello there!' };
      const out = mapOutputTextDoneToConversationText(event);
      expect(out).toEqual({
        type: 'ConversationText',
        role: 'assistant',
        content: 'Hello there!',
      });
    });

    it('maps response.output_text.done with missing text to empty content', () => {
      const event = { type: 'response.output_text.done' as const };
      const out = mapOutputTextDoneToConversationText(event);
      expect(out.content).toBe('');
    });

    it('maps response.output_audio_transcript.done to ConversationText (assistant)', () => {
      const event = { type: 'response.output_audio_transcript.done' as const, transcript: 'Hi, how can I help?' };
      const out = mapOutputAudioTranscriptDoneToConversationText(event);
      expect(out).toEqual({
        type: 'ConversationText',
        role: 'assistant',
        content: 'Hi, how can I help?',
      });
    });

    it('maps response.output_audio_transcript.done with missing transcript to empty content', () => {
      const event = { type: 'response.output_audio_transcript.done' as const };
      const out = mapOutputAudioTranscriptDoneToConversationText(event);
      expect(out.content).toBe('');
    });

    it('maps OpenAI error to component Error (description, code)', () => {
      const event = {
        type: 'error' as const,
        error: { message: 'Rate limit exceeded', code: 'rate_limit_exceeded' },
      };
      const out = mapErrorToComponentError(event);
      expect(out).toEqual({
        type: 'Error',
        description: 'Rate limit exceeded',
        code: 'rate_limit_exceeded',
      });
    });

    it('maps OpenAI error with missing fields to safe defaults', () => {
      const event = { type: 'error' as const };
      const out = mapErrorToComponentError(event);
      expect(out.type).toBe('Error');
      expect(out.description).toBe('Unknown error');
      expect(out.code).toBe('unknown');
    });
  });

  describe('5. Input audio (binary → input_audio_buffer.append)', () => {
    it('maps binary buffer to input_audio_buffer.append with base64 audio', () => {
      const pcm = Buffer.from([0x00, 0x00, 0xff, 0xff]); // 4 bytes PCM
      const out = binaryToInputAudioBufferAppend(pcm);
      expect(out.type).toBe('input_audio_buffer.append');
      expect(out.audio).toBe(pcm.toString('base64'));
      expect(Buffer.from(out.audio, 'base64').equals(pcm)).toBe(true);
    });

    it('empty buffer yields input_audio_buffer.append with empty base64 string', () => {
      const out = binaryToInputAudioBufferAppend(Buffer.alloc(0));
      expect(out.type).toBe('input_audio_buffer.append');
      expect(out.audio).toBe('');
    });
  });

  describe('4. Edge cases', () => {
    it('mapSettingsToSessionUpdate does not throw on minimal Settings', () => {
      expect(() => mapSettingsToSessionUpdate({ type: 'Settings' })).not.toThrow();
    });

    it('mapInjectUserMessageToConversationItemCreate does not throw on content undefined', () => {
      const msg = { type: 'InjectUserMessage' as const, content: undefined as unknown as string };
      const out = mapInjectUserMessageToConversationItemCreate(msg);
      expect(out.item.content[0].text).toBe('');
    });
  });
});
