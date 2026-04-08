# Issue #560 — Isolating `live-mode-openai-proxy.spec.js` vs `openai-proxy-e2e` test 5

**Purpose:** When user STT does not surface in OpenAI-proxy E2E, decide whether the bug is **client send path**, **proxy/protocol**, or **test shape** — without assuming upstream flakiness first.

## A. Current shape: `openai-proxy-e2e.spec.js` test 5 (audio-only after settings)

1. `setupTestPageForBackend` + **`establishConnectionViaText`** → `start()` via text-input focus.
2. `waitForSettingsApplied`
3. **`loadAndSendAudioSample`** with **`this_is_a_custom_test_phrase_for_dynamic_generation`** (distinctive phrase; not a text round-trip before audio).
4. **`waitForFinalUserTranscriptNormalized`** on **`__e2eTranscriptEvents`** (strict normalized match vs loose `/hello|hi/`).
5. `waitForAgentResponse` → **`agent-response`** assertion.

## B. Live spec shape (current)

1. `setupTestPageWithOpenAIProxy` — component ready, then **Live** → `enterLiveMode` → `start()` + `startAudioCapture()`.
2. **`waitForSettingsApplied`** (DOM **`has-sent-settings === true`**).
3. **`loadAndSendAudioSample`** with the same **distinctive phrase** sample as test 5; PCM delta on **`__e2eWsBinarySendCount`**; **`waitForFinalUserTranscriptNormalized`**.

## C. Client-side gates (package)

`DeepgramVoiceInteraction.sendAudioData` (approx. lines 3187–3204):

- Drops uplink if **`!hasSentSettingsRef.current`**.
- While **`settingsSentTimeRef`** is set and fewer than **500 ms** have passed since **`sendAgentSettings`**, drops uplink (pre-confirmation). **After `SettingsApplied` / `session.created`**, **`settingsSentTimeRef`** is **cleared** (Issue #560), so PCM is not held on that timer once the session is confirmed.

## D. Isolation checklist (order)

| Step | Check | If false → |
|------|--------|------------|
| 1 | After streaming, **`__e2eWsBinarySendCount`** increased (`installMicE2eTelemetry` wraps **browser** `WebSocket.send` for `ArrayBuffer`) | `sendAudioData` gating, `hasSentSettingsRef`, pre-confirmation 500 ms window, or agent WS not connected — **client package / test-app timing** |
| 2 | Step 1 true, transcript hooks still empty | Binary left the browser; next: **proxy** `input_audio_buffer.append` / `commit` / `response.create` (see `server.ts`) and **OpenAI** `conversation.item.input_audio_transcription.*` |
| 3 | Proxy logs show append + commit | If missing → **proxy** not scheduling commit or `hasSentSettingsApplied` gating audio queue |
| 4 | Upstream JSON includes transcription events | If missing → **session.update** transcription config or API behavior (compare `translator.ts` `audio.input.transcription`) |
| 5 | Component logs / `Transcript` handling | **normalizeTranscriptMessageToResponse** + `handleAgentMessage` Transcript branch (Issue #414) |

## G. Observed in automated runs (2026-04-05, pre–settings-time clear)

After adding **650ms** post-`has-sent-settings` and **`hello`** sample parity, **`live-mode-openai-proxy.spec.js`** still timed out on transcript wait, but **`__e2eWsBinarySendCount`** **passed** — pointing **downstream of browser send**. **Re-qualify** after the package fix (clear **`settingsSentTimeRef`** on confirmation) and the updated specs (**no** fixed 650ms sleep; **`waitForFinalUserTranscriptNormalized`** + distinctive sample).

## E. Test alignment changes (repo)

- **Package:** Clear **`settingsSentTimeRef`** when **`SettingsApplied`** / **`session.created`** arrives — see Jest **`tests/send-audio-after-settings-applied-issue560.test.tsx`**.
- **Live + test 5:** Use **`waitForSettingsApplied`** / DOM **`has-sent-settings`**; assert **`__e2eWsBinarySendCount`** increases after **`loadAndSendAudioSample`**; user STT via **`waitForFinalUserTranscriptNormalized`** and shared sample constants in **`test-helpers.js`** (no arbitrary post-settings sleep for the old gate).
- Prefer the **distinctive phrase** sample for OpenAI STT matching, not generic **hello**.

## F. Protocol note

OpenAI Realtime carries **user STT on the same session** as the agent. `start({ transcription: false })` means **no Deepgram Listen socket** — not “no transcription.” See `voiceAgentStartOptions.ts` JSDoc and Issue #414 proxy interface doc.
