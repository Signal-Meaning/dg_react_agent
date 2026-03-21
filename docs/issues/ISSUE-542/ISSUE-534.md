# Issue #534: Queue `InjectUserMessage` until session ready

**GitHub:** [#534](https://github.com/Signal-Meaning/dg_react_agent/issues/534)

**Epic:** [#542](./README.md) · **TDD bundle:** B (ordering / protocol) with [#532](./ISSUE-532.md)

**Implementation:** Proxy queues full `InjectUserMessage` JSON frames in `pendingInjectTextQueue` when `!hasSentSettingsApplied` (same gate as binary audio). On upstream `session.updated`, `flushPendingInjectMessages()` runs **before** `flushPendingAudio()`. No separate React-only enforcement in this change (optional follow-up).

---

## Problem (Section 4)

`InjectUserMessage` was translated and `upstream.send` ran **immediately** (`server.ts`). Binary PCM was **queued** until `session.updated`. User text could arrive **before** the first `session.update` from `Settings` was applied upstream — a race the audio path did not have.

---

## Expected

Either:

- **Queue** `InjectUserMessage` until session is configured (mirror audio: flush after first successful `SettingsApplied` / `session.updated` handling), **or**
- Strict contract: document that clients must not inject until `SettingsApplied` **and** enforce in `@signal-meaning/voice-agent-react` (assert + dev warning).

Deepgram-native path: not applicable in the same form (OpenAI Realtime only).

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (all items below)

### RED

- [x] Integration: `InjectUserMessage` before `Settings` or before upstream `session.updated`; assert no `conversation.item.create` until session ready (same gate as audio queue), **or** assert upstream order is always `session.update` before inject-derived item create.
- [x] Confirm failing on current code (immediate forward). _(Covered by new test vs prior behavior.)_

### GREEN

- [x] Queue injects when not ready (`pendingInjectTextQueue`); flush on `session.updated` before `flushPendingAudio`.
- [x] Preserve `mapInjectUserMessageToConversationItemCreate` + `pendingItemAddedBeforeResponseCreate` behavior after flush.
- [ ] If **component-only** path: React tests for early-inject rejection; still recommend proxy queue for defense in depth. _(Deferred.)_

### REFACTOR

- [x] Single readiness gate: `hasSentSettingsApplied` (set on `session.updated`) shared by audio and inject queues.

### Verified

- [x] Integration test passes (`Issue #534: InjectUserMessage before Settings…`; full mock `openai-proxy-integration` suite).
- [ ] **Real API:** `USE_REAL_APIS=1` inject timing scenario when combined with Section 2 qualification.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — `forwardClientMessage`, `flushPendingInjectMessages`, `flushPendingAudio`, `session.updated` handler
- `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` — inject queue vs client obligation
- `tests/integration/openai-proxy-integration.test.ts`
- Optionally `src/components/DeepgramVoiceInteraction/` + tests if strict client contract is added later
