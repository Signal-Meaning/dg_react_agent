# Issue #540: Settings surface for `session` audio.output (Section 5.6)

**GitHub:** [#540](https://github.com/Signal-Meaning/dg_react_agent/issues/540)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 6)

Output-side session audio (`session.audio.output` in Realtime **RealtimeAudioConfig**) should be configurable via a stable **Settings** surface instead of ad hoc or rejected historical fields.

**Report note:** Proxy-owned **`session.audio.input`** (`turn_detection`, `format`, `transcription`) stays documented and defaulted in `mapSettingsToSessionUpdate` for #414 / #451; exposing **input** on Settings is a follow-up if needed, not Section 3 passthrough.

---

## Decision

- **`Settings.agent.sessionAudioOutput`** (camelCase, sibling of `think`) maps to **`session.audio.output`** after **`normalizeSessionAudioOutput`**.
- Allowed **`format.type`:** `audio/pcm` (optional `rate` only `24000` when present), `audio/pcmu`, `audio/pcma`. Other types dropped.
- **`speed`:** finite number in **[0.25, 1.5]** inclusive; otherwise omitted.
- **`voice`:** non-empty trimmed string, or object **`{ id: string }`** with non-empty trimmed `id`.
- **`AgentOptions.sessionAudioOutput`**, **`buildSettingsMessage`** (when `isOpenAIProxy`), and **`DeepgramVoiceInteraction`** pass the field through.
- **`session.audio.input`** is unchanged when output is set (merged onto existing `session.audio`).

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [x] Verified (real API default path; custom output mock-only — see below)

### RED

- [x] Unit: `sessionAudioOutput` → merged `session.audio` with stable `input` + expected `output`.
- [x] Unit: invalid fields dropped; no `output` key when nothing valid.

### GREEN

- [x] `normalizeSessionAudioOutput`, `mapSettingsToSessionUpdate`, types, builder, component.

### REFACTOR

- [x] Proxy README table (input vs output); PROTOCOL Settings row.

### Verified

- [x] Unit tests pass.
- [x] Mock integration: `tests/integration/openai-proxy-integration.test.ts` — `Issue #540: session.update includes audio.output from agent.sessionAudioOutput (mock upstream)`.
- [x] **Real API (default audio output path):** `USE_REAL_APIS=1` integration tests **Issue #414 real-API: firm audio connection** and **firm audio (speech-like)** exercise proxy → Realtime with default session audio (no custom `sessionAudioOutput` in Settings). **Custom** `agent.sessionAudioOutput` mapping remains **mock-only** until a dedicated live TTS/output assertion is added.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `OpenAIRealtimeSessionAudioOutput`, `normalizeSessionAudioOutput`, `mapSettingsToSessionUpdate`
- `src/types/agent.ts` — `SessionAudioOutputSettings`, `AgentSettingsMessage`, `AgentOptions`
- `src/utils/buildSettingsMessage.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`, `tests/integration/openai-proxy-integration.test.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`

**Canonical API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) → `audio` → **RealtimeAudioConfig** `output` (**RealtimeAudioConfigOutput**).
