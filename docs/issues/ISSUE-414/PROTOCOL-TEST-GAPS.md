# Issue #414: Protocol document – test gaps

**Purpose:** Map [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) requirements to existing tests and list **missing** unit and integration tests.

**Existing coverage (summary):**

- **Unit:** `tests/openai-proxy.test.ts` (translator mappings, Issue #388 response.create helper), `tests/unit/openai-proxy-first-binary-json-heuristic.test.js` (first binary not JSON).
- **Integration:** `tests/integration/openai-proxy-integration.test.ts` (wire contract, session.created vs session.updated, greeting text-only, context after session.updated, binary-only-for-delta, FunctionCallResponse, user echo, error forwarding, duplicate Settings, response.create after item.added).

---

## 1. Wire contract (§1)

| Requirement | Covered? | Where | Gap |
|-------------|----------|--------|-----|
| Client JSON → proxy accepts as text; binary → `input_audio_buffer.append` (upstream gets JSON) | Yes | Unit: `binaryToInputAudioBufferAppend`. Integration: "translates binary client message to input_audio_buffer.append..." | — |
| Only `response.output_audio.delta` (decoded) → client as **binary**; all other upstream → client as **text** | Yes | Integration: "Issue #414: only response.output_audio.delta is sent as binary..."; E2E + heuristic unit test | — |
| **response.output_audio.done** → no message to client | **Yes** | Integration: *"Protocol: response.output_audio.done sends no message to client"* | — |
| **conversation.item.added** (and .created/.done) → client as **text** | **Yes** | Integration: *"Protocol: conversation.item.added or .done received by client as text frame"* | — |

---

## 2. Connection and session ordering (§2)

| Requirement | Covered? | Where | Gap |
|-------------|----------|--------|-----|
| Messages from client **queued** until upstream `open`, then **drained in order** | **Yes** | Integration: *"Protocol: client message queue order (session.update then conversation.item.create)"* | — |
| Duplicate Settings → only first `session.update`; second gets SettingsApplied only | Yes | "forwards only first Settings per connection" | — |
| **session.created** → no SettingsApplied, no context/greeting injection | Yes | "session.created does not trigger SettingsApplied or greeting injection" | — |
| **session.updated** → context to upstream, SettingsApplied + greeting (text) to client | Yes | Context test, greeting tests | — |

---

## 3. Client → Proxy message handling (§3)

| Requirement | Covered? | Where | Gap |
|-------------|----------|--------|-----|
| Settings → session.update once, store context/greeting | Yes | Multiple tests | — |
| InjectUserMessage → conversation.item.create, user echo, response.create after item ack | Yes | InjectUserMessage + Issue #388 test | — |
| FunctionCallResponse → conversation.item.create (function_call_output) + response.create immediately | Yes | Function call test | — |
| **Other JSON** (unknown type) → forwarded to upstream as-is (text) | **Yes** | Integration: *"Protocol: other client JSON (e.g. KeepAlive) forwarded to upstream"* | — |
| Binary → input_audio_buffer.append + debounce commit/response.create | Yes | Binary message test | — |

---

## 4. response.create ordering (§4)

| Requirement | Covered? | Where | Gap |
|-------------|----------|--------|-----|
| response.create only after **one** item confirmation for InjectUserMessage | Yes | "Issue #388: sends response.create only after conversation.item.added" (with delay) | — |
| **Same item: .added and .done** → counter decremented **once** per item id (no double-decrement) | **Yes** | Integration: *"Protocol: same item id .added + .done count once (one response.create)"* | — |
| FunctionCallResponse → response.create immediately (no wait) | Yes | Function call test | — |

---

## 5. Upstream → Proxy event handling (§5)

| Requirement | Covered? | Where | Gap |
|-------------|----------|--------|-----|
| session.created → no message to client | Yes | session.created test | — |
| session.updated → context, SettingsApplied, greeting (text) | Yes | Multiple | — |
| conversation.item.* → forward as **text**; decrement counter | Yes / Partial | Wire contract + item.added ordering | Optional: explicit “item.added is text” above. |
| response.output_text.done → ConversationText (text) | Yes | Translator unit + integration | — |
| response.output_audio_transcript.done → ConversationText (text) | Yes | Unit + integration | — |
| response.function_call_arguments.done → FunctionCallRequest + ConversationText (text) | Yes | Integration | — |
| response.output_audio.delta → binary to client | Yes | "sends binary PCM to client when upstream sends response.output_audio.delta" | — |
| response.output_audio.done → **no** message to client | **Yes** | See §1. | — |
| error → Error (text) | Yes | "when upstream sends error... client receives Error" | — |
| **Any other upstream event** → forward to client as **text** | **Yes** | Integration: *"Protocol: other upstream event (e.g. response.created) forwarded to client as text"* | — |

---

## 6. Recommended tests (concise)

### Unit

- **None strictly required.** Translator and heuristic are well covered. The “response.create only after item.added” rule is encoded in a helper and in the server; the server behavior is best asserted in integration.

### Integration (added 2026-02)

1. **response.output_audio.done sends no message to client** — *"Protocol: response.output_audio.done sends no message to client"*
2. **Client message queue order** — *"Protocol: client message queue order (session.update then conversation.item.create)"*
3. **Same item id: .added + .done count once** — *"Protocol: same item id .added + .done count once (one response.create)"*
4. **Other client JSON forwarded to upstream** — *"Protocol: other client JSON (e.g. KeepAlive) forwarded to upstream"*
5. **Other upstream event forwarded as text** — *"Protocol: other upstream event (e.g. response.created) forwarded to client as text"*
6. **conversation.item.added/.done as text (optional)** — *"Protocol: conversation.item.added or .done received by client as text frame"*

---

## 7. References

- Protocol spec: [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)
- Unit tests: `tests/openai-proxy.test.ts`, `tests/unit/openai-proxy-first-binary-json-heuristic.test.js`
- Integration tests: `tests/integration/openai-proxy-integration.test.ts`
