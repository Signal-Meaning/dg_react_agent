# Plan: Upstream event coverage and completeness

**Goal:** Know how we identified missing branches, and how we **guarantee completeness** so that only **unknown future** event types hit the unmapped path.

---

## How we identified missing branches (conversation.created, etc.)

- **Source of truth:** [OpenAI Realtime server events](https://platform.openai.com/docs/api-reference/realtime-server-events). The API reference enumerates every server event type (e.g. `type: "conversation.created"`, `type: "conversation.item.input_audio_transcription.failed"`).
- **Gap analysis:** We compared the **explicitly handled** list in `server.ts` (each `msg.type === '...'` branch) against the **full list of event types** in the API docs. Any event type present in the API but not in our handler chain was a candidate to hit the unmapped `else` when the real API sends it.
- **Evidence:** Voice-commerce reported unmapped events in production; our integration test used `conversation.created` as the canonical unmapped example. We then checked the API spec and added explicit branches for `conversation.created` and `conversation.item.input_audio_transcription.failed` / `.segment` (Issue #517).
- **Automation:** We now have a **canonical list** (`OPENAI-REALTIME-SERVER-EVENT-TYPES.ts`) and a **regression test** (`tests/openai-proxy-event-coverage.test.ts`) that fails if any canonical type has no branch in `server.ts`.

---

## How to guarantee completeness (reduce unmapped to “unknown future” only)

### 1. Canonical list from API

- **Action:** Maintain a single **canonical list** of all upstream event types documented by the OpenAI Realtime API (e.g. in this repo: `packages/voice-agent-backend/scripts/openai-proxy/OPENAI-REALTIME-EVENT-TYPES.md` or a JSON/TS list derived from the [API reference](https://platform.openai.com/docs/api-reference/realtime-server-events)).
- **Process:** When the API docs are updated (new event type, or we discover one we missed), add it to the canonical list. Source can be manual extraction from the docs or a script that parses the public API schema if available.
- **Output:** A checklist or table: one row per API event type, with columns e.g. `event_type`, `handled_in_server_ts` (yes/no), `action` (map | ignore | N/A).

### 2. Handle every known type

- **Action:** For every event type in the canonical list, ensure `server.ts` has a dedicated branch that either **maps** it to the component protocol or **explicitly ignores** it (log only, no client message). No known API event type should fall through to the unmapped `else`.
- **Result:** The unmapped branch is only hit by (a) malformed messages (already handled in `catch` with Error to client) or (b) **unknown future** event types (new API additions we have not yet added to the canonical list and handled).

### 3. Regression test or release gate

- **Option A — Regression test:** A test (or fixture) that sends each known event type from the canonical list through the proxy and asserts it does **not** log "Unmapped upstream event" for that type (e.g. assert no WARN with that event type, or assert the handler was invoked). New API event types would be added to the fixture; if we forget to add a branch, the test fails.
- **Option B — Release checklist:** Before each release, a human or script diffs the canonical list against the set of `msg.type` values in `server.ts`; any event in the list without a branch is a release blocker until we add a branch or explicitly document “not sent in our usage.”
- **Option C — Both:** Canonical list + test for a subset (e.g. events we can safely replay) + checklist for the rest.

### 4. Unmapped = unknown future only

- **Definition:** After steps 1–3, the unmapped path is **defined** as: event types that are **not** in the canonical list (i.e. future or undocumented). Any event type that **is** in the canonical list must have a branch.
- **Logging:** When an event hits unmapped, we log **full payload** (truncated for safety) so we can (a) debug and (b) add the new type to the canonical list and implement a branch in the next release.
- **Docs:** In UPSTREAM-EVENT-COMPLETE-MAP.md, the “Unmapped upstream events” section states that only **unknown future** event types hit this path; all known API types are in the “Explicitly handled” table (or an “Explicitly ignored” list). No enumerated “examples that may still hit” except “unknown future.”

---

## Summary: order of work to reduce unmapped set

| Step | Action | Status |
|------|--------|--------|
| 1 | Create canonical list of OpenAI Realtime server event types (from API docs). | **Done:** `OPENAI-REALTIME-SERVER-EVENT-TYPES.ts` |
| 2 | For each type in the list, add a branch in `server.ts` (map or explicit ignore) if missing. | **Done:** All 38 types have a branch. |
| 3 | Update UPSTREAM-EVENT-COMPLETE-MAP.md: all known types in handled table; unmapped section says “unknown future only.” | **Done** |
| 4 | Add regression test or release checklist that fails if a known type has no branch. | **Done:** `tests/openai-proxy-event-coverage.test.ts` |
| 5 | Log full payload (truncated) in unmapped branch for debugging and adding new types. | **Done** |

---

## References

- **OpenAI Realtime server events:** https://platform.openai.com/docs/api-reference/realtime-server-events  
- **Canonical list:** `packages/voice-agent-backend/scripts/openai-proxy/OPENAI-REALTIME-SERVER-EVENT-TYPES.ts`  
- **Our handler list:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (upstream `on('message')`).  
- **Regression test:** `tests/openai-proxy-event-coverage.test.ts`  
- **Our map doc:** `packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md`.
