# Issue #541: Lifecycle gaps — audit Realtime client events; `SettingsApplied` idempotence (Section 6)

**GitHub:** [#541](https://github.com/Signal-Meaning/dg_react_agent/issues/541)

**Epic:** [#542](./README.md) · **TDD bundle:** E (lifecycle / docs); overlaps **implementation** on [#533](./ISSUE-533.md) and [#534](./ISSUE-534.md)

---

## Scope (Section 6)

GitHub splits this as:

1. **Items 1–2:** Passthrough (#533) and `InjectUserMessage` race (#534) — track implementation there; this issue owns **audit + documentation** of gaps.

2. **Other Realtime client events:** Proxy today maps a small component set plus binary → `input_audio_buffer.append` and internal `response.create` / commit scheduling. OpenAI documents additional client events (`response.cancel`, `conversation.item.truncate`, buffer clear, etc.). **Action:** Produce a matrix: OpenAI client event → supported component message / intentionally omitted / requires passthrough today.

3. **Turn / `response.create` lifecycle:** Document which knobs are proxy-managed vs host-visible (including deferral after `function_call_output`).

4. **`SettingsApplied` idempotence (report Section 7 checklist item 6):** Multiple upstream `session.updated` → multiple `SettingsApplied` is **valid**. React layer and docs must not assume exactly one `SettingsApplied` per `Settings` for one-shot side effects or error paths.

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (spot-check + review below)

### RED (documentation-driven tests)

- [x] Component test: second `SettingsApplied` after queued `injectUserMessage` must not send **`InjectUserMessage`** twice (`tests/settings-applied-idempotence-issue541.test.tsx`).
- [x] Existing coverage: multiple `onSettingsApplied` invocations (`tests/on-settings-applied-callback.test.tsx`).

### GREEN

- [x] No code change required for inject queue (already idempotent).
- [x] **client → upstream** matrix: [REALTIME-CLIENT-EVENT-MATRIX.md](../../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-CLIENT-EVENT-MATRIX.md) (includes `response.create` lifecycle summary).
- [x] [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md): link to matrix (§0 See also).

### REFACTOR

- [x] Cross-link matrix from [COMPONENT-PROXY-CONTRACT.md](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md).

### Verified

- [x] `npm test -- tests/settings-applied-idempotence-issue541.test.tsx` passes.
- [ ] Docs reviewed on release; aligned with `.cursorrules` qualification expectations.
- [ ] Spot-check `DeepgramVoiceInteraction` / idle-timeout hooks for single-`SettingsApplied` assumptions (manual / follow-up).

---

## Files (expected touch set)

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — reference only unless bugs found
- `src/components/DeepgramVoiceInteraction/` — idempotence fixes if needed (none for inject queue)
- `src/hooks/` — idle timeout / settings applied coupling
- `packages/voice-agent-backend/scripts/openai-proxy/REALTIME-CLIENT-EVENT-MATRIX.md` — client event matrix
- `tests/settings-applied-idempotence-issue541.test.tsx` — duplicate SettingsApplied + inject queue
- `docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md` — cross-links
