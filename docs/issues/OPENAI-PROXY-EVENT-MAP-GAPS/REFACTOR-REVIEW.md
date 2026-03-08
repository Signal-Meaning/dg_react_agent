# Refactor review: Epic #493 and OpenAI proxy focus area

**Purpose:** Before proceeding with full testing, assess whether the epic work is complete, DRY, correct, well designed, and thoroughly documented. This doc records findings and optional refactors; no change is mandatory.

**Scope:** OpenAI proxy (`packages/voice-agent-backend/scripts/openai-proxy/`), epic #493 and sub-issues #494–#500, and related docs.

---

## 1. Completeness

| Area | Status | Notes |
|------|--------|--------|
| **Sub-issues** | Complete | All 7 (#494–#500) implemented or documented as decided. |
| **Event map** | Complete | UPSTREAM-EVENT-COMPLETE-MAP lists every handled event; unmapped events send Error (goal: eliminate over time). |
| **Known gaps (out of scope)** | Documented | `session.updated` payload not read for mapping (noted in UPSTREAM-EVENT-COMPLETE-MAP; consider for future). |
| **Acceptance criteria** | Met | Component docs (COMPONENT-PROXY-CONTRACT), protocol spec, integration tests all updated. |

**Verdict:** Work is complete for the epic scope. Optional follow-ups (e.g. reading `session.updated`) are explicitly called out, not hidden.

---

## 2. DRY (Don't Repeat Yourself)

| Location | Issue | Recommendation |
|----------|--------|----------------|
| **Function-call text format** | `formatFunctionCallPartForConversationText` (translator) and `mapFunctionCallArgumentsDoneToConversationText` (translator) both build `"Function call: name(args)"`. Logic is duplicated. | Extract a single helper, e.g. `function functionCallToConversationTextContent(name: string, args?: string): string`, and use it in both. `mapFunctionCallArgumentsDoneToConversationText` remains in use for unit tests (tests/openai-proxy.test.ts). |
| **Transcript channel/timing** | `mapInputAudioTranscriptionCompletedToTranscript` and `mapInputAudioTranscriptionDeltaToTranscript` each contain the same 5-line block for `channelIndex`, `channel`, `start`, `duration` from upstream (with defaults). | Extract e.g. `function transcriptChannelAndTiming(event: { channel?: number; channel_index?: number[]; start?: number; duration?: number }) { ... }` returning `{ channel, channel_index, start, duration }` and use in both mappers. |
| **mapApiErrorCodeToComponentCode** | Function currently returns `apiCode` in both branches (no actual mapping). Comment says "Pass-through for known protocol codes and any other API code". | Either (a) simplify to `return apiCode` and add a one-line comment that this is the single place to add code mapping if needed, or (b) leave as-is and add comment "Pass-through; extend here if API sends a code we must normalize to component code." |

**Verdict:** Two clear DRY opportunities (function-call string, transcript channel/timing); one minor clarity (error code pass-through). Refactors are low risk and improve maintainability.

---

## 3. Correctness

| Area | Assessment |
|------|-------------|
| **Upstream requirement** | Assistant ConversationText only from `conversation.item.*` (and greeting); not from `response.output_text.done` or FCR. Implemented and tested. |
| **Transcript accumulation** | Delta accumulator is per-connection, keyed by `item_id`; cleared on `.completed` for that item. Matches intended behavior. |
| **UtteranceEnd** | `mapSpeechStoppedToUtteranceEnd` uses upstream `channel` and `last_word_end` when present, defaults otherwise. Integration test asserts passthrough. |
| **Unmapped events** | Send Error with `code: 'unmapped_upstream_event'`; no raw forward. Integration test asserts. |
| **Raw conversation.item** | No longer forwarded to client (Issue #500); only mapped ConversationText. Test asserts absence of raw. |

**Verdict:** Behavior matches the documented contract and tests. No correctness issues identified.

---

## 4. Design

| Aspect | Assessment |
|--------|------------|
| **Separation of concerns** | Translator: pure mapping. Server: connection state, accumulator, dispatch. Clear split. |
| **State** | Connection-scoped state (accumulator, pending counters, sent item IDs) is explicit and localized in the connection handler. |
| **Dispatch** | Single long `if / else if` on `msg.type` in server. Alternative: map of `msg.type` → handler for testability and smaller functions; would be a larger refactor and not required for correctness. |
| **Error handling** | Structured codes (`getComponentErrorCode`); unmapped and parse errors both produce Error to client. Consistent. |

**Verdict:** Design is sound. Optional future improvement: extract message-type handlers into a small registry if the branch list grows or you want to unit-test handlers in isolation.

---

## 5. Best practices

| Practice | Status |
|----------|--------|
| **Structured codes over message text** | Used (error codes, no inference from description). |
| **No raw passthrough** | Unmapped events → Error; no forwarding of unknown JSON. |
| **Single source of truth for mappings** | Translator is the only place that defines component message shape from upstream. |
| **TDD** | Epic work was done with tests first (or tests added and then implementation); integration tests cover the new behavior. |
| **Documentation** | Event map, protocol spec, component contract, and epic/TDD docs updated. |

**Verdict:** Aligned with project best practices. DRY improvements would further reinforce "single place for each concept."

---

## 6. Documentation

| Doc | Role | State |
|-----|------|--------|
| **UPSTREAM-EVENT-COMPLETE-MAP.md** | Authoritative list of upstream events and proxy action. | Up to date; links to epic and issues. |
| **PROTOCOL-SPECIFICATION.md** | Event map + client-facing events + test references. | Up to date. |
| **PROTOCOL-AND-MESSAGE-ORDERING.md** | Wire contract and ordering. | Up to date. |
| **COMPONENT-PROXY-CONTRACT.md** | Component ↔ proxy contract; includes "Proxy → component: message sources (Epic #493)". | Up to date. |
| **EPIC.md** | Epic scope, sub-issues, acceptance criteria. | Complete; all criteria checked. |
| **TDD / rationale docs** | Per-issue TDD and DOC-output-text-done-rationale. | Present and updated. |
| **openai-proxy README.md** | Entry point for proxy package. | Points to PROTOCOL-AND-MESSAGE-ORDERING and API-DISCONTINUITIES; does **not** yet point to UPSTREAM-EVENT-COMPLETE-MAP or epic. |

**Gap:** The proxy README does not list UPSTREAM-EVENT-COMPLETE-MAP or the epic as the central place for "what we do with each upstream event." New contributors might miss the event map.

**Recommendation:** Add to the proxy README a short "Docs index" (or "Further reading") with:
- Event map: UPSTREAM-EVENT-COMPLETE-MAP.md
- Epic and gaps: docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md
- Protocol spec (integration): tests/integration/PROTOCOL-SPECIFICATION.md

**Verdict:** Documentation is thorough. One small improvement: make the event map and epic discoverable from the proxy README.

---

## 7. Summary and suggested actions

| Priority | Action | Effort | Status |
|----------|--------|--------|--------|
| **Done** | DRY: extract `functionCallToConversationTextContent(name, args)` and use in both function-call paths. | Small | Implemented in translator.ts; exported for unit tests. |
| **Done** | DRY: extract `transcriptChannelAndTiming(event)` and use in both Transcript mappers. | Small | Implemented in translator.ts. |
| **Done** | Clarify or simplify `mapApiErrorCodeToComponentCode` (comment or single return). | Trivial | Simplified to `return apiCode` with comment to extend if needed. |
| **Done** | Add "Docs index" / "Further reading" to openai-proxy README (event map + epic + protocol spec). | Trivial | Added "Further reading (docs index)" table in README. |
| **Defer** | Refactor server message dispatch into a handler registry (optional design improvement). | Medium | Not done. |

No blocking issues. The epic work is complete, correct, and documented. The optional refactors above have been implemented; unit and integration tests (openai-proxy.test.ts, Issue #494/#496/#497/#499) pass.
