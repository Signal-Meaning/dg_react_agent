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
  mapFunctionCallArgumentsDoneToFunctionCallRequest,
  mapFunctionCallArgumentsDoneToConversationText,
  mapFunctionCallResponseToConversationItemCreate,
  mapContextMessageToConversationItemCreate,
  mapGreetingToConversationItemCreate,
  mapGreetingToConversationText,
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

    it('maps multiple functions to session.update tools (OpenAI API shape)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            functions: [
              { name: 'get_time', description: 'Get time', parameters: { type: 'object' } },
              { name: 'get_weather', description: 'Get weather', parameters: { type: 'object', properties: { city: { type: 'string' } } } },
            ],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.tools).toHaveLength(2);
      expect(out.session.tools![0].name).toBe('get_time');
      expect(out.session.tools![1].name).toBe('get_weather');
      expect(out.session.tools![1].parameters).toEqual({ type: 'object', properties: { city: { type: 'string' } } });
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

    it('maps response.function_call_arguments.done to FunctionCallRequest so component invokes callback', () => {
      const event = {
        type: 'response.function_call_arguments.done' as const,
        call_id: 'call_abc',
        name: 'get_current_time',
        arguments: '{}',
      };
      const out = mapFunctionCallArgumentsDoneToFunctionCallRequest(event);
      expect(out).toEqual({
        type: 'FunctionCallRequest',
        functions: [{ id: 'call_abc', name: 'get_current_time', arguments: '{}', client_side: true }],
      });
    });

    it('maps response.function_call_arguments.done with missing call_id to empty id', () => {
      const event = { type: 'response.function_call_arguments.done' as const, name: 'get_time' };
      const out = mapFunctionCallArgumentsDoneToFunctionCallRequest(event);
      expect(out.functions[0].id).toBe('');
      expect(out.functions[0].name).toBe('get_time');
    });

    it('maps response.function_call_arguments.done with non-empty arguments to FunctionCallRequest', () => {
      const event = {
        type: 'response.function_call_arguments.done' as const,
        call_id: 'call_xyz',
        name: 'get_weather',
        arguments: '{"city":"Boston"}',
      };
      const out = mapFunctionCallArgumentsDoneToFunctionCallRequest(event);
      expect(out.functions[0]).toEqual({
        id: 'call_xyz',
        name: 'get_weather',
        arguments: '{"city":"Boston"}',
        client_side: true,
      });
    });

    it('maps response.function_call_arguments.done to ConversationText (assistant) for UI', () => {
      const event = {
        type: 'response.function_call_arguments.done' as const,
        name: 'get_current_time',
        arguments: '{}',
      };
      const out = mapFunctionCallArgumentsDoneToConversationText(event);
      expect(out).toEqual({
        type: 'ConversationText',
        role: 'assistant',
        content: 'Function call: get_current_time({})',
      });
    });

    it('maps response.function_call_arguments.done with no args to name()', () => {
      const event = { type: 'response.function_call_arguments.done' as const, name: 'get_time' };
      const out = mapFunctionCallArgumentsDoneToConversationText(event);
      expect(out.content).toBe('Function call: get_time()');
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

  describe('5. Function call response (FunctionCallResponse → conversation.item.create)', () => {
    it('maps FunctionCallResponse to conversation.item.create with function_call_output', () => {
      const msg = {
        type: 'FunctionCallResponse' as const,
        id: 'call_abc',
        name: 'get_current_time',
        content: '{"time":"12:00"}',
      };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out).toEqual({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: 'call_abc', output: '{"time":"12:00"}' },
      });
    });

    it('handles empty content as empty output string', () => {
      const msg = { type: 'FunctionCallResponse' as const, id: 'call_1', name: 'fn', content: '' };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.item.output).toBe('');
    });
  });

  describe('6. Context (context message → conversation.item.create)', () => {
    it('maps user context message to conversation.item.create', () => {
      const out = mapContextMessageToConversationItemCreate('user', 'hello');
      expect(out).toEqual({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
      });
    });

    it('maps assistant context message to conversation.item.create with output_text (OpenAI API requires output_text for assistant)', () => {
      const out = mapContextMessageToConversationItemCreate('assistant', 'Hi there!');
      expect(out.item.role).toBe('assistant');
      expect(out.item.content[0]).toEqual({ type: 'output_text', text: 'Hi there!' });
    });

    it('uses input_text for user and output_text for assistant per OpenAI Realtime API', () => {
      const userOut = mapContextMessageToConversationItemCreate('user', 'hello');
      expect(userOut.item.content[0].type).toBe('input_text');
      const assistantOut = mapContextMessageToConversationItemCreate('assistant', 'hi back');
      expect(assistantOut.item.content[0].type).toBe('output_text');
    });
  });

  describe('6a. Greeting (Issue #381 – after session.updated, inject as assistant message)', () => {
    it('maps greeting string to conversation.item.create (assistant message with output_text)', () => {
      const out = mapGreetingToConversationItemCreate('Hello! How can I assist you today?');
      expect(out).toEqual({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello! How can I assist you today?' }],
        },
      });
    });

    it('maps greeting string to ConversationText (assistant) for component', () => {
      const out = mapGreetingToConversationText('Hi there!');
      expect(out).toEqual({
        type: 'ConversationText',
        role: 'assistant',
        content: 'Hi there!',
      });
    });
  });

  describe('7. Input audio (binary → input_audio_buffer.append)', () => {
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

  describe('8. Edge cases', () => {
    it('mapSettingsToSessionUpdate does not throw on minimal Settings', () => {
      expect(() => mapSettingsToSessionUpdate({ type: 'Settings' })).not.toThrow();
    });

    it('mapInjectUserMessageToConversationItemCreate does not throw on content undefined', () => {
      const msg = { type: 'InjectUserMessage' as const, content: undefined as unknown as string };
      const out = mapInjectUserMessageToConversationItemCreate(msg);
      expect(out.item.content[0].text).toBe('');
    });
  });

  /**
   * Issue #388: Proxy must send response.create only after receiving conversation.item.added
   * (or conversation.item.done) from upstream for the user message. This helper encodes the rule;
   * the proxy server should use equivalent logic. Integration test asserts timing (TDD red until fixed).
   */
  describe('Issue #388: proxy event order (InjectUserMessage → response.create)', () => {
    function maySendResponseCreateAfterInjectUserMessage(upstreamTypesReceived: string[]): boolean {
      return upstreamTypesReceived.some(
        (t) => t === 'conversation.item.added' || t === 'conversation.item.done'
      );
    }

    it('must not send response.create until upstream sent conversation.item.added or conversation.item.done', () => {
      expect(maySendResponseCreateAfterInjectUserMessage([])).toBe(false);
      expect(maySendResponseCreateAfterInjectUserMessage(['session.updated'])).toBe(false);
      expect(maySendResponseCreateAfterInjectUserMessage(['response.created'])).toBe(false);
    });

    it('may send response.create after conversation.item.added', () => {
      expect(maySendResponseCreateAfterInjectUserMessage(['conversation.item.added'])).toBe(true);
    });

    it('may send response.create after conversation.item.done', () => {
      expect(maySendResponseCreateAfterInjectUserMessage(['conversation.item.done'])).toBe(true);
    });
  });
});
