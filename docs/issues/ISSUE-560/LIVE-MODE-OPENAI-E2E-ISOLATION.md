# Issue #560 — Isolating `live-mode-openai-proxy.spec.js` vs `openai-proxy-e2e` test 5

**Purpose:** When user STT does not surface in OpenAI-proxy E2E, decide whether the bug is **client send path**, **proxy/protocol**, or **test shape** — without assuming upstream flakiness first.

## A. Current shape: `openai-proxy-e2e.spec.js` test 5 (audio-only after settings)

1. `setupTestPageForBackend` + **`establishConnectionViaText`** → `start()` via text-input focus.
2. `waitForSettingsApplied`
3. **`loadAndSendAudioSample`** with **`this_is_a_custom_test_phrase_for_dynamic_generation`** (distinctive phrase; not a text round-trip before audio).
4. **`waitForFinalUserTranscriptNormalized`** on **`__e2eTranscriptEvents`** (strict normalized match vs loose `/hello|hi/`).
5. `waitForAgentResponse` → **`agent-response`** assertion.

## B. Live spec shape (current)

1. `setupTestPageWithOpenAIProxy` (optional query **`e2eIdleTimeoutMs`** merged via `extraParams` — overrides short Playwright **`VITE_IDLE_TIMEOUT_MS`** for long idle during greeting + audio).
2. Component ready, then **Live** → `enterLiveMode` → `start()` + `startAudioCapture()` (Playwright fake mic starts uplink).
3. **`waitForSettingsApplied`** (DOM **`has-sent-settings === true`**).
4. **`window.deepgramRef.current.stopAudioCapture()`** — **Issue #560:** without this, **fake mic PCM** and **injected** `sendAudioData` both feed OpenAI **`input_audio_buffer`**; user STT stayed empty while **`__e2eWsBinarySendCount`** still increased (inject-only path). Test 5 avoids the conflict because it never starts **`startAudioCapture`**.
5. **`loadAndSendAudioSample`** (same distinctive phrase as test 5); PCM delta on **`__e2eWsBinarySendCount`**; **`waitForFinalUserTranscriptNormalized`**.

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

## G. Observed in automated runs

**2026-04-05 (pre–settings-time clear):** After **650ms** post-`has-sent-settings` and **`hello`** sample parity, Live spec still timed out on transcript while PCM delta **passed** — initially read as downstream of browser send.

**Resolved on mock path (post–`settingsSentTimeRef` clear + Live spec update):** Empty **`__e2eTranscriptEvents`** with PCM OK was often **dual uplink** in Playwright Live: fake **`getUserMedia`** plus **`sendAudioData`** inject both feeding **`input_audio_buffer`**. Fix: package ref **`stopAudioCapture()`** + call it in Live spec before inject; optional **`e2eIdleTimeoutMs`** on the app URL. **Re-qualify with real APIs** (`USE_REAL_APIS=1` + keys) per [NEXT-STEP.md](./NEXT-STEP.md).

**2026-04-08 (manual host mic, OpenAI proxy, `LOG_LEVEL=debug`):** Playwright real-API E2E + Live **pass** with injected PCM, but **manual** test-app + **host mic** still fails: proxy log shows **`input_audio_transcription.completed → Transcript (.)`** for a committed buffer; after **`response.done`**, **`input_audio_buffer.append`** continues with **no** further **`commit`** / transcription in the same session. UI showed user lines **"It was."** / **"."** per reporter (**not** spoken). See [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md). **Follow-up (same day):** proxy **`onResponseEnded`** now **re-arms** **`scheduleAudioCommit`** when enough bytes are queued (stuck timer after **`responseInProgress`** no-op) — **re-test manual mic**.

## E. Test alignment changes (repo)

- **Package:** Clear **`settingsSentTimeRef`** when **`SettingsApplied`** / **`session.created`** arrives — Jest **`tests/send-audio-after-settings-applied-issue560.test.tsx`**. **`stopAudioCapture()`** on ref — symmetry with **`startAudioCapture`**; API validation + **`tests/api-baseline/approved-additions.ts`**.
- **test-app:** **`resolveE2eIdleTimeoutMs`** + URL **`e2eIdleTimeoutMs`** in **`App.tsx`** memoized agent options — Jest **`test-app/tests/e2eIdleTimeoutMs.test.ts`**.
- **Live + test 5:** **`waitForSettingsApplied`**; Live: **`stopAudioCapture`** then inject; assert **`__e2eWsBinarySendCount`** increases; user STT via **`waitForFinalUserTranscriptNormalized`** and shared sample constants in **`test-helpers.js`**.
- Prefer the **distinctive phrase** sample for OpenAI STT matching, not generic **hello**.

## F. Protocol note

OpenAI Realtime carries **user STT on the same session** as the agent. `start({ transcription: false })` means **no Deepgram Listen socket** — not “no transcription.” See `voiceAgentStartOptions.ts` JSDoc and Issue #414 proxy interface doc.
