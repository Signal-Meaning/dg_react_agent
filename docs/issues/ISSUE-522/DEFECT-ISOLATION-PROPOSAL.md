# Issue #522: Defect isolation proposal — function-call flow never delivers follow-up

## Observed failure (from terminal 6)

1. **E2E 6b** (backend + test-app + real API): After "What time is it?" → FunctionCallRequest → backend POST → FunctionCallResponse, the test waits for `[data-testid="agent-response"]` to match `/\d{1,2}:\d{2}|UTC/`. It **never does**: the element stays **"Hello! How can I assist you today?"** (the greeting) for the full 45s timeout. So the **agent’s follow-up (time) never appears** in the UI.

2. **Integration real-API** (Jest proxy → real API): After FunctionCallResponse, the client never receives **AgentAudioDone** within 60s (same flow times out).

**Conclusion:** After we send `function_call_output` to the real API, the client never gets (a) the completion signal (AgentAudioDone) and (b) the next assistant turn (ConversationText with the time). So the defect is somewhere in: **real API → proxy → client** for the post–function-call path.

---

## Scope: focus on expanded requirements, not known paths

**Many E2E function-calling tests already pass.** Isolation work should target only the **expanded requirements** for this failure (Issue #522: deferred `response.create`, completion handling, no `conversation_already_has_active_response`) and avoid re-proving paths that other tests already cover.

### Known-good paths (do not re-validate)

| Test / spec | What it validates |
|-------------|--------------------|
| **6** (openai-proxy-e2e) | Same flow as 6b: connect → Settings → "What time is it?" → FunctionCallRequest → backend POST → wait for time in `agent-response`. Allows up to 2 agent errors. |
| **6d** (openai-proxy-e2e) | Same flow; asserts only step 1–2 (backend POST /function-call 200 + CORS, app sent result). Does not assert proxy/UI. |
| **issue-373** (idle timeout during function calls) | Function-call flow: long-running call, thinking phase, concurrent calls, re-enable idle after completion (including AgentAudioDone). |
| **issue-508** (chained function calls) | Connection stays open between first function result and second (chained) function call. |
| **issue-351** (function-call proxy mode) | Function-call with Deepgram proxy; structure and flow. |
| **issue-353** (binary/JSON) | Function-call with real API; message handling. |
| **context-retention-with-function-calling** | Function-calling plus context on reconnect. |

When these pass, we know: connection, Settings, FunctionCallRequest, backend POST /function-call, and (where asserted) time in UI or AgentAudioDone are working. The **current** 6b failure (agent-response stuck on greeting) would also fail **test 6** at the same line (`toHaveText(FUNCTION_CALL_TIME_RESPONSE_PATTERN)`); the only extra requirement in 6b is the final **strict 0 recoverable errors** (no `conversation_already_has_active_response`).

### What to focus on

- **Isolation steps** should target the **post–function_call_output** path only: upstream completion → proxy deferred `response.create` → next upstream turn (conversation.item.*) → proxy ConversationText / AgentAudioDone → client/UI.
- **New tests** should not re-validate connection, Settings, or backend POST; they should assume those paths are covered by the tests above and focus on:
  - Completion event handling (order/shape),
  - Deferred `response.create` and the next turn (conversation.item → ConversationText),
  - Whether the client ever receives the follow-up (proxy vs component).
- **Before adding E2E or integration steps**, run **test 6** in the same environment as 6b. If 6 passes and 6b fails, the defect is likely the strict error assertion; if both fail at the time-pattern assertion, the defect is the shared path (no time delivered), and isolation should concentrate there.

---

## Possible causes (hypotheses)

| # | Hypothesis | Where to look |
|---|------------|----------------|
| A | **Real API never sends** `response.done` or `response.output_text.done` after our `function_call_output` (contract violation). We wait forever; 20s timeout sends `response.create` but the next turn may still not arrive in time or at all. | Proxy logs: do we ever log "response.output_text.done" or "Received response.done from upstream" after sending function_call_output? |
| B | **Real API sends completion in an order or shape we don’t handle** (e.g. `response.done` with different payload, or we only handle one of the two events and the API sends the other). | Proxy: strict `msg.type === 'response.done'` / `'response.output_text.done'`; any parsing or ordering assumption. |
| C | **We receive completion and send `response.create`**, but the **next** upstream message (conversation.item.* for the assistant’s reply) is in a shape **`mapConversationItemAddedToConversationText` returns null** for, so we never send ConversationText to the client. | Translator + server: conversation.item.* handler and mapper for assistant role. |
| D | **We never send the deferred `response.create`** (e.g. we clear `pendingResponseCreateAfterFunctionCallOutput` elsewhere, or we require both response.done and output_text.done). | server.ts: all assignments to `pendingResponseCreateAfterFunctionCallOutput` and the branches that send `response.create`. |
| E | **Test-app / component** never updates the displayed message when it receives the second ConversationText (assistant). Less likely if integration also never sees AgentAudioDone. | test-app: how agent-response is updated when receiving multiple ConversationText (assistant) messages. |

---

## Tests to add to isolate the defect

### 1. Diagnostic: capture real API upstream events (single run)

**Goal:** See exactly what the real API sends after we send `function_call_output`.

**Implementation:**

- Add a **small script or one-off test** that:
  - Starts the proxy (or uses the existing one) with **logging of every upstream message** (type + optional payload size) for a fixed window (e.g. 25s) after the proxy sends `function_call_output`.
- Flow: connect client → Settings (get_current_time) → InjectUserMessage "What time is it?" → on FunctionCallRequest send FunctionCallResponse → **from that moment**, record every `msg.type` (and optionally a hash of payload) from the upstream socket until 25s.
- **Output:** Log or write to a file: ordered list of `{ type, at_ms }` (and optionally whether we handled it). No assertion—purely diagnostic.

**Result:** If we never see `response.done` or `response.output_text.done` in that window → hypothesis A (API not sending). If we see them → defect is downstream (B/C/D).

**Placement:** Implemented in `server.ts`: when env `CAPTURE_UPSTREAM_AFTER_FCR=1`, the proxy records every upstream message type (and `at_ms` since function_call_output) for 25s and writes `test-results/upstream-after-function-call.json`. Run backend + E2E 6b (or test 6) with that env set to capture.

---

### 2. Integration (mock): completion sent in unusual order

**Goal:** Ensure we don’t assume a specific order of completion events (e.g. only `response.output_text.done` or only `response.done`).

**Tests to add:**

- **2a.** Mock sends **`response.done` first**, then 50ms later **`response.output_text.done`**. Assert: client receives AgentAudioDone, mock receives exactly one `response.create`, no duplicate and no crash.
- **2b.** Mock sends **`response.output_audio.done`** then **`response.done`** (no `response.output_text.done`). Assert: we still send deferred `response.create` and client gets AgentAudioDone (we already have “response.done only” test; this adds “audio.done then response.done”).

**Purpose:** Rule out that the real API’s ordering (e.g. response.done before output_text.done, or with output_audio.done in between) triggers a path we don’t handle.

---

### 3. Integration (mock): conversation.item after deferred response.create

**Goal:** After we send the deferred `response.create`, the next upstream event is conversation.item.* (assistant). Ensure we map and forward it.

**Test to add:**

- **3.** Mock sends: session.updated → response.function_call_arguments.done (so client sends FunctionCallResponse) → we send function_call_output → mock sends **response.output_text.done** (so we send response.create) → mock then sends **conversation.item.added** with assistant content `"The current time is 2:56 AM UTC."`.  
  Assert: client receives **ConversationText** (assistant) with content matching that string (or a pattern like time/UTC).

**Purpose:** If this passes with the mock, our “completion → response.create → next item → ConversationText” path is correct. If the real API sends a different conversation.item shape (e.g. different `content` structure), we can add a variant (test 4) or fix the mapper.

---

### 4. Integration (mock): real API–like conversation.item shape

**Goal:** If we capture a real API `conversation.item.added` payload (from diagnostic or logs), replay it in the mock and assert we send ConversationText.

**Test to add (after we have a sample):**

- **4.** Mock sends the **exact** conversation.item.added (or .created / .done) payload that the real API sends for the assistant’s “time” reply (e.g. from backend logs or capture script). Assert: `mapConversationItemAddedToConversationText` returns non-null and we send ConversationText to the client.

**Purpose:** Isolate hypothesis C (mapper returns null for real API shape).

---

### 5. E2E diagnostic: did the client receive the follow-up event?

**Goal:** Distinguish “proxy never sent ConversationText” from “component received it but didn’t update the UI.”

**Implementation:**

- In test-app, when running in test mode (e.g. `test-mode=true`), **expose on `window`** the last N agent protocol messages (e.g. last 20 message types, or last few ConversationText (assistant) contents).
- E2E 6b (or a variant): after waiting for the time pattern (or timeout), **read that diagnostic** (e.g. `await page.evaluate(() => window.__lastAgentMessages)`) and assert or log whether **ConversationText (assistant)** with time-like content was ever received.

**Result:** If the client never received it → defect is proxy (or upstream). If the client received it but UI stayed on greeting → defect is test-app/component rendering.

---

### 6. Unit test: completion branches and state

**Goal:** Lock down that when `pendingResponseCreateAfterFunctionCallOutput === true` and we receive exactly one of `response.done` or `response.output_text.done`, we clear the flag, clear the timeout, and send `response.create` once.

**Implementation:**

- Extract the “upstream message handler” into a testable function (or use a small state machine in a separate module) that takes current state + upstream message and returns new state + list of “actions” (e.g. send response.create, send AgentAudioDone).  
  **Unit test:** For each of two inputs `{ type: 'response.done' }` and `{ type: 'response.output_text.done' }`, with state `pendingResponseCreateAfterFunctionCallOutput: true`, assert we emit exactly one “send response.create” and one “send AgentAudioDone”, and that the flag is cleared.

**Purpose:** If this passes, the defect is not “we forgot to handle one of the two events” in isolation; it may be ordering, payload shape, or real API not sending.

---

## Recommended order of work

0. **Confirm scope:** In the same environment where 6b fails, run **test 6** (same flow, allows errors). If 6 passes, the failure is 6b’s strict error assertion; if 6 also fails at the time-pattern line, the defect is the shared post–function_call_output path—focus isolation there and avoid duplicating known paths (see Scope above).
1. **Run diagnostic (1)** once with real API and inspect whether `response.done` / `response.output_text.done` appear after function_call_output. That tells us A vs B/C/D.
2. **Add integration tests (2a, 2b, 3)** so we lock behavior for completion order and for “next turn” conversation.item. These don’t depend on the real API. **Done:** 2a (response.done then output_text.done), 2b (output_audio.done then response.done), 3 (conversation.item.added assistant after completion → ConversationText) in `openai-proxy-integration.test.ts`.
3. **Add E2E diagnostic (5)** so we know whether the client ever receives the follow-up ConversationText.
4. If the real API sends a different conversation.item shape, **add test (4)** with a captured payload and fix the mapper if needed.
5. **Unit test (6)** is optional but useful to prevent regressions in the completion-handling branches.

---

## Summary table

| Test | Type | Purpose |
|------|------|--------|
| 1. Capture upstream after FCR | Diagnostic (one-off) | See what real API sends after function_call_output |
| 2a. response.done then output_text.done | Integration (mock) | Order: both completion events |
| 2b. output_audio.done then response.done | Integration (mock) | Order: audio.done before response.done |
| 3. conversation.item.added after deferred response.create | Integration (mock) | Next turn’s assistant item → ConversationText |
| 4. Real API conversation.item shape | Integration (mock) | Mapper handles real payload (after capture) |
| 5. E2E: client received follow-up? | E2E diagnostic | Proxy vs component |
| 6. Unit: completion state machine | Unit | Correct handling of response.done / output_text.done |

Once (1) and (5) are run, we can narrow the defect to: upstream not sending completion (A), wrong order/shape (B), mapper dropping next turn (C), or not sending deferred response.create (D).
