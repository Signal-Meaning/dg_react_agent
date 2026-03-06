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
    /** Idle timeout in ms; shared with component (WebSocketManager, useIdleTimeoutManager). Proxy sends in session.update. */
    idleTimeoutMs?: number;
    think?: { provider?: { model?: string }; prompt?: string; functions?: Array<{ name: string; description?: string; parameters?: unknown }> };
    speak?: { provider?: { voice?: string } };
    /** Conversation context for session continuity (Deepgram: in Settings; OpenAI: via conversation.item.create) */
    context?: { messages?: Array<{ type?: string; role: 'user' | 'assistant'; content: string }> };
    /** Optional greeting; proxy injects as initial assistant message after session.updated (Issue #381) */
    greeting?: string;
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
    /** GA API: audio config under session.audio.input (see REGRESSION-SERVER-ERROR-INVESTIGATION.md Cycle 2). */
    audio?: {
      input?: {
        turn_detection?: { type: 'server_vad'; create_response?: boolean; interrupt_response?: boolean; idle_timeout_ms?: number } | null;
        /** Tell API we send PCM 24kHz 16-bit mono (avoids format mismatch). */
        format?: { type: string; rate?: number };
        /** Enable input audio transcription for conversation.item.input_audio_transcription.* (Issue #414). */
        transcription?: { model: string; language?: string; prompt?: string };
      };
    };
    tools?: Array<{ type: 'function'; name: string; description?: string; parameters?: unknown }>;
    [key: string]: unknown;
  };
}

/** Component message: InjectUserMessage (outgoing) */
export interface ComponentInjectUserMessage {
  type: 'InjectUserMessage';
  content: string;
}

/** OpenAI Realtime API: user message content uses input_text, assistant uses output_text (API rejects input_text for assistant). */
export type OpenAIMessageContentItem =
  | { type: 'input_text'; text: string }
  | { type: 'output_text'; text: string };

/** OpenAI client event: conversation.item.create (user or assistant message) */
export interface OpenAIConversationItemCreate {
  type: 'conversation.item.create';
  item: { type: 'message'; role: 'user' | 'assistant'; content: Array<OpenAIMessageContentItem> };
}

/**
 * Map a component context message (History item) → OpenAI conversation.item.create.
 * OpenAI does not send context in session.update; context is populated via conversation.item.create.
 * Per OpenAI Realtime API: user messages use content type input_text; assistant messages use output_text.
 */
export function mapContextMessageToConversationItemCreate(role: 'user' | 'assistant', content: string): OpenAIConversationItemCreate {
  const contentType = role === 'user' ? 'input_text' : 'output_text';
  return {
    type: 'conversation.item.create',
    item: { type: 'message', role, content: [{ type: contentType, text: content ?? '' }] },
  };
}

/**
 * Map greeting string → OpenAI conversation.item.create (assistant message).
 * Used after session.updated to inject component-provided greeting into OpenAI conversation (Issue #381).
 */
export function mapGreetingToConversationItemCreate(greeting: string): OpenAIConversationItemCreate {
  return mapContextMessageToConversationItemCreate('assistant', greeting ?? '');
}

/**
 * Map greeting string → component ConversationText (assistant).
 * Sent to component after session.updated so UI shows greeting (Issue #381).
 */
export function mapGreetingToConversationText(greeting: string): ComponentConversationText {
  return {
    type: 'ConversationText',
    role: 'assistant',
    content: greeting ?? '',
  };
}

/** Component message: FunctionCallRequest (incoming from proxy to client) */
export interface ComponentFunctionCallRequest {
  type: 'FunctionCallRequest';
  functions: Array<{ id: string; name: string; arguments: string; client_side: boolean }>;
}

/** Component message: FunctionCallResponse (outgoing from client to proxy) */
export interface ComponentFunctionCallResponse {
  type: 'FunctionCallResponse';
  id: string;
  name: string;
  content: string;
}

