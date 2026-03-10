/**
 * Canonical list of OpenAI Realtime API **server** event types (events the server sends to the client).
 * Source: https://platform.openai.com/docs/api-reference/realtime-server-events
 * Used to guarantee coverage: every type here must have a branch in server.ts (map or explicit ignore).
 * When the API adds new event types, add them here and add a branch in server.ts; then unmapped = unknown future only.
 */
export const OPENAI_REALTIME_SERVER_EVENT_TYPES: readonly string[] = [
  'conversation.created',
  'conversation.item.added',
  'conversation.item.created',
  'conversation.item.deleted',
  'conversation.item.done',
  'conversation.item.input_audio_transcription.completed',
  'conversation.item.input_audio_transcription.delta',
  'conversation.item.input_audio_transcription.failed',
  'conversation.item.input_audio_transcription.segment',
  'conversation.item.retrieved',
  'conversation.item.truncated',
  'error',
  'input_audio_buffer.cleared',
  'input_audio_buffer.committed',
  'input_audio_buffer.dtmf_event_received',
  'input_audio_buffer.speech_started',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.timeout_triggered',
  'mcp_list_tools.completed',
  'mcp_list_tools.failed',
  'mcp_list_tools.in_progress',
  'rate_limits.updated',
  'response.content_part.added',
  'response.content_part.done',
  'response.created',
  'response.done',
  'response.function_call_arguments.done',
  'response.output_audio.delta',
  'response.output_audio.done',
  'response.output_audio_transcript.delta',
  'response.output_audio_transcript.done',
  'response.output_item.added',
  'response.output_item.done',
  'response.output_text.added',
  'response.output_text.done',
  'session.created',
  'session.updated',
] as const;

export type OpenAIRealtimeServerEventType = (typeof OPENAI_REALTIME_SERVER_EVENT_TYPES)[number];
