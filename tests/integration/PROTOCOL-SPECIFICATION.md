# OpenAI Proxy: Protocol Specification and Test Coverage

**Purpose:** Single reference for every **server → proxy → client** event and required ordering, with a test (or test section) per requirement. Use this doc to ensure protocol changes are covered by integration tests and to audit coverage.

**Location:** This file lives in the **integration test folder** so tests and spec stay co-located; requirements and coverage are explicit in one place.

**See also:**
- [PROTOCOL-AND-MESSAGE-ORDERING.md](../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) — wire contract, session ordering, upstream→proxy→client mapping
- [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](../../docs/issues/ISSUE-470/PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md) — known requirements and test matrix
- [COMPONENT-PROXY-CONTRACT.md](../../docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) — component ↔ proxy contract
- [REAL-API-TEST-FAILURES.md](../../docs/issues/ISSUE-489/REAL-API-TEST-FAILURES.md) — real-API failure investigation and alignment

---

## 1. Server → Proxy → Client: Event Map

Every upstream (OpenAI Realtime API) event the proxy receives and what it sends to the client. Ordering rules are in §2.

| Upstream event | Proxy → client | Test(s) |
|----------------|----------------|---------|
| **session.created** | No message to client. Log only. Do not inject context or greeting. | `Issue #414: session.created does not trigger SettingsApplied or greeting injection (only session.updated does)` |
| **session.updated** | Send context items to upstream (if any); send **SettingsApplied** (text); send greeting as **ConversationText** (text) if configured. | `translates Settings to session.update and session.updated to SettingsApplied`; `Issue #489 real-API: client receives SettingsApplied within 10s of connect (session.updated)` |
| **conversation.item.created** / **.added** / **.done** | Decrement pending-item counter; when 0, send `response.create` to upstream. **Upstream requirement:** use conversation.item for finalized message and conversation history. Map assistant content to **ConversationText** (from item content only); do not forward raw event (Issue #500). | `Issue #388: sends response.create only after receiving conversation.item.added from upstream for InjectUserMessage`; `Protocol: same item id .added + .done count once`; `Upstream requirement: assistant ConversationText only from conversation.item.*`; `Issue #500: client does not receive raw conversation.item.added/created/done` |
| **response.output_text.done** | **Control only.** Clear response-in-progress; if deferred after FunctionCallResponse, send `response.create` to upstream. Send **AgentStartedSpeaking** (if not yet sent), **AgentAudioDone**; flush any buffered idle_timeout Error. **Do not** send ConversationText from this event (upstream requirement: conversation.item for finalized message and history). | `Issue #462: does not send session.update after output_audio.done until output_text.done`; `Issue #482 TDD: client receives AgentAudioDone when response completes (output_text.done)`; `Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done`; `Upstream requirement: when upstream sends only output_text.done (no item), client does not receive ConversationText (assistant)` |
| **response.done** | Clear response-in-progress; if deferred after FunctionCallResponse, send `response.create` to upstream. No client message. | `Issue #470: after function_call_output, response.done (no output_text.done) triggers proxy to send response.create once` |
| **response.output_audio_transcript.done** | No client message (control only). Assistant text from conversation.item.* only (upstream requirement). | (covered by control-event tests) |
| **response.function_call_arguments.done** | Map to **FunctionCallRequest** only (no ConversationText from this event; upstream requirement: conversation.item for finalized/history). | `translates response.function_call_arguments.done to FunctionCallRequest...`; `sends no FunctionCallRequest when upstream sends only output_text.done (no FCR)` |
| **response.output_audio.delta** | If first output for this response, send **AgentStartedSpeaking** (text). Decode base64 to PCM; send **binary** (raw PCM) to client. | `Issue #482 TDD: client receives AgentStartedSpeaking before ConversationText (assistant) for same turn`; `sends binary PCM to client when upstream sends response.output_audio.delta`; `Issue #414: only response.output_audio.delta is sent as binary; all other upstream messages as text` |
| **response.output_audio.done** | Send **AgentAudioDone** (text). No other client message. | `Protocol: response.output_audio.done sends no message to client` (proxy sends AgentAudioDone only); `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)` |
| **error** | Map to **Error** (component shape). If idle_timeout and response in progress, **buffer** Error and send after next `response.output_text.done`. Otherwise send immediately. Expected closures: session_max_duration → code `session_max_duration`; idle timeout → code `idle_timeout`. | `when upstream sends error after session.updated, client receives Error`; `Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout)`; `Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done` |
| **input_audio_buffer.speech_started** | Map to **UserStartedSpeaking**. | `when upstream sends input_audio_buffer.speech_started, client receives UserStartedSpeaking` |
| **input_audio_buffer.speech_stopped** | Map to **UtteranceEnd** (with channel, last_word_end). | `when upstream sends input_audio_buffer.speech_stopped, client receives UtteranceEnd with channel and last_word_end` |
| **Any other upstream event** | Send **Error** to client (code `unmapped_upstream_event`). Do not forward as text. See [UPSTREAM-EVENT-COMPLETE-MAP.md](../../packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md). | `Protocol: unmapped upstream event (e.g. response.created) yields Error (unmapped_upstream_event)` |

---

## 2. Required Ordering (summary)

- **Session:** Client sends Settings → proxy sends `session.update` → upstream sends `session.updated` → proxy sends SettingsApplied, injects context, sends greeting (text-only). No context/append before session.updated. See PROTOCOL-AND-MESSAGE-ORDERING §2.
- **Response create:** Proxy sends `response.create` only after item confirmation (conversation.item.added etc.) for InjectUserMessage; only after `response.output_text.done` or `response.done` for FunctionCallResponse. See §4 of PROTOCOL-AND-MESSAGE-ORDERING.
- **Agent activity / idle:** For a turn, client must receive AgentStartedSpeaking before first response output; AgentAudioDone (or AgentDone) when response completes. If upstream sends idle_timeout error while response in progress, proxy buffers Error and sends it after ConversationText (assistant). See PROTOCOL-AND-MESSAGE-ORDERING §5–6 and REAL-API-TEST-FAILURES §2.

---

## 3. Client-facing events (proxy → client) and tests

| Component message type | Frame type | When | Test(s) |
|------------------------|------------|------|---------|
| SettingsApplied | Text | After session.updated | See §1 session.updated row |
| ConversationText (user) | Text | After InjectUserMessage (echo) | `echoes user message as ConversationText (role user) when client sends InjectUserMessage` |
| ConversationText (assistant) | Text | **Upstream requirement:** from **conversation.item.created** / **.added** / **.done** (assistant content) or greeting only. Not from response.output_text.done or other control events. | `translates InjectUserMessage... and receives ConversationText (assistant) from conversation.item.*`; `Upstream requirement: assistant ConversationText only from conversation.item.*`; Issue #489 real-API tests |
| AgentStartedSpeaking | Text | Before first response output (first output_audio.delta or before ConversationText from output_text.done) | `Issue #482 TDD: client receives AgentStartedSpeaking before ConversationText (assistant) for same turn`; `Issue #489 real-API: client receives AgentStartedSpeaking before ConversationText (assistant) for a turn` |
| AgentAudioDone / AgentDone | Text | On response.output_audio.done or after ConversationText from response.output_text.done | `Issue #489 TDD: client receives AgentAudioDone after greeting ConversationText`; `Issue #489 real-API: InjectUserMessage receives ConversationText (assistant) and AgentAudioDone`; `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone` |
| FunctionCallRequest | Text | From response.function_call_arguments.done | See §1 function_call_arguments.done row |
| Error | Text | From upstream error; idle_timeout may be buffered until after ConversationText when response in progress | See §1 error row |
| (binary PCM) | Binary | From response.output_audio.delta only | `Issue #414: only response.output_audio.delta is sent as binary; all other upstream messages as text`; `sends binary PCM to client when upstream sends response.output_audio.delta` |
| Error (unmapped_upstream_event) | Text | When upstream sends an event type the proxy does not map | `Protocol: unmapped upstream event yields Error (unmapped_upstream_event)` |

---

## 4. Requirement ↔ test table (protocol requirements)

From PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE and PROTOCOL-ASSURANCE-GAPS. Each requirement has at least one integration test; real-API tests run with `USE_REAL_APIS=1`.

| Req | Requirement | Integration test(s) | Real-API test |
|-----|-------------|----------------------|----------------|
| 1 | session.update only when no active response | `Issue #459: does not send session.update while response is active`; `Issue #462: does not send session.update after output_audio.done until output_text.done` | `Issue #470 real-API: session.update not sent while response active (Req 1)` |
| 2 | Clear responseInProgress only on output_text.done (not audio.done alone) | `Issue #462: does not send session.update after output_audio.done until output_text.done` | Same test with USE_REAL_APIS=1 (unified #462) |
| 3 | response.create only after item.added (InjectUserMessage) | `Issue #388: sends response.create only after receiving conversation.item.added from upstream for InjectUserMessage` | `Issue #470 real-API: InjectUserMessage receives assistant response without error (Req 3)` |
| 4 | FunctionCallResponse: defer response.create until output_text.done | Mock + `Issue #470: after function_call_output, response.done triggers proxy to send response.create once` | `Issue #470 real-API: function-call flow completes without conversation_already_has_active_response`; `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone` |
| 5 | No context before session.updated | `Issue #414: session.created does not trigger SettingsApplied or greeting injection`; `Issue #414: no input_audio_buffer.append before session.updated` | Mock-only (real API does not let us delay session.updated to assert order) |
| 6 | No append before session.updated | `Issue #414: no input_audio_buffer.append before session.updated (audio gated, queued then flushed)`; `Issue #414: session.update before input_audio_buffer.append in upstream order` | — |
| 7 | Min audio before commit (e.g. ≥100ms) | `does not send input_audio_buffer.commit when total appended audio < 100ms (Issue #414 buffer too small)` | — |
| 8 | Only one response active at a time | `sends at most one response.create per turn until response completes` | `Issue #470 real-API` function-call test (strict 0 errors) |
| — | Session ready: client receives SettingsApplied within N s | `translates Settings to session.update and session.updated to SettingsApplied` | `Issue #489 real-API: client receives SettingsApplied within 10s of connect (session.updated)` |
| — | Idle timeout: client receives Error (code idle_timeout); when response in progress, after ConversationText | `Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done` | `Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout)` |
| — | After function call: client receives AgentThinking or equivalent then completion | `Issue #487: within 2s of FunctionCallResponse client receives AgentThinking or ConversationText (assistant) or AgentAudioDone` | `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone` |
| 9 | **Error handling: use structured codes; avoid message text** — **API codes:** map upstream `error` (and any events with a code) using the API's structured payload (e.g. `event.error?.code`), not message text. **Proxy codes:** when the proxy sends messages to the client (e.g. `Error` with `code`), use protocol-defined codes. Proxy should **avoid using text strings from messages** (API or client) for control flow or mapping if at all possible. When idle_timeout while response in progress, buffer Error and send after next `response.output_text.done`. | `when upstream sends error after session.updated, client receives Error`; `Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done` | `Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout)` |

---

## 5. Test file and run

- **File:** `openai-proxy-integration.test.ts` in this directory.
- **Mock-only tests:** Run with `npm test -- tests/integration/openai-proxy-integration.test.ts` (no env).
- **Real-API tests:** Run with `USE_REAL_APIS=1` (and `OPENAI_API_KEY` set). **Note:** `--testNamePattern=real-API` alone does **not** enable real-API tests; the env var is required. See [TEST-STRATEGY.md](../../docs/development/TEST-STRATEGY.md).

When adding or changing a protocol requirement, update (1) PROTOCOL-AND-MESSAGE-ORDERING.md, (2) this spec (§1–4), and (3) the test file so that every requirement has a corresponding test (or test section) listed here.
