# Proposal: Fix first-commit timing and orphaned audio in OpenAI proxy

**Issue:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)  
**Date:** 2026-04-08  
**Status:** **Implemented** (Fix B silence pad + Fix A `OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`). **Mock:** full `openai-proxy-integration` + `-t "Issue #560"`. **Real API (2026-04-04):** `USE_REAL_APIS=1` full file — **20 passed** (~73 s); mock-only cases (including Issue #560) skipped as designed. **Manual host-mic** still open when you want spoken STT confirmation.

---

## Diagnosis

Two distinct failures share the "garbage STT" symptom but have different root causes:

### Failure 1 — First commit fires too early

| Parameter | Current value | Effect |
|-----------|---------------|--------|
| `INPUT_AUDIO_COMMIT_DEBOUNCE_MS` | 400 ms | First commit fires 400 ms after audio starts |
| `OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT` | 4800 bytes (100 ms @ 24 kHz) | Threshold is trivially met |
| Observed first-commit payload | ~12,286 bytes (~256 ms @ 24 kHz) | Too short for a spoken phrase |

The first `input_audio_buffer.commit` typically contains silence or a speech fragment. OpenAI transcribes this as `.`, `SHELX.`, or similar garbage. The user's actual utterance lands in subsequent appends that may never be committed (see Failure 2).

**This is the primary remaining bug.** The log evidence in [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) confirms: `pending_bytes: 12286` at first commit, transcript result is `.` or `SHELX.`.

### Failure 2 — Below-threshold audio orphaned after response ends

`onResponseEnded` ([server.ts](../../../packages/voice-agent-backend/scripts/openai-proxy/server.ts)) re-arms `scheduleAudioCommit` only when `pendingAudioBytes >= OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT`. If pending bytes are below 4800 after a long assistant response, the audio is silently dropped with no timer rescheduled and no log warning.

---

## Proposed fixes

### Fix A — Raise the first-commit threshold (simplest, highest impact)

Increase `OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT` from 4800 bytes (100 ms) to **48,000 bytes (~1 second at 24 kHz mono PCM16)**. This ensures the first committed buffer contains enough audio for OpenAI to produce a meaningful transcript.

**Trade-off:** Adds up to ~1 second of latency before the first user turn is recognized. Acceptable for a conversational agent; unacceptable for a real-time dictation use case (not our scenario).

**Alternative (more complex):** Use a separate, longer initial threshold (e.g. 1500 ms / 72,000 bytes for the first commit only, then revert to a smaller threshold for subsequent commits). This preserves low latency for follow-up turns while fixing the cold-start problem.

### Fix B — Commit orphaned audio regardless of byte count

In `onResponseEnded`, when `hasPendingAudio` is true but `pendingAudioBytes < OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT`:

- **Option B1:** Commit immediately anyway. A small buffer is better than lost audio.
- **Option B2:** Set a longer fallback timer (e.g. 2000 ms) that commits regardless of byte count, giving more chunks time to arrive.

Recommend **B1** for simplicity. The threshold exists to avoid committing noise; after a full response cycle, any pending audio is intentional speech that should not be discarded.

### Fix C (stretch) — Energy-gated first commit

Add a simple RMS energy check on accumulated PCM before the first commit. Only commit when the buffer shows speech-level energy (e.g. RMS > threshold). This avoids committing pure silence regardless of byte count.

**Trade-off:** More robust but adds signal-processing logic to the proxy. Defer unless Fix A proves insufficient.

---

## TDD approach

Per [TDD-PLAN.md](./TDD-PLAN.md) rules: RED test first, then implementation.

### New test: first-commit timing (proxy integration)

**File:** `tests/integration/openai-proxy-integration.test.ts`  
**Test name:** `Issue #560: first commit contains at least 1 second of audio`

Simulate a mic-shaped chunk stream:
1. Send 400 ms of silence-level PCM chunks (matching real worklet cadence ~128 samples per chunk)
2. Send 1600 ms of non-trivial PCM chunks (simulating speech)
3. Assert the first `input_audio_buffer.commit` sent to upstream contains >= 48,000 bytes (1 s)
4. Assert a `response.create` follows the commit

### New test: orphaned audio after response

**File:** `tests/integration/openai-proxy-integration.test.ts`  
**Test name:** `Issue #560: commits pending audio below threshold after response ends`

1. Accumulate pending audio bytes below the min threshold while `responseInProgress`
2. Emit `response.done` from upstream
3. Assert `onResponseEnded` triggers a commit (or schedules one) regardless of byte count

### Regression: existing tests must stay green

```bash
# All existing Issue #560 locks
npm test -- \
  tests/unit/audio-utils-mic-pcm-issue560.test.ts \
  tests/unit/mic-pcm-proxy-chain-issue560.test.ts \
  tests/unit/microphone-worklet-inline-sync.test.ts \
  tests/openai-proxy-pcm-resample.test.ts \
  tests/send-audio-after-settings-applied-issue560.test.tsx

npm test -- tests/integration/openai-proxy-integration.test.ts -t "Issue #560"
```

---

## Implementation scope

| File | Change |
|------|--------|
| `packages/voice-agent-backend/scripts/openai-proxy/openai-audio-constants.ts` | Raise `OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT` to 48000 (or add `OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`) |
| `packages/voice-agent-backend/scripts/openai-proxy/server.ts` | Fix A: update threshold reference in `scheduleAudioCommit`; Fix B: remove byte-count gate in `onResponseEnded` orphan path |
| `tests/integration/openai-proxy-integration.test.ts` | Two new test cases (see above) |

No changes to the client package (`src/`), test-app, worklet, or resampler.

---

## What this does NOT fix

- **Upstream model quality:** If OpenAI's STT produces bad transcripts for clean, complete audio buffers, that is an API/model issue outside this repo.
- **UI "Settings Applied" desync:** Tracked in [#561](../ISSUE-561/README.md).
- **Off-language assistant replies:** Symptom of garbage input transcripts; resolves when STT input is clean.

---

## Validation

1. **(agent)** ~~Write RED tests, implement fixes, run regression sweep.~~ **Done** — mock `openai-proxy-integration.test.ts` full suite + `-t "Issue #560"`.
2. **(human)** Manual host-mic repro per [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md) with `LOG_LEVEL=debug`. Confirm first-commit `pending_bytes` is **≥ ~48,000** and transcript is meaningful English.
3. **(agent)** ~~Update [TDD-PLAN.md](./TDD-PLAN.md) section 2b table and [TRACKING.md](./TRACKING.md).~~ **Done** — §2b/§2c, TRACKING, CURRENT-STATUS, AGENT-HANDOFF, NEXT-STEP.
4. **(agent)** ~~**`USE_REAL_APIS=1`** on `openai-proxy-integration.test.ts` when qualifying with `OPENAI_API_KEY`.~~ **Done (2026-04-04)** — `npm test -- tests/integration/openai-proxy-integration.test.ts` with `USE_REAL_APIS=1`: 20 passed; Jest may print “did not exit” (open handles) after the suite.
