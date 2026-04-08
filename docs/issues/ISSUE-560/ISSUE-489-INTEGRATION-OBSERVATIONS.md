# Issue #489 — real-API integration test (`AgentAudioDone` after `FunctionCallResponse`)

**Purpose:** Capture what we see when running the failing/passing case with **`LOG_LEVEL=debug`** on the in-process OpenAI proxy (`createOpenAIProxyServer` in `openai-proxy-integration.test.ts`).

**Test name:** `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)`

**Command (repo root, requires `OPENAI_API_KEY`):**

```bash
USE_REAL_APIS=1 LOG_LEVEL=debug npm test -- tests/integration/openai-proxy-integration.test.ts \
  -t "Issue #489 real-API: after FunctionCallResponse"
```

**Last run (agent session):** *(filled in below after each run)*

| Field | Value |
|-------|--------|
| Date | 2026-04-08 |
| Result | **Pass** — `Issue #489 real-API: after FunctionCallResponse…` (~1s) after **`toolChoice: 'required'`** + stricter prompt in `openai-proxy-integration.test.ts` |
| Notes | Prior run (same day, before test change): **fail** — see **Findings: pre-fix run** below. Re-run logs showed **`response.function_call_arguments.done` → FunctionCallRequest** and **`timezone` / `UTC`** in argument deltas. |

---

## Findings: pre-fix run (2026-04-08) — log review

1. **Upstream never sent `response.function_call_arguments.done`** in that capture (no matching proxy log line; only `session.update` with `tools=1`). The model completed a **normal assistant audio turn** (“Sure, could you tell me what time zone you're in?”) instead of calling `get_current_time`.
2. **Effect on the test:** `sentFunctionCallResponse` stayed **false**, so the handler **ignored** every **`AgentAudioDone`** (the assertion requires `AgentAudioDone && sentFunctionCallResponse`). The test then timed out at 60s even though **`response.output_audio.done`** and **`response.done`** occurred and the proxy logged **“Received response.done from upstream — sending AgentAudioDone…”**.
3. **Misleading proxy log:** That INFO line is emitted **before** `sendAgentAudioDoneIfNeeded()`. If `hasSentAgentAudioDoneForCurrentResponse` was already true (e.g. **`output_audio.done`** already sent **`AgentAudioDone`**), the log still claims “sending” while the call is a no-op. Prefer interpreting logs together with **`output_audio.done`** / **`output_text.done`** order.
4. **`conversation.item.done` (assistant, `output_audio`):** Debug showed **`mapped=true sent=false`** for ConversationText — assistant text was handled on another path (e.g. **`response.output_audio_transcript.done`** fallback); not the root cause of the timeout.
5. **Tail:** Client WebSocket closed with code **1005** after Jest timeout; upstream closed afterward.

**Mitigation in test (shipped):** `agent.think.toolChoice: 'required'` (Issue #535 → Realtime `session.tool_choice`) plus a prompt that **requires** calling `get_current_time` with default **UTC** when the user asks for the time. Timeout copy distinguishes **never received FunctionCallRequest** from **no post-FCR `AgentAudioDone`** (including possible ordering with **`output_audio.done`** before FCR).

---

## Log review checklist

1. After client `FunctionCallResponse`, does upstream emit completion (`response.done` / `response.output_text.done`) within the test window?
2. Does the proxy emit **`AgentAudioDone`** to the client, or stop earlier on **Error** / idle?
3. Any **`conversation_already_has_active_response`** or ordering anomalies in debug lines?
4. If the test times out with **`sentFunctionCallResponse === false`**, confirm whether **`response.function_call_arguments.done`** appeared in proxy logs — if not, the failure is **model/tool policy**, not proxy completion.
