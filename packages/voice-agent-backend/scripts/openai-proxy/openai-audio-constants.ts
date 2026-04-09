/**
 * OpenAI Realtime API — buffer/audio size restrictions (single source of truth).
 *
 * The proxy must enforce these so we never send events that cause upstream errors.
 * See: https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append
 *      https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/commit
 *
 * @see PROTOCOL-AND-MESSAGE-ORDERING.md
 * @see docs/issues/ISSUE-414/RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md
 */

/** Minimum duration (ms) of audio in buffer before commit. API: "at least 100ms of audio" (commit errors otherwise). */
export const OPENAI_MIN_AUDIO_MS_FOR_COMMIT = 100;

/**
 * Minimum bytes to have sent via input_audio_buffer.append before we send commit.
 * 100ms at 24kHz, 16-bit mono: 24000 * 0.1 * 2 = 4800.
 * Client sends 16 kHz PCM; proxy resamples to 24 kHz before append (Issue #560), so this counts upstream (24 kHz) bytes.
 */
export const OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT = 4800;

/**
 * Issue #560: First user-audio commit uses a larger buffer (~1 s @ 24 kHz mono PCM16) so the first
 * `input_audio_buffer.commit` is not a ~100–300 ms tail (garbage STT). After the first successful commit,
 * the proxy uses {@link OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT} for subsequent commits (lower latency).
 * 1 s at 24 kHz mono int16 = 24000 × 2 = 48000 bytes.
 */
export const OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT = 48000;

/**
 * Maximum bytes per single input_audio_buffer.append event.
 * API: "The client may choose how much audio to place in each event up to a maximum of 15 MiB."
 */
export const OPENAI_MAX_AUDIO_BYTES_PER_APPEND = 15 * 1024 * 1024;

/**
 * OpenAI Realtime **`session.audio.input.turn_detection`** when **`type: "server_vad"`** — documented bounds for
 * **`idle_timeout_ms`** (optional). Values outside this range are rejected or clamped by the API.
 *
 * **Not** the same as `DEFAULT_SERVER_TIMEOUT_MS` (60_000) in `src/constants/voice-agent.ts`: that constant is the
 * Deepgram Voice Agent (and similar) **WebSocket inactivity** window for keepalives — a different product and
 * semantic. OpenAI’s field is “after the last model response’s audio finished, auto-prompt the user if quiet”
 * (see API: `input_audio_buffer.timeout_triggered`).
 *
 * @see https://platform.openai.com/docs/api-reference/realtime-client-events/session/update
 */
export const OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MIN = 5000;
/** @see {@link OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MIN} */
export const OPENAI_REALTIME_SERVER_VAD_IDLE_TIMEOUT_MS_MAX = 30000;

/**
 * Assert we never send commit with fewer than the API-required minimum bytes.
 * Call immediately before sending input_audio_buffer.commit.
 */
export function assertMinAudioBeforeCommit(pendingAudioBytes: number): void {
  if (pendingAudioBytes < OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT) {
    throw new Error(
      `OpenAI proxy: cannot send input_audio_buffer.commit: buffer has ${pendingAudioBytes} bytes, ` +
        `minimum is ${OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT} (${OPENAI_MIN_AUDIO_MS_FOR_COMMIT}ms at 24kHz 16-bit). ` +
        'API returns "buffer too small" otherwise.'
    );
  }
}

/**
 * Assert chunk size for a single append is within API limit (15 MiB per event).
 * If chunk is larger, caller must split before sending.
 */
export function assertAppendChunkSize(chunkByteLength: number): void {
  if (chunkByteLength <= 0) return;
  if (chunkByteLength > OPENAI_MAX_AUDIO_BYTES_PER_APPEND) {
    throw new Error(
      `OpenAI proxy: input_audio_buffer.append chunk size ${chunkByteLength} exceeds API maximum ` +
        `${OPENAI_MAX_AUDIO_BYTES_PER_APPEND} (15 MiB) per event. Split into smaller chunks.`
    );
  }
}
