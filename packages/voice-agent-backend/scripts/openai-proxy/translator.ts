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

/** Component message: FunctionCallResponse (outgoing from client to proxy).
 * Component public API uses { id, result?, error? }. The component may stringify result and send as content
 * when using the callback; some paths (e.g. app backend) send result only. We accept both for robustness.
 */
export interface ComponentFunctionCallResponse {
  type: 'FunctionCallResponse';
  id: string;
  name?: string;
  /** String payload for OpenAI function_call_output (preferred when component has already stringified). */
  content?: string;
  /** Function result (object/string); used when content is absent. Serialized to JSON for output. */
  result?: unknown;
  /** Error message when function failed; sent as output so model can respond. */
  error?: string;
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

/** OpenAI server event: conversation.item.added (item may be assistant message with content) */
export interface OpenAIConversationItemAdded {
  type: 'conversation.item.added';
  item?: {
    id?: string;
    type?: string;
    role?: 'user' | 'assistant' | 'system';
    content?: Array<{ type?: string; text?: string }>;
  };
}

/** Same item shape for .created / .added / .done (real API may send assistant content in any of these). */
export type OpenAIConversationItemEvent =
  | OpenAIConversationItemAdded
  | { type: 'conversation.item.created'; item?: OpenAIConversationItemAdded['item'] }
  | { type: 'conversation.item.done'; item?: OpenAIConversationItemAdded['item'] };

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
 * Build instructions string: base prompt + optional prior conversation context.
 * Issue #489: Do not inject prior-session context as conversation items (that causes API to echo them and duplicate in UI).
 * Instead we pass context in the session instructions so the model has history without creating items.
 */
function buildInstructionsWithContext(settings: ComponentSettings): string {
  const base = settings.agent?.think?.prompt ?? '';
  const messages = settings.agent?.context?.messages;
  if (!messages?.length) return base;
  const lines = messages.map((m) => {
    const role = m.role === 'user' || m.role === 'assistant' ? m.role : 'user';
    const content = (m.content ?? '').trim();
    return `${role}: ${content}`;
  });
  const contextBlock = `\n\nPrevious conversation:\n${lines.join('\n')}`;
  return base ? base + contextBlock : contextBlock.trim();
}

/**
 * Map component Settings → OpenAI session.update payload (client event).
 */
export function mapSettingsToSessionUpdate(settings: ComponentSettings): OpenAISessionUpdate {
  const session: OpenAISessionUpdate['session'] = {
    type: 'realtime',
    model: settings.agent?.think?.provider?.model ?? 'gpt-realtime',
    instructions: buildInstructionsWithContext(settings),
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
 * Single source for "Function call: name(args)" text (DRY; Issue #499, unit tests).
 * Used by mapFunctionCallArgumentsDoneToConversationText and formatFunctionCallPartForConversationText.
 */
export function functionCallToConversationTextContent(name: string, args?: string): string {
  const trimmed = typeof args === 'string' ? args.trim() : '';
  return trimmed ? `Function call: ${name}(${trimmed})` : `Function call: ${name}()`;
}

/**
 * Map OpenAI response.function_call_arguments.done → component ConversationText (assistant).
 * Optional: so the app can show that a function was requested (e.g. "Function call: get_current_time()").
 */
export function mapFunctionCallArgumentsDoneToConversationText(
  event: OpenAIFunctionCallArgumentsDone
): ComponentConversationText {
  const content = functionCallToConversationTextContent(event.name ?? 'function', event.arguments);
  return { type: 'ConversationText', role: 'assistant', content };
}

/**
 * Format a function_call content part as ConversationText (Issue #499 Deepgram parity).
 * Uses functionCallToConversationTextContent so history matches FCR format.
 */
function formatFunctionCallPartForConversationText(part: Record<string, unknown>): string {
  const name = typeof part.name === 'string' ? part.name : 'function';
  const args = typeof part.arguments === 'string' ? part.arguments : undefined;
  return functionCallToConversationTextContent(name, args);
}

/**
 * Extract a single text string from a content part (OpenAI Realtime API can use different shapes).
 * Primary: part.text. Also: part.transcript (output_audio), part.output_text (object with .text), part.input_text (object with .text), part.content (string).
 * Issue #499: part.type === 'function_call' → "Function call: name(args)" for Deepgram parity in conversation history.
 * Real API sends assistant content in conversation.item.done with content parts like { type: "output_audio", transcript: "..." } (Issue #489).
 */
function extractTextFromContentPart(part: unknown): string | null {
  if (!part || typeof part !== 'object') return null;
  const p = part as Record<string, unknown>;
  if (p.type === 'function_call') return formatFunctionCallPartForConversationText(p);
  if (typeof p.text === 'string' && p.text.trim()) return p.text.trim();
  if (typeof p.transcript === 'string' && p.transcript.trim()) return p.transcript.trim();
  if (p.output_text && typeof p.output_text === 'object' && typeof (p.output_text as { text?: string }).text === 'string') {
    const t = (p.output_text as { text: string }).text.trim();
    if (t) return t;
  }
  if (p.input_text && typeof p.input_text === 'object' && typeof (p.input_text as { text?: string }).text === 'string') {
    const t = (p.input_text as { text: string }).text.trim();
    if (t) return t;
  }
  if (typeof p.content === 'string' && p.content.trim()) return p.content.trim();
  return null;
}

/**
 * Map OpenAI conversation.item.created / .added / .done (assistant message with content) → component ConversationText (assistant).
 * This is the primary pipeline for assistant text. Returns null when the item is not an assistant
 * message or has no extractable text content. Issue #489.
 * Handles multiple API shapes: content as array of { text }, { type, text }, { output_text: { text } }, or single object.
 * Real API may send assistant content in .created or .done instead of .added.
 */
export function mapConversationItemAddedToConversationText(
  event: OpenAIConversationItemEvent
): ComponentConversationText | null {
  const item = event.item;
  if (!item) return null;
  const role = item.role;
  if (role !== 'assistant') return null;
  const content = item.content;
  const contentArray = Array.isArray(content) ? content : content && typeof content === 'object' ? [content] : [];
  if (contentArray.length === 0) return null;
  const parts: string[] = [];
  for (const part of contentArray) {
    const text = extractTextFromContentPart(part);
    if (text) parts.push(text);
  }
  if (parts.length === 0) return null;
  return {
    type: 'ConversationText',
    role: 'assistant',
    content: parts.join('\n'),
  };
}

/**
 * Derive OpenAI function_call_output string from component FunctionCallResponse.
 * Component API uses result/error; component may send content (string) after stringifying result.
 */
function functionCallOutputFromResponse(msg: ComponentFunctionCallResponse): string {
  if (typeof msg.content === 'string' && msg.content.length > 0) return msg.content;
  if (msg.error != null) return JSON.stringify({ error: msg.error });
  if (msg.result !== undefined && msg.result !== null)
    return typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result);
  return '';
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
    item: { type: 'function_call_output', call_id: msg.id, output: functionCallOutputFromResponse(msg) },
  };
}

/** Protocol-defined component error codes for expected closures (Issue #489, codes over message text). */
const COMPONENT_CODE_IDLE_TIMEOUT = 'idle_timeout';
const COMPONENT_CODE_SESSION_MAX_DURATION = 'session_max_duration';

/**
 * Map API error code to component code. Currently pass-through; extend here if the API
 * sends a code we must normalize to a component protocol code (single source of truth).
 */
function mapApiErrorCodeToComponentCode(apiCode: string): string {
  return apiCode;
}

/**
 * Get component error code from upstream error event. Uses only API structured code (event.error?.code).
 * When the API omits code, returns 'unknown'. Do not infer from message text (antipattern removed).
 * Call sites that depend on a specific code when the API sends no code are likely defect sources.
 */
export function getComponentErrorCode(event: OpenAIErrorEvent): string {
  const apiCode = event.error?.code;
  if (apiCode !== undefined && apiCode !== '') {
    return mapApiErrorCodeToComponentCode(apiCode);
  }
  return 'unknown';
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
 * True only when the API sends event.error.code === 'idle_timeout'.
 */
export function isIdleTimeoutClosure(event: OpenAIErrorEvent): boolean {
  return getComponentErrorCode(event) === COMPONENT_CODE_IDLE_TIMEOUT;
}

/**
 * Map OpenAI error event → component Error.
 * Uses getComponentErrorCode (structured code only; returns 'unknown' when API omits code). Issue #489.
 */
export function mapErrorToComponentError(event: OpenAIErrorEvent): ComponentError {
  const msg = event.error?.message ?? 'Unknown error';
  const code = getComponentErrorCode(event);
  return { type: 'Error', description: String(msg), code };
}

/** OpenAI server event: conversation.item.input_audio_transcription.completed (user speech transcript).
 * Issue #496: optional start, duration, channel, channel_index — pass through when present; defaults when absent. */
export interface OpenAIInputAudioTranscriptionCompleted {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id?: string;
  content_index?: number;
  transcript?: string;
  start?: number;
  duration?: number;
  channel?: number;
  channel_index?: number[];
  alternatives?: Array<{ transcript?: string; confidence?: number; words?: unknown[] }>;
}

/** OpenAI server event: conversation.item.input_audio_transcription.delta (interim user transcript).
 * Issue #496: optional start, duration, channel, channel_index — pass through when present. */
export interface OpenAIInputAudioTranscriptionDelta {
  type: 'conversation.item.input_audio_transcription.delta';
  item_id?: string;
  content_index?: number;
  delta?: string;
  start?: number;
  duration?: number;
  channel?: number;
  channel_index?: number[];
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

/** Issue #496: shared channel/timing extraction for Transcript mappers (DRY). */
function transcriptChannelAndTiming(event: {
  channel?: number;
  channel_index?: number[];
  start?: number;
  duration?: number;
}): { channel: number; channel_index: number[]; start: number; duration: number } {
  const channelIndex = Array.isArray(event.channel_index) && event.channel_index.length > 0
    ? event.channel_index
    : (typeof event.channel === 'number' ? [event.channel] : [0]);
  const channel = typeof event.channel === 'number' ? event.channel : (channelIndex[0] ?? 0);
  const start = typeof event.start === 'number' ? event.start : 0;
  const duration = typeof event.duration === 'number' ? event.duration : 0;
  return { channel, channel_index: channelIndex, start, duration };
}

/**
 * Map OpenAI conversation.item.input_audio_transcription.completed → component Transcript.
 * Component maps this to TranscriptResponse and calls onTranscriptUpdate (Issue #414).
 * Issue #496: use upstream start, duration, channel, channel_index, alternatives when present; defaults when absent.
 */
export function mapInputAudioTranscriptionCompletedToTranscript(
  event: OpenAIInputAudioTranscriptionCompleted
): ComponentTranscript {
  const transcript = event.transcript ?? '';
  const { channel, channel_index, start, duration } = transcriptChannelAndTiming(event);
  const alternatives = Array.isArray(event.alternatives) && event.alternatives.length > 0
    ? event.alternatives.map((a) => ({
        transcript: a.transcript ?? transcript,
        confidence: typeof a.confidence === 'number' ? a.confidence : 1,
        words: Array.isArray(a.words) ? a.words : [],
      }))
    : [{ transcript, confidence: 1, words: [] }];
  return {
    type: 'Transcript',
    transcript,
    is_final: true,
    speech_final: true,
    channel,
    channel_index,
    start,
    duration,
    alternatives,
  };
}

/**
 * Map OpenAI conversation.item.input_audio_transcription.delta → component Transcript (interim).
 * Component maps this to TranscriptResponse and calls onTranscriptUpdate (Issue #414).
 * Issue #496: use upstream start, duration, channel, channel_index when present; defaults when absent.
 */
export function mapInputAudioTranscriptionDeltaToTranscript(
  event: OpenAIInputAudioTranscriptionDelta,
  accumulated?: string
): ComponentTranscript {
  const delta = event.delta ?? '';
  const transcript = (accumulated ?? '') + delta;
  const { channel, channel_index, start, duration } = transcriptChannelAndTiming(event);
  return {
    type: 'Transcript',
    transcript,
    is_final: false,
    speech_final: false,
    channel,
    channel_index,
    start,
    duration,
    alternatives: [{ transcript, confidence: 1, words: [] }],
  };
}

/** OpenAI server event: input_audio_buffer.speech_stopped (Issue #494: API may send channel, last_word_end) */
export interface OpenAISpeechStopped {
  type: 'input_audio_buffer.speech_stopped';
  channel?: number[];
  last_word_end?: number;
}

/** Component message: UtteranceEnd (VAD; same shape as Deepgram UtteranceEndResponse) */
export interface ComponentUtteranceEnd {
  type: 'UtteranceEnd';
  channel: number[];
  last_word_end: number;
}

/**
 * Map OpenAI input_audio_buffer.speech_stopped → component UtteranceEnd (Issue #494).
 * Use upstream channel and last_word_end when present; otherwise defaults [0, 1] and 0.
 */
export function mapSpeechStoppedToUtteranceEnd(event: OpenAISpeechStopped): ComponentUtteranceEnd {
  const channel = Array.isArray(event.channel) && event.channel.length > 0 ? event.channel : [0, 1];
  const last_word_end = typeof event.last_word_end === 'number' ? event.last_word_end : 0;
  return { type: 'UtteranceEnd', channel, last_word_end };
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
