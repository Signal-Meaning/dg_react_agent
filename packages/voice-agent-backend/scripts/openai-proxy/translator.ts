/**
 * OpenAI Realtime proxy – translation layer (Issue #381)
 *
 * Pure mapping functions: component (Deepgram Voice Agent protocol) ↔ OpenAI Realtime.
 * See docs/issues/ISSUE-381/API-DISCONTINUITIES.md.
 */

import {
  OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MAX,
  OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MIN,
} from './openai-audio-constants';

/**
 * OpenAI Realtime `session.tool_choice` (Issue #535).
 * @see https://platform.openai.com/docs/api-reference/realtime-client-events/session/update
 */
export type OpenAIRealtimeSessionToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string };

/**
 * OpenAI Realtime `session.output_modalities` entries (Issue #536).
 * @see https://platform.openai.com/docs/api-reference/realtime-client-events/session/update
 */
export type OpenAIRealtimeOutputModality = 'text' | 'audio';

/**
 * Realtime `session.max_output_tokens`: positive safe integer only (Issue #537).
 * Other values are ignored so the API keeps its default.
 */
function toSessionMaxOutputTokens(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value) || value <= 0) return undefined;
  if (!Number.isSafeInteger(value)) return undefined;
  return value;
}

/** OpenAI Realtime `session.audio.output` (RealtimeAudioConfigOutput) — Issue #540. */
export interface OpenAIRealtimeSessionAudioOutput {
  format?: { type: string; rate?: number };
  speed?: number;
  voice?: string | { id: string };
}

const REALTIME_OUTPUT_AUDIO_FORMAT_TYPES = new Set(['audio/pcm', 'audio/pcmu', 'audio/pcma']);

/**
 * Normalize Settings `agent.sessionAudioOutput` → `session.audio.output`.
 * Invalid fields are dropped; returns undefined if nothing valid remains.
 */
export function normalizeSessionAudioOutput(raw: unknown): OpenAIRealtimeSessionAudioOutput | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: OpenAIRealtimeSessionAudioOutput = {};

  const fmt = o.format;
  if (fmt !== null && typeof fmt === 'object' && !Array.isArray(fmt)) {
    const f = fmt as Record<string, unknown>;
    const t = typeof f.type === 'string' ? f.type.trim() : '';
    if (REALTIME_OUTPUT_AUDIO_FORMAT_TYPES.has(t)) {
      if (t === 'audio/pcm') {
        const rate = f.rate;
        if (rate === undefined || rate === 24000) {
          out.format = rate === 24000 ? { type: t, rate: 24000 } : { type: t };
        } else {
          out.format = { type: t };
        }
      } else {
        out.format = { type: t };
      }
    }
  }

  const speed = o.speed;
  if (typeof speed === 'number' && Number.isFinite(speed) && speed >= 0.25 && speed <= 1.5) {
    out.speed = speed;
  }

  const voice = o.voice;
  if (typeof voice === 'string' && voice.trim()) {
    out.voice = voice.trim();
  } else if (voice !== null && typeof voice === 'object' && !Array.isArray(voice)) {
    const vid = (voice as Record<string, unknown>).id;
    if (typeof vid === 'string' && vid.trim()) {
      out.voice = { id: vid.trim() };
    }
  }

  if (out.format === undefined && out.speed === undefined && out.voice === undefined) {
    return undefined;
  }
  return out;
}

/**
 * OpenAI Realtime `session.prompt` (ResponsePrompt: id, optional variables, optional version) — Issue #539.
 * @see https://platform.openai.com/docs/api-reference/realtime-client-events/session/update
 */
export interface OpenAIRealtimeSessionPrompt {
  id: string;
  variables?: Record<string, unknown>;
  version?: string;
}

/**
 * Normalize Settings `agent.think.managedPrompt` → API `session.prompt`.
 * Invalid shapes omit the whole reference (no partial prompt with empty id).
 */
function normalizeManagedPromptForSession(raw: unknown): OpenAIRealtimeSessionPrompt | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  if (!id) return undefined;
  const out: OpenAIRealtimeSessionPrompt = { id };
  if (typeof o.version === 'string') {
    const v = o.version.trim();
    if (v) out.version = v;
  }
  const vars = o.variables;
  if (vars !== undefined && vars !== null && typeof vars === 'object' && !Array.isArray(vars)) {
    out.variables = vars as Record<string, unknown>;
  }
  return out;
}

