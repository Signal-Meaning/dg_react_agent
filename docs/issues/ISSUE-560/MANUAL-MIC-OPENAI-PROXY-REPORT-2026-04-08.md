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
- **E2E vs manual gap** remains **open**: injected **file PCM** qualifies; **real `getUserMedia`** + **live commit cadence** + **ambient/device audio** may differ enough that upstream STT and turn scheduling misbehave.
- **Next engineering directions** (non-exhaustive): browser-side **commit / turn-detection** policy vs OpenAI Realtime expectations; **sample rate / format** from host mic; **dual stream** or **silence** dominating buffer; compare with a **known-good WAV** injected on the same session in the same browser tab.

---

## Privacy

Do not commit raw `backend-*.log` files: they may contain **key previews** at `info` startup. This note references **message types and transcript text** only.
