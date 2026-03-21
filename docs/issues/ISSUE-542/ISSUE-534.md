# Issue #534: Queue `InjectUserMessage` until session ready

**GitHub:** [#534](https://github.com/Signal-Meaning/dg_react_agent/issues/534)

**Epic:** [#542](./README.md) · **TDD bundle:** B (ordering / protocol) with [#532](./ISSUE-532.md)

---

## Problem (Section 4)

`InjectUserMessage` is translated and `upstream.send` runs **immediately** (`server.ts`). Binary PCM is **queued** until `session.updated` / `SettingsApplied` semantics. User text can therefore arrive **before** the first `session.update` from `Settings` is applied upstream — a race the audio path does not have.

---

## Expected

Either:

- **Queue** `InjectUserMessage` until session is configured (mirror audio: flush after first successful `SettingsApplied` / `session.updated` handling), **or**
- Strict contract: document that clients must not inject until `SettingsApplied` **and** enforce in `@signal-meaning/voice-agent-react` (assert + dev warning).

Deepgram-native path: not applicable in the same form (OpenAI Realtime only).

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Integration: `InjectUserMessage` before `Settings` or before upstream `session.updated`; assert no `conversation.item.create` until session ready (same gate as audio queue), **or** assert upstream order is always `session.update` before inject-derived item create.
- [ ] Confirm failing on current code (immediate forward).

### GREEN

- [ ] Queue injects when not ready (`pendingInjectQueue` or equivalent); flush on shared session-ready path with `pendingAudioQueue`.
- [ ] Preserve `mapInjectUserMessageToConversationItemCreate` + `pendingItemAddedBeforeResponseCreate` behavior after flush.
- [ ] If **component-only** path: React tests for early-inject rejection; still recommend proxy queue for defense in depth.

### REFACTOR

- [ ] Single “session ready” predicate shared by audio and inject queues.

### Verified

- [ ] Integration test passes.
- [ ] **Real API:** `USE_REAL_APIS=1` inject timing scenario when combined with Section 2 qualification.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — `forwardClientMessage`, `flushPendingAudio`, `session.updated` handler
- `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` — document inject queue vs client obligation
- `tests/integration/openai-proxy-integration.test.ts`
- Optionally `src/components/DeepgramVoiceInteraction/` + tests if strict client contract is part of the fix