/** Component message: Settings (outgoing) */
export interface ComponentSettings {
  type: 'Settings';
  audio?: { input?: { encoding?: string; sample_rate?: number }; output?: { encoding?: string; sample_rate?: number } };
  agent?: {
    /** Idle timeout in ms; shared with component (WebSocketManager, useIdleTimeoutManager). Proxy sends in session.update. */
    idleTimeoutMs?: number;
    think?: {
      provider?: { model?: string; temperature?: number };
      prompt?: string;
      /** Issue #535: maps to Realtime `session.tool_choice` when set. */
      toolChoice?: OpenAIRealtimeSessionToolChoice;
      /** Issue #536: maps to Realtime `session.output_modalities` when non-empty after validation. */
      outputModalities?: OpenAIRealtimeOutputModality[];
      /** Issue #537: maps to Realtime `session.max_output_tokens` when a positive safe integer. */
      maxOutputTokens?: number;
      /** Issue #539: maps to Realtime `session.prompt` (managed prompt id / variables / version). */
      managedPrompt?: OpenAIRealtimeSessionPrompt;
      functions?: Array<{ name: string; description?: string; parameters?: unknown }>;
    };
    speak?: { provider?: { voice?: string } };
    /** Conversation context for session continuity (Deepgram: in Settings; OpenAI: via conversation.item.create) */
    context?: { messages?: Array<{ type?: string; role: 'user' | 'assistant'; content: string }> };
    /** Optional greeting; proxy injects as initial assistant message after session.updated (Issue #381) */
    greeting?: string;
    /** Issue #540: maps to Realtime `session.audio.output` when valid after normalization. */
    sessionAudioOutput?: OpenAIRealtimeSessionAudioOutput;
    /**
     * Issue #560 Phase 2b: When true, map `session.audio.input.turn_detection` to OpenAI **Server VAD**; the proxy
     * sends `input_audio_buffer.append` only (no `input_audio_buffer.commit` / `response.create` for mic audio).
     * Default false keeps `turn_detection: null` and manual commit (existing behavior).
     */
    useOpenAIServerVad?: boolean;
  };
}

/** OpenAI Realtime `session.audio.input.turn_detection` when `type` is `server_vad` (Issue #560 Phase 2b). */
export interface OpenAIRealtimeServerVadTurnDetection {
  type: 'server_vad';
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  /** Milliseconds; `null` when client idle is unset or sentinel -1 (no numeric server idle). Clamped to API range when set. */
  idle_timeout_ms?: number | null;
  create_response?: boolean;
  interrupt_response?: boolean;
}

/**
 * Build `turn_detection` for Server VAD from component idle timeout. Aligns with Realtime VAD guide defaults
 * (threshold, prefix/silence); `create_response: true` so the server starts the model turn after commit.
 */
export function buildOpenAIServerVadTurnDetection(idleTimeoutMs: number | undefined): OpenAIRealtimeServerVadTurnDetection {
  let idle: number | null = null;
  if (typeof idleTimeoutMs === 'number' && Number.isFinite(idleTimeoutMs) && idleTimeoutMs >= 0 && idleTimeoutMs !== -1) {
    idle = Math.min(
      OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MAX,
      Math.max(OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MIN, Math.round(idleTimeoutMs)),
    );
  }
  return {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 200,
    idle_timeout_ms: idle,
    create_response: true,
    interrupt_response: true,
  };
}

