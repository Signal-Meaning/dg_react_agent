# Partner note: dg_react_agent timing pitfalls

This document lists **timing and ordering hazards** that can make it look like **audio or Settings never reach** the OpenAI / Deepgram stack. It is aimed at integrators (e.g. Voice Commerce) comparing **app behavior**, **browser WebSocket**, and **proxy logs**.

Code pointers are to this repository unless noted otherwise.

---

## 1 — ~500 ms binary discard after Settings (client)

**Where:** `DeepgramVoiceInteraction` — `sendAudioData` drops binary frames when `hasSentSettingsRef` is false, and **again** for **500 ms** after `settingsSentTimeRef` is set (even though the OpenAI proxy may already queue audio until `session.updated`).

**Risk:** Early mic PCM can be **discarded on the client**, not forwarded. A long tail of `input_audio_buffer.append` in the proxy does **not** prove the **first** chunks were not lost here.

**Refs:** `src/components/DeepgramVoiceInteraction/index.tsx` (`sendAudioData`, `settingsSentTimeRef`).

---

## 2 — `sendBinary` / `sendJSON` when WebSocket is not `OPEN` (no queue)

**Where:** `WebSocketManager` — if `readyState !== OPEN`, sends return `false` and the payload is **not** queued.

**Risk:** Any caller that fires before the socket is fully `OPEN` can lose messages silently (aside from logs).

**Refs:** `src/utils/websocket/WebSocketManager.ts` (`sendJSON`, `sendBinary`).

---

## 3 — `createDeepgramWss`: client `close` while Deepgram is still `CONNECTING`

**Where:** `packages/voice-agent-backend/src/attach-upgrade.js` — `clientWs.on('close')` only closes the upstream Deepgram socket when it is already `OPEN`.

**Risk:** Resource / lifecycle oddities on the **Deepgram** attach path; **not** the OpenAI `run.ts` leg unless traffic goes through `/deepgram-proxy`.

**Refs:** `createDeepgramWss` in `attach-upgrade.js`.

---

## 4 — `createOpenAIWss`: handler / pipe timing (OpenAI relay hop)

**Where:** `packages/voice-agent-backend/src/attach-upgrade.js` — historically, client `message` was only registered after upstream `open` (**Issue #571**, fixed in **0.2.13**): early **Settings** could be dropped on **browser → Express relay → translator**.

**Risk:** Same class of bug for **any** custom hop that registers listeners only after the far side is ready, without a queue.

**Refs:** `createOpenAIWss`, Issue **#571**, PR **#572**.

---

## 5 — Integrator extra hops

**Where:** Any gateway, second WebSocket, or auth layer in front of the documented endpoints.

**Risk:** Repeats section **4** if it reintroduces “late listener, no queue” or reorders frames.

---

## What already looks solid (proxy / translator)

The OpenAI **translator** (`packages/voice-agent-backend/scripts/openai-proxy/server.ts`) queues client messages when upstream is not ready (`clientMessageQueue`) and defers binary until session is ready (`pendingAudioQueue`, `hasSentSettingsApplied`). That is **not** the same “silent drop” class as **#571** on the **Express relay** before the fix.

---

## Evidence 2026-04-10 (Step D + proxy tee)

**Session shape:** Browser to `ws://localhost:8080/openai` (Step D), `tee` on the proxy log, browser console with debug. This path hit **standalone `run.ts`** (direct to translator), **not** Voice Commerce’s Express **`createOpenAIWss`** attach on port **3001** for this run.

### Can we discount every pitfall entirely?

**No.** A few are **largely** ruled out for **this** Step D session. None of that **proves** those pitfalls can never fire in other timings, providers, or routes (e.g. `/api/openai/proxy`, Deepgram, production without debug).

### Section-by-section verdict

**Section 1 — ~500 ms binary discard after Settings**

- **Not entirely discounted.**
- The proxy showed **deferred** appends until `session.updated`, then **many** `input_audio_buffer.append` events over several seconds. That **refutes** a strong reading: “**all** early mic audio is lost so **nothing** ever reaches the relay.”
- It does **not** refute a **weaker** reading: the **first** chunk(s) might still be dropped by the **client** gate while **later** PCM flows. If the only part that mattered for VAD were in that first window, you could still get a stall **even with** a long tail of appends (speculative without timestamps for **first** `sendBinary` vs gate end).
- **Summary:** Partially discounted; not entirely.

**Section 2 — `sendBinary` / `sendJSON` when not `OPEN`, no queue**

- **Largely discounted for this repro**, not “entirely” in all worlds.
- Console showed **`WebSocket connected`**, Settings on an **OPEN** socket, then repeated **`Sending binary data: 8192 bytes`**. The proxy showed matching **append** traffic after flush. That is inconsistent with “**every** binary attempt fails because we never reach `OPEN`.”
- **`sendBinary` return value** was not logged on every call, so rare drops on odd races are not **formally** falsified—but the **sustained** success pattern is strong negative evidence for section **2** as the **main** story here.

**Section 3 — `createDeepgramWss` client `close` while upstream `CONNECTING`**

- **Not the right failure mode** for this OpenAI Step D leg (Deepgram attach vs OpenAI `run.ts`). **N/A** for discounting “this OpenAI capture”—not disproven globally, just **out of scope** for this evidence.

**Section 4 — `createOpenAIWss` upstream `message` handler registration timing**

- **Largely discounted** for what was observed: **`session.created`** / **`session.updated`** and steady **client→upstream** appends in the **same** `connection_id`. A “deaf until late listener” proxy would be an odd fit.
- **Caveat:** Browser did not use Express **`createOpenAIWss`** for this run; the **partner** proxy still behaved coherently. One good **8080** session does not prove the **3001** attach path is always safe.

**Section 5 — Integrator extra hops**

- **Partially discounted** for Step D only: direct **8080** removes one class of hop. Does not remove **app** lifecycle (idle close, resume, StrictMode, mic gate), and does not speak to **non–Step D** configurations.

### Bottom line

| Section | Discount entirely? |
|--------|-------------------|
| 1 — ~500 ms gate | **No** — tail of audio clearly reached proxy; first-ms loss not excluded |
| 2 — send before `OPEN` | **No** — strong negative evidence this session; not formal proof for all paths |
| 3 — Deepgram attach | **N/A** for this OpenAI 8080 repro |
| 4 — late listener (OpenAI WSS) | **Largely** for observed proxy behavior; **not** universal proof |
| 5 — extra hops | **Partially** for Step D only |

The **`input_audio_buffer.append` deferred** / flushed pattern in the proxy supports the doc’s “**proxy queuing**” note: **not** the same silent-drop class as **#571** on the **translator** for that session.

---

## Related

- Issue **#571** — OpenAI relay queue fix; `docs/issues/ISSUE-571/README.md`
- Issue **#522** — FINDINGS (forwarder hypothesis F1)
- `docs/VOICE-COMMERCE-HANDOFF.md` — integration context
