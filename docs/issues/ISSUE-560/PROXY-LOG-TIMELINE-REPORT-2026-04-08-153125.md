# OpenAI proxy log timeline — `backend-20260408-153125.log`

**Issue:** [#560](./README.md)  
**Purpose:** Ordered **first-turn** events for the practical check: first `input_audio_buffer.append` → first `input_audio_buffer.commit` (`audio.pending_bytes`) → `input_audio_transcription.completed` / Transcript.

**Source (local only, not in git):** `packages/voice-agent-backend/backend-20260408-153125.log` — `*.log` is ignored; capture with `LOG_LEVEL=debug` on the voice-agent-backend (same pattern as [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md)).

This file contains **two** separate client WebSocket sessions in one backend run: **`connection_id` `c1`** and **`c2`**. Both show the same first-turn shape: one append logged before the first commit, **`audio.pending_bytes`: 12286** (~256 ms @ 24 kHz mono PCM16 after proxy resample), then upstream STT **`hey`** / **`Hey`**.

---

## Session `c1` (`trace_id` `d9db32d7-6421-4557-bd11-6801684d0bd3`)

| Order | `body` (or key detail) | Notes |
|------|-------------------------|--------|
| 1 | `client connected` | WebSocket client leg up. |
| 2 | `upstream open` → `Settings` → `session.update` → `session.updated` | Normal handshake. |
| 3 | `greeting sent to client only (not upstream; …)` | Assistant text to client only; no user audio yet. |
| 4 | **`input_audio_buffer.append`** | **First** logged forward of client binary PCM to upstream (after `session.updated`). |
| 5 | **`input_audio_buffer.commit + response.create`** | **`audio.pending_bytes`: 12286**. |
| 6 | `input_audio_buffer.committed` (upstream → client) | Commit accepted. |
| 7 | `conversation.item.input_audio_transcription.delta` → interim **accumulated length=3** | |
| 8 | **`input_audio_transcription.completed → Transcript (hey)`** | Final user STT for that committed buffer. |

**Timestamps (log `timestamp` field, same units as other OTel lines in file):**

- Greeting: `1775687608975000`
- First append: `1775687610112000` → **~1.14 s** after greeting.
- First commit: `1775687610515000` → **~403 ms** after first append (matches debounce-scale spacing).
- Transcript completed: `1775687610787000` → **~272 ms** after commit line.

**Interpretation:** The proxy only logs **`append`** after the browser has started sending binary frames. That cannot happen before **`getUserMedia`** resolves in the normal test-app path (`start()` then `startAudioCapture()` → `startRecording()`). So this timeline **does not support** “STT without uplink” or “commit before permission” on the proxy side; it supports **short first buffer → marginal STT (“hey”)**.

---

## Session `c2` (`trace_id` `bcdeb1af-e0ee-4966-b527-9b21dc0cbeba`)

| Order | `body` (or key detail) | Notes |
|------|-------------------------|--------|
| 1 | `session.updated` + same `greeting sent to client only` | New connection. |
| 2 | **`input_audio_buffer.append`** | First append. |
| 3 | **`input_audio_buffer.commit + response.create`** | **`audio.pending_bytes`: 12286** (same as `c1`). |
| 4 | `input_audio_buffer.committed` | |
| 5 | **`input_audio_transcription.completed → Transcript (Hey)`** | Same phenomenon; casing differs in log text. |

**Timestamps:**

- First append: `1775691900339000`
- First commit: `1775691900741000` → **~402 ms** after first append.
- Transcript completed: `1775691901110000` → **~369 ms** after commit.

---

## Cross-check vs UI (“Hey” before I spoke / before permission)

1. **Proxy evidence:** User transcription is always **after** at least one **`input_audio_buffer.append`** and a **`commit`** with explicit **`audio.pending_bytes`**. There is **no** transcript line before the first append in either session.
2. **12286 bytes:** This capture is **before** the §2c **`OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`** (~48 000) behavior documented in [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md). Retest with a **current** proxy build should show a **larger** first `audio.pending_bytes` if the new threshold is active.
3. **“Before permission” feeling:** If the site already had **mic granted**, there is **no** prompt; capture starts immediately after `startAudioCapture`, and the first ~256 ms of real audio can be room tone — STT may still emit **“Hey”**. The log cannot prove or disprove **browser** permission UI timing; it only proves **the client sent PCM** in time for that commit.
4. **Settings Applied: false / session closed** while history still shows text: see [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) — app resets **Settings Applied** on **`closed`**; conversation panels can lag.

---

## Privacy

Do not commit raw `backend-*.log` files. This document quotes **message types**, **connection_id**, **trace_id**, and **transcript snippets** only.
