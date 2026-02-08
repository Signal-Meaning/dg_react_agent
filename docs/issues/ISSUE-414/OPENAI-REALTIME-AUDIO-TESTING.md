# OpenAI Realtime API: audio testing best practices and Basic Audio test

**Purpose:** Align our audio E2E (e.g. "Basic audio" in openai-proxy-e2e) with OpenAI’s recommended practices and diagnose the ~3s socket close / agent error.

---

## 1. What OpenAI recommends (Realtime Eval Guide)

From the [Realtime Eval Guide](https://cookbook.openai.com/examples/realtime_eval_guide) and cookbook [realtime_evals](https://github.com/openai/openai-cookbook/tree/main/examples/evals/realtime_evals):

### Crawl (single-turn, synthetic audio)

- **Input:** Generate or load input audio (e.g. text → TTS for fast iteration).
- **Stream:** Send audio in **fixed-size chunks**. *"Chunking and timing affect behavior. Pick a standard and stick to it. For example, **20 ms per chunk** is a good balance of responsiveness and overhead."*
- **Turn boundaries:** With **VAD off**: commit immediately after the last audio chunk, then call `response.create`. With VAD on the server commits automatically.
- **Harness:** Single-turn replay keeps everything comparable (same audio bytes, preprocessing, chunking).

### Walk (saved / real audio)

- Preprocessing must match production (resampling, normalization, encoding).
- **Streaming policy:** Explicit cadence (e.g. every 20 ms, send 20 ms of audio) if you care about latency; can stream faster for iteration but keep **chunk size constant**.
- **Turn boundaries:** Prefer **VAD off + manual commit** for offline reproducibility.

### Logging and debugging

- *"A turn is a chain of events (speech start/stop → commit → response.create → audio deltas → done), and failures can happen at any stage."* Log pipeline stages so failures can be attributed to the right place (turn detection, buffering, commit, etc.), not just "model issues."

### API detail (input_audio_buffer.append)

- Official client event is JSON: `{"type":"input_audio_buffer.append","audio":"<base64>"}`. Format must match `input_audio_format` in session config.
- Our proxy accepts **binary** PCM from the component and converts to base64 for upstream, which is consistent with the API.

---

## 2. Our current setup (keep and align)

We already have:

- **Fixtures:** `loadAndSendAudioSample(page, sampleName, options)` in `test-app/tests/e2e/fixtures/audio-helpers.js` — loads WAV or JSON PCM, streams in chunks, calls `deepgramRef.current.sendAudioData(chunk)`.
- **Chunking:** Configurable `chunkSize` (default 4096 in the Basic Audio test). OpenAI suggests ~20 ms chunks; at 16 kHz 16-bit mono, 20 ms = 640 bytes. So we could add an option for **640-byte chunks** and use it for Realtime API tests to match their recommendation.
- **Real-time simulation:** We already space chunks by `chunkInterval` (duration / totalChunks) so we don’t blast the buffer; we can keep this and optionally align chunk size with 20 ms.

**Recommendations:**

1. **Chunk size for Realtime API tests:** Prefer **640 bytes** (20 ms at 16 kHz 16-bit) for the Basic Audio test (or a shared constant) so we match OpenAI’s “20 ms per chunk” guidance. Keep existing infrastructure; add a preset e.g. `{ chunkSize: 640 }` or `CHUNK_20MS_16K_MONO = 640` in audio-helpers.
2. **VAD and commit:** Our proxy uses a 200 ms debounce and only commits when `pendingAudioBytes >= MIN_AUDIO_BYTES_FOR_COMMIT` (3200 bytes). For tests, “commit after last chunk” is consistent with “VAD off + manual commit” if we ensure we only commit once after the stream ends; our debounce does that.
3. **Logging:** Add or reuse logging around append/commit/response.create and upstream errors so that when the Basic Audio test fails we can see whether the failure is at commit, response.create, or server error.

---

## 3. Basic Audio test: why does the socket close in ~3 seconds?

**Observed:** Test 5 (“Basic audio – send recorded audio…”) hits `assertNoRecoverableAgentErrors` (agent-error-count = 1) and the connection often closes soon after (e.g. ~3 s). We need to see the exact error and sequence.

**Possible causes:**

1. **Upstream error after commit:** e.g. “server had an error” or “buffer too small” (if something is wrong with timing or chunking), then connection close.
2. **Duplicate or out-of-order commit/response.create:** e.g. commit while a response is still in progress (we added `responseInProgress` to prevent that; worth confirming in logs).
3. **Chunking/timing:** Sending 4096-byte chunks very fast might create a different pattern than 20 ms chunks; could affect server-side behavior or our debounce/commit timing.

**Diagnosis steps:**

1. **Run with Playwright trace** and capture console/network:
   - `USE_REAL_APIS=1 USE_PROXY_MODE=true npx playwright test openai-proxy-e2e.spec.js -g "Basic audio" --trace on`
   - Inspect trace for WebSocket close (code/reason) and any error message in the UI or console.
2. **Run proxy with debug** so we log every append/commit/response.create and upstream error:
   - `OPENAI_PROXY_DEBUG=1` (or equivalent) when starting the backend, then run the test and capture proxy stdout.
3. **Try 20 ms chunk size** in the Basic Audio test (e.g. `loadAndSendAudioSample(page, 'hello', { chunkSize: 640 })`) and see if the failure or timing changes.
4. **Assert pipeline stages in test or logs:** After sending audio, confirm in logs or test that we see: append(s) → single commit → response.create → no error before response.done. If an error appears before that, note the exact event (e.g. “error after commit”, “error after response.create”).

**Next:** Run the diagnosis (trace + proxy debug), record the exact error message and close code, and update this section with findings. Then align chunk size and commit behavior with the recommendations above and re-run the test.

---

## 4. Session retention and consistent behavior (repro tests 9 and 10)

**Rule:** Session state is retained from one connection to the next **unless** a test stipulates that the session is changing (e.g. full page reload).

**Consistent behavior:** We expect the same user-visible behavior in both conditions: when the user sends "What famous people lived there?" the response must not be the greeting and must not be the stale Paris one-liner — whether or not a reload occurred.

- **Test 9** (no reload): Same page → conversation (France, Sorry) → disconnect → reconnect (send next message). Session is retained; response must reflect prior conversation (not greeting, not stale Paris). If the product does not yet retain session across disconnect/reconnect, the test encodes the desired behavior.
- **Test 10** (reload): Same conversation, then **full page reload** (session change stipulated), connect, disconnect, send "What famous people lived there?". Response must still not be greeting and not stale — the component must not display the new-session greeting as the reply to that user message.

See E2E-FAILURE-REVIEW.md §3.