/** OpenAI client event: conversation.item.create (function_call_output) */
export interface OpenAIConversationItemCreateFunctionCallOutput {
  type: 'conversation.item.create';
  item: { type: 'function_call_output'; call_id: string; output: string };
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

/** OpenAI server event: response.function_call_arguments.done (model requested a function call) */
export interface OpenAIFunctionCallArgumentsDone {
  type: 'response.function_call_arguments.done';
  name?: string;
  arguments?: string;
  call_id?: string;
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
    // GA API: turn_detection is under session.audio.input (REGRESSION-SERVER-ERROR-INVESTIGATION.md Cycle 2).
    // Use turn_detection: null so the server does NOT auto-commit the audio buffer; only the proxy sends
    // input_audio_buffer.commit + response.create. With server_vad enabled the server commits on VAD and
    // our commit then sees "buffer too small ... 0.00ms" (Issue #414, PROTOCOL §3.6). See Issue #451 Phase 2.
    // With turn_detection: null the OpenAI server has no server idle timeout (idle_timeout_ms only under server_vad).
    // We convey "no server timeout" as -1 (NO_SERVER_TIMEOUT_MS). See PROTOCOL-AND-MESSAGE-ORDERING.md §3.9.
    audio: {
      input: {
        turn_detection: null,
        format: { type: 'audio/pcm', rate: 24000 },
        // Enable input audio transcription so we get conversation.item.input_audio_transcription.* (Issue #414).
        transcription: { model: 'gpt-4o-transcribe', language: 'en', prompt: '' },
      },
    },
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
 * Map OpenAI response.function_call_arguments.done → component FunctionCallRequest.
 * So the component invokes onFunctionCallRequest and can return a result within ~1s for the backend.
 */
export function mapFunctionCallArgumentsDoneToFunctionCallRequest(
  event: OpenAIFunctionCallArgumentsDone
): ComponentFunctionCallRequest {
  const callId = event.call_id ?? '';
  const name = event.name ?? 'function';
  const args = event.arguments ?? '';
  return {
    type: 'FunctionCallRequest',
    functions: [{ id: callId, name, arguments: args, client_side: true }],
  };
}

/**
 * Map OpenAI response.function_call_arguments.done → component ConversationText (assistant).
 * Optional: so the app can show that a function was requested (e.g. "Function call: get_current_time()").
 */
export function mapFunctionCallArgumentsDoneToConversationText(
  event: OpenAIFunctionCallArgumentsDone
): ComponentConversationText {
  const name = event.name ?? 'function';
  const args = event.arguments?.trim();
  const content = args ? `Function call: ${name}(${args})` : `Function call: ${name}()`;
  return {
    type: 'ConversationText',
    role: 'assistant',
    content,
  };
}

/**
 * Map component FunctionCallResponse → OpenAI conversation.item.create (function_call_output).
 * Required so the backend receives the function result and can continue the response.
 */
export function mapFunctionCallResponseToConversationItemCreate(
  msg: ComponentFunctionCallResponse
): OpenAIConversationItemCreateFunctionCallOutput {
  return {
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: msg.id, output: msg.content ?? '' },
  };
}

/** Protocol-defined component error codes for expected closures (Issue #489, codes over message text). */
const COMPONENT_CODE_IDLE_TIMEOUT = 'idle_timeout';
const COMPONENT_CODE_SESSION_MAX_DURATION = 'session_max_duration';

/**
 * Map API error code to component code. Pass-through for known protocol codes and any other API code.
 * Single source of truth for API code → component code (DRY).
 */
function mapApiErrorCodeToComponentCode(apiCode: string): string {
  if (apiCode === COMPONENT_CODE_IDLE_TIMEOUT || apiCode === COMPONENT_CODE_SESSION_MAX_DURATION) {
    return apiCode;
  }
  return apiCode;
}

/**
 * Legacy fallback: infer component code from message when API does not send error.code.
 * Avoid using for control flow when API provides structured code. See PROTOCOL-AND-MESSAGE-ORDERING §3.9.
 */
function legacyInferCodeFromMessage(event: OpenAIErrorEvent): string | undefined {
  const msg = event.error?.message ?? '';
  if (typeof msg !== 'string') return undefined;
  if (msg.includes('maximum duration') && msg.includes('60 minutes')) {
    return COMPONENT_CODE_SESSION_MAX_DURATION;
  }
  if (msg.includes('The server had an error while processing your request')) {
    return COMPONENT_CODE_IDLE_TIMEOUT;
  }
  return undefined;
}

/**
 * Get component error code from upstream error event. Prefers API structured code (event.error?.code);
 * uses legacy message fallback only when code is absent. Issue #489, codes over message text.
 */
export function getComponentErrorCode(event: OpenAIErrorEvent): string {
  const apiCode = event.error?.code;
  if (apiCode !== undefined && apiCode !== '') {
    return mapApiErrorCodeToComponentCode(apiCode);
  }
  return legacyInferCodeFromMessage(event) ?? 'unknown';
}

/**
 * Detect expected "session hit the maximum duration of 60 minutes" event.
 * Per PROTOCOL-AND-MESSAGE-ORDERING.md §3.8. Implemented via getComponentErrorCode (DRY).
 */
export function isSessionMaxDurationError(event: OpenAIErrorEvent): boolean {
  return getComponentErrorCode(event) === COMPONENT_CODE_SESSION_MAX_DURATION;
}

/**
 * Detect expected idle-timeout closure. Implemented via getComponentErrorCode (DRY).
 * Legacy: upstream may send generic message when code absent; we prefer API code when present.
 */
export function isIdleTimeoutClosure(event: OpenAIErrorEvent): boolean {
  return getComponentErrorCode(event) === COMPONENT_CODE_IDLE_TIMEOUT;
}

/**
 * Map OpenAI error event → component Error.
 * Uses getComponentErrorCode (code-first, then legacy message fallback). Issue #489, DRY.
 */
export function mapErrorToComponentError(event: OpenAIErrorEvent): ComponentError {
  const msg = event.error?.message ?? 'Unknown error';
  const code = getComponentErrorCode(event);
  return { type: 'Error', description: String(msg), code };
}

/** OpenAI server event: conversation.item.input_audio_transcription.completed (user speech transcript) */
export interface OpenAIInputAudioTranscriptionCompleted {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id?: string;
  content_index?: number;
  transcript?: string;
}

/** OpenAI server event: conversation.item.input_audio_transcription.delta (interim user transcript) */
export interface OpenAIInputAudioTranscriptionDelta {
  type: 'conversation.item.input_audio_transcription.delta';
  item_id?: string;
  content_index?: number;
  delta?: string;
}

/** Component message: Transcript (incoming from proxy; same shape as Deepgram Results/Transcript for onTranscriptUpdate) */
export interface ComponentTranscript {
  type: 'Transcript';
  transcript: string;
  is_final: boolean;
  speech_final: boolean;
  channel: number;
  channel_index: number[];
  start: number;
  duration: number;
  alternatives: Array<{ transcript: string; confidence: number; words: unknown[] }>;
}

/**
 * Map OpenAI conversation.item.input_audio_transcription.completed → component Transcript.
 * Component maps this to TranscriptResponse and calls onTranscriptUpdate (Issue #414).
 */
export function mapInputAudioTranscriptionCompletedToTranscript(
  event: OpenAIInputAudioTranscriptionCompleted
): ComponentTranscript {
  const transcript = event.transcript ?? '';
  return {
    type: 'Transcript',
    transcript,
    is_final: true,
    speech_final: true,
    channel: 0,
    channel_index: [0],
    start: 0,
    duration: 0,
    alternatives: [{ transcript, confidence: 1, words: [] }],
  };
}

/**
 * Map OpenAI conversation.item.input_audio_transcription.delta → component Transcript (interim).
 * Component maps this to TranscriptResponse and calls onTranscriptUpdate (Issue #414).
 */
export function mapInputAudioTranscriptionDeltaToTranscript(
  event: OpenAIInputAudioTranscriptionDelta,
  accumulated?: string
): ComponentTranscript {
  const delta = event.delta ?? '';
  const transcript = (accumulated ?? '') + delta;
  return {
    type: 'Transcript',
    transcript,
    is_final: false,
    speech_final: false,
    channel: 0,
    channel_index: [0],
    start: 0,
    duration: 0,
    alternatives: [{ transcript, confidence: 1, words: [] }],
  };
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
