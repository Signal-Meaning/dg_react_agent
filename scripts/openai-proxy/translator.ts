/**
 * OpenAI Realtime proxy – translation layer (Issue #381)
 *
 * Pure mapping functions: component (Deepgram Voice Agent protocol) ↔ OpenAI Realtime.
 * See docs/issues/ISSUE-381/API-DISCONTINUITIES.md.
 */

/** Component message: Settings (outgoing) */
export interface ComponentSettings {
  type: 'Settings';
  audio?: { input?: { encoding?: string; sample_rate?: number }; output?: { encoding?: string; sample_rate?: number } };
  agent?: {
    think?: { provider?: { model?: string }; prompt?: string; functions?: Array<{ name: string; description?: string; parameters?: unknown }> };
    speak?: { provider?: { voice?: string } };
  };
}

/** OpenAI client event: session.update payload */
export interface OpenAISessionUpdate {
  type: 'session.update';
  session: {
    type: 'realtime';
    model?: string;
    instructions?: string;
    voice?: string;
    tools?: Array<{ type: 'function'; name: string; description?: string; parameters?: unknown }>;
    [key: string]: unknown;
  };
}

/** Component message: InjectUserMessage (outgoing) */
export interface ComponentInjectUserMessage {
  type: 'InjectUserMessage';
  content: string;
}

/** OpenAI client event: conversation.item.create (user text) */
export interface OpenAIConversationItemCreate {
  type: 'conversation.item.create';
  item: { type: 'message'; role: 'user'; content: Array<{ type: 'input_text'; text: string }> };
}

/** Component message: SettingsApplied (incoming) */
export interface ComponentSettingsApplied {
  type: 'SettingsApplied';
}

/** OpenAI server event: session.updated */
export interface OpenAISessionUpdated {
  type: 'session.updated';
  session?: unknown;
}

/** Component message: ConversationText (incoming) */
export interface ComponentConversationText {
  type: 'ConversationText';
  role: 'user' | 'assistant';
  content: string;
}

/** OpenAI server event: response.output_text.done */
export interface OpenAIOutputTextDone {
  type: 'response.output_text.done';
  text?: string;
}

/** OpenAI server event: response.output_audio_transcript.done (transcript of model's speech) */
export interface OpenAIOutputAudioTranscriptDone {
  type: 'response.output_audio_transcript.done';
  transcript?: string;
}

/** Component message: Error (incoming) */
export interface ComponentError {
  type: 'Error';
  description: string;
  code?: string;
}

/** OpenAI server event: error */
export interface OpenAIErrorEvent {
  type: 'error';
  error?: { message?: string; code?: string; [key: string]: unknown };
}

/**
 * Map component Settings → OpenAI session.update payload (client event).
 */
export function mapSettingsToSessionUpdate(settings: ComponentSettings): OpenAISessionUpdate {
  const session: OpenAISessionUpdate['session'] = {
    type: 'realtime',
    model: settings.agent?.think?.provider?.model ?? 'gpt-realtime',
    instructions: settings.agent?.think?.prompt ?? '',
    // Do not send voice in session.update; current Realtime API returns "Unknown parameter: 'session.voice'".
    // Voice can be set via the WebSocket URL (e.g. ?voice=alloy) if the API supports it.
  };
  if (settings.agent?.think?.functions?.length) {
    session.tools = settings.agent.think.functions.map((f) => ({
      type: 'function' as const,
      name: f.name,
      description: f.description,
      parameters: f.parameters ?? {},
    }));
  }
  return { type: 'session.update', session };
}

/**
 * Map component InjectUserMessage → OpenAI conversation.item.create (client event).
 */
export function mapInjectUserMessageToConversationItemCreate(msg: ComponentInjectUserMessage): OpenAIConversationItemCreate {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: msg.content ?? '' }],
    },
  };
}

/**
 * Map OpenAI session.updated (or session.created) → component SettingsApplied.
 */
export function mapSessionUpdatedToSettingsApplied(_event?: OpenAISessionUpdated): ComponentSettingsApplied {
  return { type: 'SettingsApplied' };
}

/**
 * Map OpenAI response.output_text.done → component ConversationText (assistant).
 */
export function mapOutputTextDoneToConversationText(event: OpenAIOutputTextDone): ComponentConversationText {
  return {
    type: 'ConversationText',
    role: 'assistant',
    content: event.text ?? '',
  };
}

/**
 * Map OpenAI response.output_audio_transcript.done → component ConversationText (assistant).
 * When the model returns audio, the transcript is in this event; we send it so the UI shows the response.
 */
export function mapOutputAudioTranscriptDoneToConversationText(
  event: OpenAIOutputAudioTranscriptDone
): ComponentConversationText {
  return {
    type: 'ConversationText',
    role: 'assistant',
    content: event.transcript ?? '',
  };
}

/**
 * Map OpenAI error event → component Error.
 */
export function mapErrorToComponentError(event: OpenAIErrorEvent): ComponentError {
  const msg = event.error?.message ?? 'Unknown error';
  const code = event.error?.code ?? 'unknown';
  return { type: 'Error', description: String(msg), code: String(code) };
}

/** OpenAI client event: input_audio_buffer.append (base64 audio) */
export interface OpenAIInputAudioBufferAppend {
  type: 'input_audio_buffer.append';
  audio: string;
}

/**
 * Map component binary audio (Buffer) → OpenAI input_audio_buffer.append (base64).
 * Component sends raw PCM over WebSocket; OpenAI expects base64 in this event.
 */
export function binaryToInputAudioBufferAppend(buffer: Buffer): OpenAIInputAudioBufferAppend {
  return {
    type: 'input_audio_buffer.append',
    audio: buffer.toString('base64'),
  };
}
