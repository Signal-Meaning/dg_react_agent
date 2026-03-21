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

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED (documentation-driven tests)

- [ ] Component/hook tests: two `SettingsApplied` in a row → no throw, no double teardown / double timer arm, idempotent config.
- [ ] Proxy integration: any incorrect handling of duplicate `SettingsApplied` covered by new or existing failing test.

### GREEN

- [ ] Fix non-idempotent handlers found above.
- [ ] Add **client → upstream** event matrix (`REALTIME-CLIENT-EVENT-MATRIX.md` or sibling to [UPSTREAM-EVENT-COMPLETE-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md)): event name, supported Y/N, component equivalent, notes.
- [ ] Extend [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md): who sends `response.create`, proxy-managed vs host-visible knobs.

### REFACTOR

- [ ] Cross-link matrix from [COMPONENT-PROXY-CONTRACT.md](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md).

### Verified

- [ ] Idempotence tests pass.
- [ ] Docs reviewed; aligned with `.cursorrules` qualification expectations.
- [ ] Spot-check `DeepgramVoiceInteraction` / idle-timeout hooks for single-`SettingsApplied` assumptions.

---

## Files (expected touch set)

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — reference only unless bugs found
- `src/components/DeepgramVoiceInteraction/` — idempotence fixes if needed
- `src/hooks/` — idle timeout / settings applied coupling
- `docs/` or `packages/.../openai-proxy/*.md` — event matrix + lifecycle narrative
- `tests/` — component + integration tests as needed
