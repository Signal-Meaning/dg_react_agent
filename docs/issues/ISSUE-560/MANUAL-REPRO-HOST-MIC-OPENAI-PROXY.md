# Manual repro — host microphone + OpenAI proxy (test-app)

**Issue:** [#560](./README.md)  
**Purpose:** Fixed, repeatable steps so humans (and agents reading this file) run the **same** Live + **real mic** + **OpenAI Realtime via repo proxy** path. Log interpretation and prior captures live in [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md).

**Also see:** [Issue #561](../ISSUE-561/README.md) (Live UI context), [test-app/docs/PROXY-SERVER.md](../../../test-app/docs/PROXY-SERVER.md), [ARCHITECTURE.md](../../BACKEND-PROXY/ARCHITECTURE.md).

---

## Preconditions

- Repo checkout on a branch that includes the proxy + test-app under test (e.g. `issue-560`).
- **`packages/voice-agent-backend/.env`:** valid **`OPENAI_API_KEY`** (and any other vars your combined server needs). Keys are **not** taken from `test-app/.env` for the OpenAI subprocess in this layout.
- **`test-app/.env`:** proxy mode for the browser, e.g. **`USE_PROXY_MODE=true`** and **`VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai`** (adjust scheme/host if you use HTTPS or a non-default port). See [PROXY-SERVER.md](../../../test-app/docs/PROXY-SERVER.md).
- After changing **`src/`** (package mic path) or the worklet: rebuild test-app (**`cd test-app && npm run build`** or ensure dev HMR picked up changes). If you edit **`AudioWorkletProcessor.js`**, run **`npm run generate:mic-worklet`** from the repo root.

---

## Steps **(human)**

1. **Stop** any old backend and test-app dev processes (avoid stale proxy or wrong port).
2. **Backend (combined proxy):** from **`packages/voice-agent-backend`**, run **`npm run start`** (or from **`test-app`**, **`npm run backend`** — it delegates to that package). For verbose proxy/OpenAI traces, use **`LOG_LEVEL=debug`** (e.g. **`npm run backend:log`** if your package script wraps that).
3. **Sanity:** optional **`curl -sS http://127.0.0.1:8080/ready`** (or **`/health`**) per backend docs.
4. **Test-app:** from **`test-app`**, **`npm run dev`** (or your usual HTTPS command if you test with **`wss`** — match **`VITE_OPENAI_PROXY_ENDPOINT`** scheme).
5. **Browser:** open the app URL (e.g. **`http://localhost:5173`**). Hard-refresh if you changed frontend bundles.
6. **Connection mode:** ensure the UI is on **OpenAI / proxy** path (not Deepgram-direct-only), consistent with **`getVoiceAgentStartOptions`** / voice provider selection in the test-app.
7. **Live:** click **Live** (or equivalent) so the app runs **`start()`** + **`startAudioCapture()`** and shows the Live shell ([Issue #561](../ISSUE-561/README.md)).
8. **Microphone:** grant permission when prompted; confirm the session shows **connected** / **mic active** per the Live UI.
9. **Speak:** use a **clear English sentence**, long enough that audio can span more than one proxy commit window (several seconds). Avoid whispering; minimize room noise.
10. **Observe:** Live **conversation / transcript** lines; backend log for **`input_audio_buffer.append`**, **`input_audio_buffer.commit`**, **`input_audio_transcription.completed`**, **`response.done`**, and whether **further commits** appear after the assistant finishes. Do **not** commit raw **`backend-*.log`** files to git (may contain secret previews); keep local copies with a timestamped name if you need to diff runs.

---

## Expected vs failing observables (for #560)

When the defect is present, prior runs matched patterns described in the **manual report** (e.g. garbage user STT such as **`.`** or **`SHELX.`**, **append**-heavy tail **without** another **commit**, assistant replies that do not match intent). Use the report’s tables as the baseline for comparison.

---

## Retest log

| When | What we did | Result |
|------|----------------|--------|
| **2026-04-04** | Restarted backend + test-app per [NEXT-STEP.md](./NEXT-STEP.md); reran the steps above | **Same observables** as prior manual captures (no improvement vs earlier logs/UI described in [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md)) |

Update this table when you rerun repro so the issue folder stays the single place for “last human run.”
