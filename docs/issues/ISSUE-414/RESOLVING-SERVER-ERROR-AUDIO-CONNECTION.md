# Issue #414: Resolving the server error — firm audio connection

This document focuses on **item #1**: resolving the upstream "server had an error" so we can establish a **firm audio connection**. Text-only conversations through the OpenAI proxy work (session.update → session.updated → InjectUserMessage → response). The **audio** path fails: as soon as we send `input_audio_buffer.append` (after session.updated), the API returns an error and closes the connection. We want **tests that prove the correct protocol** for opening a firm audio connection, analogous to what we have for text.

**Related:** [NEXT-STEPS.md](./NEXT-STEPS.md) §3.3, [VAD-FAILURES-AND-RESOLUTION-PLAN.md](./VAD-FAILURES-AND-RESOLUTION-PLAN.md). Phase B (VAD/session config) waits until the server error is resolved or understood.

---

## 1. Current state

| Path | Outcome |
|------|---------|
| **Text only** | Works. Client sends Settings → proxy sends session.update → session.updated → context/greeting to client → client sends InjectUserMessage → proxy sends conversation.item.create → response.create after item confirmed → agent response. |
| **Audio** | Fails. After session.updated we send input_audio_buffer.append (we now gate append until after session.updated). Upstream responds with "The server had an error while processing your request..." and closes (code 1000). No VAD, no response. |

**Observed sequence per connection (proxy debug):**  
client connected → upstream open → Settings → session.created → session.updated → greeting sent to client only → **input_audio_buffer.append** → KeepAlive → **error** → upstream closed.

So the **next upstream message after we send audio is an error**. The API never gets to the point of sending VAD or processing the turn.

---

## 2. Goal: protocol and tests for a firm audio connection

We want:

1. **A defined protocol** for opening a connection that is ready for **audio** (not just text): e.g. connect → session.update → session.updated → *then* send append; no append before session.updated. We have implemented and tested this (audio gate + integration tests).
2. **Tests that prove** that, when we follow that protocol, the connection either (a) stays open and accepts audio (no error after append), or (b) fails in a documented way so we can distinguish our protocol from upstream/API issues.
3. **No reliance on diagnostic flags** as a permanent fix until we understand why the server error occurs.

Current tests already prove **our** protocol (no append before session.updated; order of session.update then append). What we do **not** yet have is a test that runs against the **real** API and asserts "after sending append, we do not receive an error within X seconds" (or we document that the real API currently returns an error and treat that as a known limitation until resolved).

---

## 3. What we know

- **Audio gate:** We only send `input_audio_buffer.append` after `session.updated`. Binary that arrives earlier is queued and flushed when session.updated is received. Integration tests and mock protocol enforcement confirm this.
- **Proxy logs:** With `OPENAI_PROXY_DEBUG=1`, multiple 5b runs show the same pattern: append → KeepAlive → error → close. No `speech_started` or `speech_stopped` from upstream.
- **Error source:** The error message is from the OpenAI Realtime API. We forward it; we do not cause it. Community reports exist for this class of error (see proxy README).

---

## 4. Tests that prove / document the protocol

| Test | What it proves | Status |
|------|----------------|--------|
| **No append before session.updated** | Proxy does not send input_audio_buffer.append until after session.updated; binary is queued and flushed then. | Done (integration tests + mock protocol enforcement). |
| **session.update before first append (order)** | Upstream receives session.update before any input_audio_buffer.append. | Done (integration tests). |
| **Real API: connection stays open after append (or documented error)** | Against real OpenAI: after we send append following our protocol, we either get no error within a time window (firm audio connection) or we document that the API returns an error. | Done. Integration test: "Issue #414: firm audio connection — no Error from upstream within 5s after sending audio" (mock passes; real-API run with USE_REAL_OPENAI=1 fails today and documents the server error until resolved). |

**Integration tests:** `tests/integration/openai-proxy-integration.test.ts` — mock test runs in CI; real-API test runs only with `USE_REAL_OPENAI=1` and `OPENAI_API_KEY`. When the server error is resolved, the real-API test should pass. **Run order:** integration tests first against real APIs (when keys available), then mocks; see [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md).

---

## 5. Plan (next steps)

1. **Define "firm audio connection" in the protocol** — **Done.**  
   [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §2.4 is the single source of truth: connection is ready for audio when session.updated has been received; client must not send audio before SettingsApplied; proxy queues binary until then.

2. **Add a test that proves or documents real-API behavior after append** — **Done.**  
   Integration test "Issue #414: firm audio connection — no Error from upstream within 5s after sending audio" (mock + real-API variant). See §4 above.

3. **Investigate upstream** — **In progress.**  
   Check OpenAI Realtime API docs and community/support for "server had an error" when sending `input_audio_buffer.append` after `session.updated`. Notes:
   - **API:** [Client events – input_audio_buffer.append](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append): audio must be in the format specified by `input_audio_format` in the session configuration. We do not set `input_audio_format` in session.update (we omit audio config per Issue #414 to avoid partial config); API default is likely PCM.
   - **Community:** "The server had an error while processing your request" is reported with the Realtime API (see [proxy README](../../scripts/openai-proxy/README.md) link). Other reports: empty buffer on commit, tool-call server errors, `session.updated` not updating `input_audio_format`. No definitive fix for our sequence (append after session.updated) found yet.
   - **Next:** Re-run real-API integration test when keys available; if error persists, consider opening a support/community thread with minimal repro (connect → session.update → session.updated → append → error).

4. **Phase B (VAD / session config)**  
   Defer until the server error is resolved or understood (per your agreement).

---

## 6. References

- **Proxy protocol:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) (§2.4 firm audio connection)
- **Proxy README (server error):** [scripts/openai-proxy/README.md](../../scripts/openai-proxy/README.md)
- **OpenAI Realtime client events (input_audio_buffer.append):** https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append
- **Community: "server had an error":** https://community.openai.com/t/realtime-api-the-server-had-an-error-while-processing-your-request/978856
- **VAD and Phase B:** [VAD-FAILURES-AND-RESOLUTION-PLAN.md](./VAD-FAILURES-AND-RESOLUTION-PLAN.md)
- **NEXT-STEPS §3.3:** Server error / 1005