/** True when `session.update` maps mic input to OpenAI Server VAD (proxy must not send manual `input_audio_buffer.commit`). */
export function sessionUpdateUsesOpenAIServerVad(update: OpenAISessionUpdate): boolean {
  const td = update.session.audio?.input?.turn_detection;
  return td !== null && td !== undefined && typeof td === 'object' && (td as { type?: string }).type === 'server_vad';
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
        turn_detection?: OpenAIRealtimeServerVadTurnDetection | null;
        /** Tell API we send PCM 24kHz 16-bit mono (avoids format mismatch). */
        format?: { type: string; rate?: number };
        /** Enable input audio transcription for conversation.item.input_audio_transcription.* (Issue #414). */
        transcription?: { model: string; language?: string; prompt?: string };
      };
      /** Issue #540: TTS/output format, speed, voice (integrator-controlled). */
      output?: OpenAIRealtimeSessionAudioOutput;
    };
    tools?: Array<{ type: 'function'; name: string; description?: string; parameters?: unknown }>;
    /** Issue #535: how the model selects tools (`auto` | `none` | `required` or force `{ type: 'function', name }`). */
    tool_choice?: OpenAIRealtimeSessionToolChoice;
    /** Issue #536: model output channels (`text`, `audio`, or both). */
    output_modalities?: OpenAIRealtimeOutputModality[];
    /** Issue #537: cap generated output tokens (separate from context window / instructions size). */
    max_output_tokens?: number;
    /** Issue #539: Dashboard / reusable prompt template reference (ResponsePrompt). */
    prompt?: OpenAIRealtimeSessionPrompt;
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
  let instructions = buildInstructionsWithContext(settings);
  // When tools are present, instruct the model to use function results in its reply (E2E tests 6/6b: model should say the time after get_current_time).
  if (settings.agent?.think?.functions?.length) {
    const functionInstruction = '\n\nWhen you receive results from tool calls, use them in your reply to the user.';
    instructions = instructions ? instructions + functionInstruction : functionInstruction.trim();
  }
  const useOpenAIServerVad = settings.agent?.useOpenAIServerVad === true;
  const session: OpenAISessionUpdate['session'] = {
    type: 'realtime',
    model: settings.agent?.think?.provider?.model ?? 'gpt-realtime',
    instructions,
    // Do not send voice in session.update; current Realtime API returns "Unknown parameter: 'session.voice'".
    // GA API: turn_detection is under session.audio.input (REGRESSION-SERVER-ERROR-INVESTIGATION.md Cycle 2).
    // Default: turn_detection null — proxy sends input_audio_buffer.commit + response.create (PROTOCOL §3.6).
    // Optional useOpenAIServerVad: Server VAD commits the buffer; proxy sends append only (Issue #560 Phase 2b).
    audio: {
      input: {
        turn_detection: useOpenAIServerVad
          ? buildOpenAIServerVadTurnDetection(settings.agent?.idleTimeoutMs)
          : null,
        format: { type: 'audio/pcm', rate: 24000 },
        // Enable input audio transcription so we get conversation.item.input_audio_transcription.* (Issue #414).
        transcription: { model: 'gpt-4o-transcribe', language: 'en', prompt: '' },
      },
    },
  };
  // Issue #538: `think.provider.temperature` stays on the component Settings JSON (buildSettingsMessage) for
  // app/UI parity, but we do **not** set `session.temperature` on WebSocket `session.update`. The GA
  // RealtimeSessionCreateRequest schema (see REALTIME-SESSION-UPDATE-FIELD-MAP.md) does not include
  // `temperature`; upstream returns unknown_parameter. Older REST/session docs that list temperature
  // do not apply to this wire shape.
  if (settings.agent?.think?.functions?.length) {
    session.tools = settings.agent.think.functions.map((f) => ({
      type: 'function' as const,
      name: f.name,
      description: f.description,
      parameters: f.parameters ?? {},
    }));
  }
  const toolChoice = settings.agent?.think?.toolChoice;
  if (toolChoice !== undefined) {
    session.tool_choice = toolChoice;
  }
  const rawModalities = settings.agent?.think?.outputModalities;
  if (Array.isArray(rawModalities) && rawModalities.length > 0) {
    const modalities = rawModalities.filter((m): m is OpenAIRealtimeOutputModality => m === 'text' || m === 'audio');
    if (modalities.length > 0) {
      session.output_modalities = modalities;
    }
  }
  const maxOut = toSessionMaxOutputTokens(settings.agent?.think?.maxOutputTokens);
  if (maxOut !== undefined) {
    session.max_output_tokens = maxOut;
  }
  // Issue #539: managed prompt is independent of inline `instructions` (still built above).
  // Upstream merges per OpenAI Realtime; use empty `think.prompt` / instructions if you want template-only behavior.
  const managed = normalizeManagedPromptForSession(settings.agent?.think?.managedPrompt);
  if (managed !== undefined) {
    session.prompt = managed;
  }
  const sessionOut = normalizeSessionAudioOutput(settings.agent?.sessionAudioOutput);
  if (sessionOut !== undefined) {
    session.audio = { ...session.audio, output: sessionOut };
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
 * Extract finalized assistant text from `response.output_text.done` when the Realtime API does not mirror the
 * same text on `conversation.item.*` (observed after tool results on gpt-realtime; Issue #555). Returns null if
 * absent or whitespace-only. Handles mock shape `{ text }` and nested shapes used by the API.
 */
export function extractAssistantTextFromResponseOutputTextDone(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  if (typeof e.text === 'string') {
    const t = e.text.trim();
    if (t) return t;
  }
  const part = e.part;
  if (part && typeof part === 'object') {
    const p = part as Record<string, unknown>;
    if (typeof p.text === 'string') {
      const t = p.text.trim();
      if (t) return t;
    }
  }
  return null;
}

/**
 * Prefer finalized `text` on `response.output_text.done` (OpenAI spec); if missing or empty, use accumulated
 * `response.output_text.delta` strings (Issue #555 / #470 real API).
 */
export function mergeAssistantTextFromOutputTextDoneAndDeltas(
  doneEvent: unknown,
  accumulatedDeltas: string,
): string | null {
  const fromDone = extractAssistantTextFromResponseOutputTextDone(doneEvent);
  if (fromDone) return fromDone;
  const acc = typeof accumulatedDeltas === 'string' ? accumulatedDeltas.trim() : '';
  return acc.length > 0 ? acc : null;
}

/**
 * Extract assistant-visible text from `response.done`'s embedded `response.output` (OpenAI Realtime RealtimeResponse).
 * The API often omits separate `conversation.item.*` or empty `response.output_text.done` while still including
 * finalized text here (Issue #470 real-API post-tool turns).
 */
export function extractAssistantTextFromResponseDoneEvent(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  return extractAssistantTextFromRealtimeResponseOutput(e.response);
}

function extractAssistantTextFromRealtimeResponseOutput(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;
  const output = r.output;
  if (!Array.isArray(output)) return null;
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    if (it.role !== 'assistant') continue;
    const content = it.content;
    const contentArray = Array.isArray(content) ? content : content && typeof content === 'object' ? [content] : [];
    for (const part of contentArray) {
      const text = extractTextFromContentPart(part);
      if (text) parts.push(text);
    }
  }
  if (parts.length === 0) return null;
  return parts.join('\n');
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
