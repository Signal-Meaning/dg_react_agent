# Issue #433: TDD plan — Enforce “no send until channel ready”

**Parent:** [GitHub Issue #433](https://github.com/Signal-Meaning/dg_react_agent/issues/433)

---

## Overview

This document is the **Test-Driven Development** plan for enforcing that the component does not send user messages (text or audio) to the backend until the channel has reported ready (SettingsApplied for Deepgram, session.created for OpenAI). All work follows the project rule: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:** The component provides a single, provider-agnostic guarantee: we do not send any user message on the wire until we have received the readiness event and invoked `onSettingsApplied`. If the app triggers a send before ready, the component either **queues** the message and sends when ready, or **rejects/blocks** until ready (documented so apps can retry or wait).

---

## Requirement (from defect report)

| # | Item | Description |
|---|------|-------------|
| 1 | Readiness reporting | Invoke `onSettingsApplied` when channel is ready (Deepgram: SettingsApplied; OpenAI: session.created). **Already done** (Issue #428 / v0.8.2). |
| 2 | **Enforcement** | No user message (text or audio) may be sent to the backend until the channel has reported ready. If send is requested before ready: **preferred** — queue and send when ready; **alternative** — reject/block until ready (document behavior). |

---

## Current state (baseline)

- **Readiness state:** `hasSentSettingsRef`, `state.hasSentSettings`, and `windowWithGlobals.globalSettingsSent` are set when the component receives **SettingsApplied** or **session.created** (Issue #428). That is the internal “channel ready” signal.
- **Text path (`injectUserMessage`):** Calls `waitForSettings()` when connecting, but if settings are still not sent after waiting it **logs a warning and proceeds** (“Don’t throw error - let it proceed”). So a user message can be sent before the channel has actually reported ready.
- **Audio path (`sendAudioData`):** Checks `hasSentSettingsRef.current` and can log “Cannot send audio data before settings are sent” and skip in some paths; behavior may still allow audio to be sent in other code paths or before readiness in edge cases. Needs to be made consistent: **no** audio on the wire until ready.
- **Contract today:** The component **reports** readiness via `onSettingsApplied` but does **not enforce** that sends only happen after ready; it relies on the app to wait. Sending before ready can cause Deepgram to close with code 1005 (and similar issues for OpenAI).

---

## Phase 1: Unit tests — “send before ready” behavior

**Goal:** Tests define the contract: when a send (text or audio) is requested before the channel is ready, the component either queues and sends when ready, or rejects/blocks. No message reaches the WebSocket before readiness.

### 1.1 RED — Text path: injectUserMessage before ready

**Location:** e.g. `tests/inject-user-message-before-ready.test.tsx` or extend `tests/on-settings-applied-callback.test.tsx` / existing inject tests.

1. **Write failing tests** that:
   - Render the component with mocked WebSocketManager and AudioManager; do **not** simulate SettingsApplied or session.created (so “channel ready” never becomes true).
   - Call `injectUserMessage('hello')` (after connection is established, but before any readiness event).
   - **Preferred (queue) contract:** Assert that the InjectUserMessage is **not** sent on the WebSocket until after the test later simulates SettingsApplied (or session.created); then assert it **is** sent exactly once after readiness.
   - **Alternative (block) contract:** Assert that `injectUserMessage` rejects or returns in a way that indicates “not ready” (e.g. throws or returns a rejected promise), and that no InjectUserMessage is sent on the WebSocket.
2. Run tests → **RED** (current behavior: message may be sent after wait timeout without readiness).

### 1.2 RED — Audio path: sendAudioData before ready

**Location:** e.g. `tests/send-audio-before-ready.test.tsx` or extend existing audio/agent tests.

1. **Write failing tests** that:
   - Render the component; connect; do **not** simulate SettingsApplied/session.created.
   - Trigger the audio send path (e.g. feed data that would normally go to `sendAudioData` or the agent service).
   - Assert that **no** audio (or user-message) frame is sent to the WebSocket until after the test simulates SettingsApplied/session.created. If the implementation queues: after simulating readiness, assert exactly the expected audio/message is sent.
2. Run tests → **RED** (current behavior may allow some audio or message to be sent before ready).

### 1.3 GREEN — Implementation (text and audio)

1. **Text path:** In `injectUserMessage`, after connection and any existing wait:
   - If “channel ready” is false (e.g. `!hasSentSettingsRef.current && !globalSettingsSent`), either:
     - **Queue:** Store the message and send it when the agent message handler receives SettingsApplied/session.created (and invoke a single “drain” of the queue at that point), or
     - **Block:** Reject the promise (or return a documented “not ready” result) and do not call the agent manager’s inject/send. Document which behavior is chosen.
   - Ensure no InjectUserMessage is written to the WebSocket until readiness has been confirmed.
2. **Audio path:** In `sendAudioData` (and any other path that sends user audio to the agent):
   - If not ready, either queue the audio and flush when ready, or drop/block and do not send. Align with the chosen contract (queue vs block). Ensure no audio is sent on the wire before readiness.
3. Run tests → **GREEN**.

### 1.4 REFACTOR

- Extract “is channel ready” into a single helper (e.g. `isChannelReady()`) used by both text and audio paths.
- Ensure all send paths (text inject, audio, and any other user-message paths) go through the same gate.
- Update JSDoc or types to document “no send until ready” and whether the component queues or blocks.

**Deliverables:** Unit tests passing; no user message (text or audio) sent before readiness; behavior (queue vs block) documented.

---

## Phase 2: Integration / WebSocket-level tests

**Goal:** Assert at the WebSocket boundary that no user message (InjectUserMessage or audio) is ever sent before a readiness event has been received.

### 2.1 RED — WebSocket capture tests

**Location:** e.g. `tests/integration/no-send-until-ready.test.tsx` or extend `tests/on-settings-applied-callback.test.tsx` with WebSocket capture.

1. **Write failing tests** that:
   - Use a mock or capture layer on the WebSocket (e.g. `installWebSocketCapture()` or equivalent) to record all messages sent by the component.
   - Start the component; connect; **without** sending SettingsApplied/session.created, trigger `injectUserMessage('test')` (and optionally trigger audio send).
   - Assert that **no** InjectUserMessage (and no user audio message) appears in the sent messages before the test simulates SettingsApplied/session.created.
   - After simulating SettingsApplied/session.created, assert that the queued or retried message (if queue contract) appears exactly once, or that no message was sent (if block contract and no retry).
2. Run tests → **RED** if any user message is sent before readiness.

### 2.2 GREEN — Verify implementation

1. Ensure Phase 1 implementation is used by the component’s real WebSocket path; no bypass (e.g. direct agent manager call that skips the ready check).
2. Run tests → **GREEN**.

### 2.3 REFACTOR

- Remove or relax any “wait then send anyway” logic that could still allow a send before ready under race conditions.

**Deliverables:** Integration tests passing; WebSocket capture confirms no user message before readiness.

---

## Phase 3: Regression and existing tests

**Goal:** All existing tests that rely on injectUserMessage, audio send, or onSettingsApplied continue to pass. No regression in E2E or partner flows.

### 3.1 RED — Run full suite

1. Run existing unit tests (e.g. `on-settings-applied-callback`, injectUserMessage, backend proxy, connection mode).
2. Run mock-only integration tests.
3. Optionally run E2E (test-app) where applicable.
4. Identify any test that assumed “send may happen before ready” or that needs to be updated to wait for `onSettingsApplied` before triggering send.

### 3.2 GREEN — Adjust tests or implementation

1. Update tests that need to wait for readiness before calling injectUserMessage (or that need to expect a rejection when calling before ready, if block contract).
2. Fix any regression in implementation (e.g. ensure greeting or other flows that send after ready still work).
3. Run full suite → **GREEN**.

### 3.3 REFACTOR

- Document in README or migration guide: “The component does not send user messages until the channel is ready; if your app calls injectUserMessage before onSettingsApplied, the component will [queue | reject] as documented.”

**Deliverables:** Full test suite green; docs updated.

---

## Phase summary

| Phase | Focus | Key tests (RED first) | Deliverable |
|-------|--------|------------------------|-------------|
| 1 | Unit: send before ready | injectUserMessage and sendAudioData before SettingsApplied/session.created; assert queue or block | No text/audio on wire before ready; queue or block implemented |
| 2 | Integration: WebSocket boundary | Capture sent messages; assert no user message before readiness event | WebSocket-level guarantee verified |
| 3 | Regression | Existing unit, integration, E2E | All tests pass; docs updated |

---

## TDD rules (reminder)

- **RED:** Write failing tests that define the desired behavior before implementation.
- **GREEN:** Implement the minimum necessary to make those tests pass.
- **REFACTOR:** Improve structure and docs while keeping tests green.
- **No implementation** of new enforcement logic without tests first.

---

## Decision: queue vs block

Before or during Phase 1, the team must choose:

- **Queue:** When send is requested before ready, store the message (and optionally audio chunks) and send as soon as SettingsApplied/session.created is received. Simpler for apps (no retry logic). Slightly more complex inside the component (queue + drain).
- **Block:** When send is requested before ready, reject (throw or return rejected promise) and do not send. App must wait for `onSettingsApplied` and retry. Simpler component; app must implement wait/retry.

The TDD plan above supports either; tests in 1.1 and 1.2 should be written to match the chosen contract.

---

## Progress tracking

| Phase | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 1. Unit (text + audio) | — | — | — |
| 2. Integration (WebSocket) | — | — | — |
| 3. Regression & docs | — | — | — |

---

## References

- [GitHub Issue #433](https://github.com/Signal-Meaning/dg_react_agent/issues/433) — Enforce no user message until channel ready.
- Issue #428 — onSettingsApplied when session.created (readiness reporting for OpenAI).
- `src/components/DeepgramVoiceInteraction/index.tsx` — `injectUserMessage`, `sendAudioData`, `hasSentSettingsRef`, handler for SettingsApplied/session.created.
- `src/utils/component-helpers.ts` — `hasSettingsBeenSent`, `waitForSettings`.
