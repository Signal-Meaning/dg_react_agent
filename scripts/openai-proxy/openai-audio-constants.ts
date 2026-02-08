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
 * Proxy uses 24kHz so both 16kHz and 24kHz clients work.
 */
export const OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT = 4800;

/**
 * Maximum bytes per single input_audio_buffer.append event.
 * API: "The client may choose how much audio to place in each event up to a maximum of 15 MiB."
 */
export const OPENAI_MAX_AUDIO_BYTES_PER_APPEND = 15 * 1024 * 1024;

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
