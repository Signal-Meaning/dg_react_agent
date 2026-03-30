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
  mapOutputAudioTranscriptDoneToConversationText,
  mapFunctionCallArgumentsDoneToFunctionCallRequest,
  mapFunctionCallArgumentsDoneToConversationText,
  mapFunctionCallResponseToConversationItemCreate,
  mapContextMessageToConversationItemCreate,
  mapGreetingToConversationItemCreate,
  mapGreetingToConversationText,
  mapConversationItemAddedToConversationText,
  extractAssistantTextFromResponseOutputTextDone,
  mergeAssistantTextFromOutputTextDoneAndDeltas,
  extractAssistantTextFromResponseDoneEvent,
  mapErrorToComponentError,
  binaryToInputAudioBufferAppend,
} from '../packages/voice-agent-backend/scripts/openai-proxy/translator';

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

    it('does not forward agent.think.provider.temperature on session.update (Issue #538; REALTIME-SESSION-UPDATE-FIELD-MAP.md)', () => {
      const withTemp = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Hi.',
            provider: { model: 'gpt-realtime', temperature: 0.8 },
          },
        },
      };
      expect(mapSettingsToSessionUpdate(withTemp).session).not.toHaveProperty('temperature');
      const noTemp = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Hi.', provider: { model: 'gpt-realtime' } } },
      };
      expect(mapSettingsToSessionUpdate(noTemp).session).not.toHaveProperty('temperature');
    });

    it('minimal Settings → session.update session keys (Issue #538 field map regression)', () => {
      const out = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: { think: { prompt: 'Hi' } },
      });
      expect(Object.keys(out.session).sort()).toEqual(['audio', 'instructions', 'model', 'type']);
    });

    it('full optional Settings → session.update includes mapped optional keys (Issue #538 field map)', () => {
      const out = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            provider: { model: 'gpt-realtime-mini' },
            toolChoice: 'auto',
            outputModalities: ['text'],
            maxOutputTokens: 256,
            managedPrompt: { id: 'pmpt_123', variables: { topic: 'weather' } },
            functions: [{ name: 'fn', description: 'd', parameters: { type: 'object' } }],
          },
          sessionAudioOutput: { voice: 'marin', speed: 1 },
        },
      });
      const keys = Object.keys(out.session).sort();
      expect(keys).toEqual(
        ['audio', 'instructions', 'max_output_tokens', 'model', 'output_modalities', 'prompt', 'tool_choice', 'tools', 'type'].sort(),
      );
      expect(out.session).not.toHaveProperty('temperature');
    });

    it('maps Settings with missing think to default instructions and model (no voice in session - API rejects session.voice)', () => {
      const settings = { type: 'Settings' as const };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.instructions).toBe('');
      expect(out.session.model).toBe('gpt-realtime');
      expect(out.session).not.toHaveProperty('voice');
    });

    it('includes prior-session context in instructions (Issue #489; do not inject context as conversation items)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'You are helpful.', provider: { model: 'gpt-4o-realtime' } },
          context: {
            messages: [
              { role: 'assistant' as const, content: 'Hello! How can I assist you today?' },
              { role: 'user' as const, content: 'What is the capital of France?' },
              { role: 'assistant' as const, content: 'The capital of France is Paris.' },
            ],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.instructions).toContain('You are helpful.');
      expect(out.session.instructions).toContain('Previous conversation:');
      expect(out.session.instructions).toContain('assistant: Hello! How can I assist you today?');
      expect(out.session.instructions).toContain('user: What is the capital of France?');
      expect(out.session.instructions).toContain('assistant: The capital of France is Paris.');
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

    it('maps agent.think.toolChoice to session.tool_choice (Issue #535; string modes)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            toolChoice: 'required' as const,
            functions: [{ name: 'get_time', description: 't', parameters: {} }],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.tool_choice).toBe('required');
    });

    it('maps agent.think.toolChoice to session.tool_choice (Issue #535; force function)', () => {
      const forced = { type: 'function' as const, name: 'get_time' };
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            toolChoice: forced,
            functions: [{ name: 'get_time', description: 't', parameters: {} }],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.tool_choice).toEqual(forced);
    });

    it('omits session.tool_choice when agent.think.toolChoice is absent (Issue #535)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            functions: [{ name: 'get_time', description: 't', parameters: {} }],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session).not.toHaveProperty('tool_choice');
    });

    it('maps agent.think.outputModalities to session.output_modalities (Issue #536)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            outputModalities: ['text' as const],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.output_modalities).toEqual(['text']);
    });

    it('preserves order for audio+text output_modalities (Issue #536)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            outputModalities: ['audio' as const, 'text' as const],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.output_modalities).toEqual(['audio', 'text']);
    });

    it('filters invalid output modality strings (Issue #536)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            outputModalities: ['text', 'video', 'audio'] as ('text' | 'audio')[],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.output_modalities).toEqual(['text', 'audio']);
    });

    it('omits session.output_modalities when only invalid modality strings (Issue #536)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            outputModalities: ['video', 'image'] as ('text' | 'audio')[],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session).not.toHaveProperty('output_modalities');
    });

    it('omits session.output_modalities when agent.think.outputModalities absent or empty (Issue #536; API default unchanged)', () => {
      const minimal = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.' } },
      };
      expect(mapSettingsToSessionUpdate(minimal).session).not.toHaveProperty('output_modalities');
      const emptyArr = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.', outputModalities: [] } },
      };
      expect(mapSettingsToSessionUpdate(emptyArr).session).not.toHaveProperty('output_modalities');
    });

    it('maps agent.think.maxOutputTokens to session.max_output_tokens (Issue #537)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            maxOutputTokens: 256,
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.max_output_tokens).toBe(256);
    });

    it('omits session.max_output_tokens when agent.think.maxOutputTokens omitted (Issue #537; JSON has no undefined)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.' } },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session).not.toHaveProperty('max_output_tokens');
      const roundTrip = JSON.parse(JSON.stringify(out.session)) as Record<string, unknown>;
      expect(roundTrip).not.toHaveProperty('max_output_tokens');
    });

    it('omits session.max_output_tokens for non-positive or non-integer values (Issue #537)', () => {
      const base = { type: 'Settings' as const, agent: { think: { prompt: 'Help.' } } };
      for (const maxOutputTokens of [0, -1, 1.5, NaN, Infinity]) {
        const out = mapSettingsToSessionUpdate({
          ...base,
          agent: { think: { ...base.agent.think, maxOutputTokens } },
        });
        expect(out.session).not.toHaveProperty('max_output_tokens');
      }
    });

    it('omits session.max_output_tokens when value is not a safe integer (Issue #537)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            maxOutputTokens: Number.MAX_SAFE_INTEGER + 1,
          },
        },
      };
      expect(mapSettingsToSessionUpdate(settings).session).not.toHaveProperty('max_output_tokens');
    });

    it('maps agent.think.managedPrompt to session.prompt id/variables/version (Issue #539)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            managedPrompt: {
              id: 'pmpt_abc',
              version: '2',
              variables: { customer_name: 'Ada' },
            },
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.prompt).toEqual({
        id: 'pmpt_abc',
        version: '2',
        variables: { customer_name: 'Ada' },
      });
    });

    it('trims managedPrompt id and version; omits empty version (Issue #539)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            managedPrompt: { id: '  pmpt_x  ', version: '  v1  ' },
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.prompt).toEqual({ id: 'pmpt_x', version: 'v1' });
      const noVersion = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.', managedPrompt: { id: 'p1', version: '   ' } } },
      });
      expect(noVersion.session.prompt).toEqual({ id: 'p1' });
    });

    it('omits session.prompt when managedPrompt missing or id empty (Issue #539)', () => {
      const minimal = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.' } },
      };
      expect(mapSettingsToSessionUpdate(minimal).session).not.toHaveProperty('prompt');
      const emptyId = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.', managedPrompt: { id: '  ' } } },
      };
      expect(mapSettingsToSessionUpdate(emptyId).session).not.toHaveProperty('prompt');
    });

    it('ignores invalid managedPrompt.variables; still emits prompt with id (Issue #539)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'Help.',
            managedPrompt: { id: 'p1', variables: [1, 2] as unknown as Record<string, unknown> },
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.prompt).toEqual({ id: 'p1' });
    });

    it('merges agent.sessionAudioOutput into session.audio.output; preserves proxy input defaults (Issue #540)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'Help.' },
          sessionAudioOutput: { voice: 'marin', speed: 1.1 },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.audio?.input).toEqual({
        turn_detection: null,
        format: { type: 'audio/pcm', rate: 24000 },
        transcription: { model: 'gpt-4o-transcribe', language: 'en', prompt: '' },
      });
      expect(out.session.audio?.output).toEqual({ voice: 'marin', speed: 1.1 });
    });

    it('maps sessionAudioOutput.format for pcm and pcmu (Issue #540)', () => {
      const pcm = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'Help.' },
          sessionAudioOutput: { format: { type: 'audio/pcm', rate: 24000 } },
        },
      });
      expect(pcm.session.audio?.output?.format).toEqual({ type: 'audio/pcm', rate: 24000 });
      const pcmBare = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'Help.' },
          sessionAudioOutput: { format: { type: 'audio/pcm' } },
        },
      });
      expect(pcmBare.session.audio?.output?.format).toEqual({ type: 'audio/pcm' });
      const pcmu = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'Help.' },
          sessionAudioOutput: { format: { type: 'audio/pcmu' } },
        },
      });
      expect(pcmu.session.audio?.output?.format).toEqual({ type: 'audio/pcmu' });
    });

    it('omits session.audio.output when sessionAudioOutput absent or yields no valid fields (Issue #540)', () => {
      const minimal = {
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.' } },
      };
      expect(mapSettingsToSessionUpdate(minimal).session.audio).not.toHaveProperty('output');
      const badSpeed = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: { think: { prompt: 'Help.' }, sessionAudioOutput: { speed: NaN } },
      });
      expect(badSpeed.session.audio).not.toHaveProperty('output');
    });

    it('omits invalid sessionAudioOutput.format type; keeps valid voice (Issue #540)', () => {
      const out = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'Help.' },
          sessionAudioOutput: { format: { type: 'audio/wav' }, voice: 'alloy' },
        },
      });
      expect(out.session.audio?.output).toEqual({ voice: 'alloy' });
    });

    it('maps custom voice object on sessionAudioOutput (Issue #540)', () => {
      const out = mapSettingsToSessionUpdate({
        type: 'Settings' as const,
        agent: {
          think: { prompt: 'Help.' },
          sessionAudioOutput: { voice: { id: 'voice_custom1' } },
        },
      });
      expect(out.session.audio?.output).toEqual({ voice: { id: 'voice_custom1' } });
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

    it('appends instruction to use tool results when functions are present (E2E 6/6b)', () => {
      const settings = {
        type: 'Settings' as const,
        agent: {
          think: {
            prompt: 'You are helpful.',
            functions: [{ name: 'get_current_time', description: 'Get the time', parameters: {} }],
          },
        },
      };
      const out = mapSettingsToSessionUpdate(settings);
      expect(out.session.instructions).toContain('When you receive results from tool calls, use them in your reply to the user.');
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

    /** Issue #489: codes over message text — use only API structured code; when code absent, returns unknown */
    describe('Error mapping (codes over message text, Issue #489)', () => {
      it('uses event.error.code when present: idle_timeout → component code idle_timeout', () => {
        const event = {
          type: 'error' as const,
          error: { code: 'idle_timeout', message: 'Any message' },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('idle_timeout');
        expect(out.type).toBe('Error');
      });

      it('uses event.error.code when present: session_max_duration → component code session_max_duration', () => {
        const event = {
          type: 'error' as const,
          error: { code: 'session_max_duration', message: 'Any message' },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('session_max_duration');
      });

      it('passes through other API codes (e.g. rate_limit_exceeded)', () => {
        const event = {
          type: 'error' as const,
          error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded' },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('rate_limit_exceeded');
      });

      it('when error.code absent, returns unknown (no message-text inference; API should send structured code)', () => {
        const event = {
          type: 'error' as const,
          error: { message: 'The server had an error while processing your request' },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('unknown');
      });

      it('when error.code absent and message is session max duration text, returns unknown (no message-text inference)', () => {
        const event = {
          type: 'error' as const,
          error: { message: 'Your session hit the maximum duration of 60 minutes.' },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('unknown');
      });

      it('when error.code absent and message does not match any string, returns unknown', () => {
        const event = {
          type: 'error' as const,
          error: { message: 'Some other error' },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('unknown');
      });

      it('prefers event.error.code over message: when code is rate_limit_exceeded and message matches idle string, returns rate_limit_exceeded', () => {
        const event = {
          type: 'error' as const,
          error: {
            code: 'rate_limit_exceeded',
            message: 'The server had an error while processing your request',
          },
        };
        const out = mapErrorToComponentError(event);
        expect(out.code).toBe('rate_limit_exceeded');
      });
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

    /** Issue #489: Component API uses { id, result?, error? }. When client sends result (no content), output is stringified result. */
    it('derives output from result when content is absent (component API shape)', () => {
      const msg = {
        type: 'FunctionCallResponse' as const,
        id: 'call_xyz',
        result: { time: '14:32:15', timezone: 'UTC' },
      };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.type).toBe('conversation.item.create');
      expect(out.item.call_id).toBe('call_xyz');
      expect(out.item.output).toBe(JSON.stringify({ time: '14:32:15', timezone: 'UTC' }));
    });

    it('derives output from result when result is a string (no content)', () => {
      const msg = {
        type: 'FunctionCallResponse' as const,
        id: 'call_s',
        result: 'The time is 14:32 UTC',
      };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.item.output).toBe('The time is 14:32 UTC');
    });

    it('derives output from error when content and result are absent', () => {
      const msg = {
        type: 'FunctionCallResponse' as const,
        id: 'call_err',
        error: 'Function failed',
      };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.item.output).toBe(JSON.stringify({ error: 'Function failed' }));
    });

    it('returns empty output when only id is present (no content, result, or error)', () => {
      const msg = { type: 'FunctionCallResponse' as const, id: 'call_minimal' };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.item.output).toBe('');
    });

    it('prefers content over result when both are present', () => {
      const msg = {
        type: 'FunctionCallResponse' as const,
        id: 'call_both',
        content: '{"time":"12:00"}',
        result: { time: '99:99', timezone: 'UTC' },
      };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.item.output).toBe('{"time":"12:00"}');
    });

    it('accepts message without name (name is optional)', () => {
      const msg = {
        type: 'FunctionCallResponse' as const,
        id: 'call_no_name',
        result: { ok: true },
      };
      const out = mapFunctionCallResponseToConversationItemCreate(msg);
      expect(out.item.call_id).toBe('call_no_name');
      expect(out.item.output).toBe(JSON.stringify({ ok: true }));
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

    it('maps conversation.item.added (assistant, content array with part.text) to ConversationText', () => {
      const event = {
        type: 'conversation.item.added' as const,
        item: { id: 'item_1', type: 'message', role: 'assistant' as const, content: [{ type: 'output_text', text: 'The capital is Paris.' }] },
      };
      const out = mapConversationItemAddedToConversationText(event);
      expect(out).toEqual({ type: 'ConversationText', role: 'assistant', content: 'The capital is Paris.' });
    });

    it('maps conversation.item.added (assistant, content as single object with .text) to ConversationText', () => {
      const event = {
        type: 'conversation.item.added' as const,
        item: { id: 'item_1', role: 'assistant' as const, content: { type: 'output_text', text: 'Hello.' } },
      };
      const out = mapConversationItemAddedToConversationText(event);
      expect(out).toEqual({ type: 'ConversationText', role: 'assistant', content: 'Hello.' });
    });

    it('maps conversation.item.added (assistant, part with output_text object) to ConversationText', () => {
      const event = {
        type: 'conversation.item.added' as const,
        item: { id: 'item_1', role: 'assistant' as const, content: [{ output_text: { text: 'From output_text.' } }] },
      };
      const out = mapConversationItemAddedToConversationText(event);
      expect(out).toEqual({ type: 'ConversationText', role: 'assistant', content: 'From output_text.' });
    });

    it('mapConversationItemAddedToConversationText returns null for non-assistant role', () => {
      const event = {
        type: 'conversation.item.added' as const,
        item: { id: 'item_1', role: 'user' as const, content: [{ text: 'User said this.' }] },
      };
      expect(mapConversationItemAddedToConversationText(event)).toBeNull();
    });

    it('mapConversationItemAddedToConversationText returns null for empty or missing content', () => {
      expect(mapConversationItemAddedToConversationText({ type: 'conversation.item.added', item: { role: 'assistant', content: [] } })).toBeNull();
      expect(mapConversationItemAddedToConversationText({ type: 'conversation.item.added', item: { role: 'assistant' } })).toBeNull();
    });

    it('maps conversation.item.created (assistant) to ConversationText (real API may send content in .created)', () => {
      const event = {
        type: 'conversation.item.created' as const,
        item: { id: 'item_2', type: 'message', role: 'assistant' as const, content: [{ type: 'output_text', text: 'Reply from .created.' }] },
      };
      const out = mapConversationItemAddedToConversationText(event);
      expect(out).toEqual({ type: 'ConversationText', role: 'assistant', content: 'Reply from .created.' });
    });

    it('maps conversation.item.done (assistant) to ConversationText (real API may send content in .done)', () => {
      const event = {
        type: 'conversation.item.done' as const,
        item: { id: 'item_3', type: 'message', role: 'assistant' as const, content: [{ type: 'output_text', text: 'Reply from .done.' }] },
      };
      const out = mapConversationItemAddedToConversationText(event);
      expect(out).toEqual({ type: 'ConversationText', role: 'assistant', content: 'Reply from .done.' });
    });

    it('maps conversation.item.done (assistant) with output_audio transcript to ConversationText (real API shape, Issue #489)', () => {
      const event = {
        type: 'conversation.item.done' as const,
        item: {
          id: 'item_DGvkyAAsUpgzAMehIVRim',
          type: 'message',
          status: 'completed',
          role: 'assistant' as const,
          content: [{ type: 'output_audio', transcript: "The capital of France is Paris. It's a major European city and a global center for art, fashion, and culture." }],
        },
      };
      const out = mapConversationItemAddedToConversationText(event);
      expect(out).toEqual({
        type: 'ConversationText',
        role: 'assistant',
        content: "The capital of France is Paris. It's a major European city and a global center for art, fashion, and culture.",
      });
    });
  });

  describe('6b. response.output_text.done fallback text (Issue #555)', () => {
    it('extracts text from top-level .text (mock / common shape)', () => {
      expect(
        extractAssistantTextFromResponseOutputTextDone({
          type: 'response.output_text.done',
          text: '  Hello  ',
        })
      ).toBe('Hello');
    });

    it('extracts text from nested part.text', () => {
      expect(
        extractAssistantTextFromResponseOutputTextDone({
          type: 'response.output_text.done',
          part: { text: 'Nested reply.' },
        })
      ).toBe('Nested reply.');
    });

    it('returns null when text missing or whitespace', () => {
      expect(extractAssistantTextFromResponseOutputTextDone({ type: 'response.output_text.done' })).toBeNull();
      expect(extractAssistantTextFromResponseOutputTextDone({ type: 'response.output_text.done', text: '   ' })).toBeNull();
      expect(extractAssistantTextFromResponseOutputTextDone(null)).toBeNull();
    });

    it('mergeAssistantTextFromOutputTextDoneAndDeltas prefers .done text over accumulated deltas', () => {
      expect(
        mergeAssistantTextFromOutputTextDoneAndDeltas({ type: 'response.output_text.done', text: 'Final.' }, 'partial')
      ).toBe('Final.');
    });

    it('mergeAssistantTextFromOutputTextDoneAndDeltas uses deltas when .done has no text', () => {
      expect(mergeAssistantTextFromOutputTextDoneAndDeltas({ type: 'response.output_text.done' }, '  noon UTC  ')).toBe(
        'noon UTC',
      );
    });

    it('mergeAssistantTextFromOutputTextDoneAndDeltas returns null when both empty', () => {
      expect(mergeAssistantTextFromOutputTextDoneAndDeltas({ type: 'response.output_text.done' }, '')).toBeNull();
      expect(mergeAssistantTextFromOutputTextDoneAndDeltas({ type: 'response.output_text.done', text: '   ' }, '')).toBeNull();
    });
  });

  describe('6c. response.done embedded response.output (Issue #470 real API)', () => {
    it('extractAssistantTextFromResponseDoneEvent reads assistant message from response.output', () => {
      const event = {
        type: 'response.done',
        response: {
          id: 'resp_1',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'The time is 12:00 in UTC.' }],
            },
          ],
        },
      };
      expect(extractAssistantTextFromResponseDoneEvent(event)).toBe('The time is 12:00 in UTC.');
    });

    it('extractAssistantTextFromResponseDoneEvent joins multiple text parts with newline', () => {
      const event = {
        type: 'response.done',
        response: {
          output: [
            {
              role: 'assistant',
              content: [{ type: 'output_text', text: 'Line A' }, { type: 'output_text', text: 'Line B' }],
            },
          ],
        },
      };
      expect(extractAssistantTextFromResponseDoneEvent(event)).toBe('Line A\nLine B');
    });

    it('extractAssistantTextFromResponseDoneEvent returns null when no assistant output', () => {
      expect(extractAssistantTextFromResponseDoneEvent({ type: 'response.done' })).toBeNull();
      expect(extractAssistantTextFromResponseDoneEvent({ type: 'response.done', response: {} })).toBeNull();
      expect(
        extractAssistantTextFromResponseDoneEvent({
          type: 'response.done',
          response: { output: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }] },
        }),
      ).toBeNull();
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
