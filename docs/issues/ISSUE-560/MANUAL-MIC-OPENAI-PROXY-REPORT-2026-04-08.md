# Manual mic + OpenAI proxy — dev repro (2026-04-08)

**Issue:** [#560](./README.md)  
**Context:** Playwright **real-API** OpenAI + Live E2E passed (injected PCM). **Manual** test-app with **host microphone** still shows **invalid user transcripts** and **no meaningful assistant behavior** relative to what the user actually said.

**Reporter note:** The strings **"It was."** and **"."** appeared in **Live Transcript** / **Conversation History** but **do not match spoken audio** (screenshot on file; UI-only evidence).

**Backend capture:** `npm run backend:log` from `packages/voice-agent-backend` with **`LOG_LEVEL=debug`** (also visible as `[voice-agent-backend] LOG_LEVEL: debug` at top of file).  
**Local log path (not in git; `*.log` ignored):** `packages/voice-agent-backend/backend-20260408-111420.log`

---

## Summary

| Claim | Evidence in `backend-20260408-111420.log` |
|--------|-------------------------------------------|
| User STT is not faithful to mic speech | Proxy logs **`input_audio_transcription.completed → Transcript (.)`** after a single-character interim delta — upstream returned **`.`** as the final user transcript for that committed buffer. |
| Assistant does not engage with real user intent | After that turn, **`conversation.item.done`** (assistant) carries a **generic greeting**-class line (matches “connected but not answering” UX). Reporter states this did not address what they said. |
| Later mic audio does not produce new user turns | After **`response.done`**, the log shows a **long run** of **`input_audio_buffer.append`** (client → upstream) with **no** additional **`input_audio_buffer.commit`**, **`input_audio_transcription.*`**, or new **`response.created`** in the same connection — consistent with **no further processed user utterances** while the mic keeps sending frames. |

---

## Log highlights (single client connection `c1`, `trace_id` `a964db62-fbff-4044-9704-4fef4e0a7475`)

1. **Session path:** `client connected` → `upstream open` → `Settings` → `session.update sent to upstream (tools=0)` → `session.created` / `session.updated`.
2. **First audio cycle:** `input_audio_buffer.append` → `input_audio_buffer.commit + response.create` with **`audio.pending_bytes`: 12286** → upstream `input_audio_buffer.committed` → `conversation.item.added` / `done` for **user** `input_audio` with **`transcript`: null** in the raw debug payload (transcription filled via separate events).
3. **User transcription:** `conversation.item.input_audio_transcription.delta` → debug line **interim, accumulated length=1** → `conversation.item.input_audio_transcription.completed` → **`input_audio_transcription.completed → Transcript (.)`**.
4. **Assistant:** `response.created`, audio/output deltas, then `conversation.item.done` (assistant) with **output transcript** matching a short generic prompt-style reply (see raw payload in log).
5. **Tail:** `response.done` → **many** repeated **`input_audio_buffer.append`** entries (~256 ms spacing) until **`client WebSocket closed (code=1005)`** — **no** matching **`commit + response.create`** or transcription events in that tail.

---

## Interpretation (for #560 queue)

- **§D checklist** ([LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) **§D**): Step 1 (PCM leaving browser) is **consistent** with **`append`** spam; step 2–4 show **OpenAI did emit** transcription — but **content is garbage** (`.`) for this buffer, so the failure is **not** “no STT event” but **bad / empty STT** plus **lack of subsequent commits** for ongoing mic input.
- **Proxy bug (mitigated in repo):** The debounced **`scheduleAudioCommit`** timer can fire while **`responseInProgress`** and **no-op**; with **no later binary** frame, **no new timer** was scheduled, so queued PCM never produced another **`input_audio_buffer.commit`** (matches this log’s **append-only** tail). **Fix:** **`onResponseEnded`** in **`packages/voice-agent-backend/scripts/openai-proxy/server.ts`** calls **`scheduleAudioCommit()`** when **`hasPendingAudio && pendingAudioBytes >= OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT`**. **Jest:** `tests/integration/openai-proxy-integration.test.ts` — *Issue #560: reschedules audio commit after response ends…*.
- **E2E vs manual gap** remains **partly open**: bogus STT and UX need **manual re-test** with the proxy fix; upstream/model and **mic capture** are separate from commit scheduling.
- **Next engineering directions** (non-exhaustive): re-run **manual host mic** + debug log; **OTel log shape** — GitHub **[#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565)**; **sample rate / format** from host mic; compare with a **known-good WAV** in the same browser tab.

---

## Follow-up retest — `backend-20260408-142135.log` (same day, after mic pipeline work)

**Local log path (not in git):** `packages/voice-agent-backend/backend-20260408-142135.log`

| Observation | Log / UI read |
|-------------|----------------|
| User STT still not faithful | **`input_audio_transcription.completed → Transcript (SHELX.)`** with interim deltas **accumulated length 1 → 4 → 5 → 6** — upstream is still producing **short, garbage text** for the first committed buffer, not the spoken English sentence. |
| First commit size unchanged | Same pattern as earlier captures: **`audio.pending_bytes`: 12286** at **`input_audio_buffer.commit + response.create`** (~**256 ms** of **24 kHz** mono PCM after proxy resample). If the user starts speaking just before/around that commit, most of the phrase can land **after** the first commit and stay uncommitted until **`response.done`** + reschedule (or never, if pending bytes never reach the proxy min-commit threshold or the backend build is stale). |
| Single processed user turn | Again **one** **`commit + response.create`** line in this log for the mic-driven path; confirm whether a **second commit** appears after assistant **`response.done`** when using a **current** proxy build with **`onResponseEnded` → `scheduleAudioCommit`** (or if pending bytes stay below the min commit threshold). |
| Assistant language (e.g. Korean in UI) | The Realtime **model** can answer in a **non-English** locale when **input audio/transcript is nonsensical** or when **session instructions** / **model** skew multilingual. This is **not** evidence of hitting the wrong WebSocket URL by itself; treat as **symptom of bad or ambiguous input** until transcripts are clean. |
| Test-app status labels | Screenshots showed **Settings Applied: false** and **Session … closed** while conversation text updated — treat as **possible client UI desync** (separate from proxy transcript lines above); prefer **Event Log** + **backend debug** for connection truth. |

**Engineering follow-ups:** (1) **Rebuild / hard-refresh** the test-app after **`src/`** mic changes. (2) **`CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ`** + **`prepareMicPcmForAgent`** (`mic-audio-contract.ts`, `AudioUtils.ts`) — single contract for **16 kHz** before the proxy’s **16→24 k** stage. (3) **`npm run generate:mic-worklet`** after editing **`AudioWorkletProcessor.js`** (generated inline for **`AudioManager`**); Jest **`microphone-worklet-inline-sync.test.ts`** guards drift.

---

## Privacy

Do not commit raw `backend-*.log` files: they may contain **key previews** at `info` startup. This note references **message types and transcript text** only.
