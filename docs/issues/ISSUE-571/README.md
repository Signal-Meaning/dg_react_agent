# Issue #571 — OpenAI relay drops pre-upstream-open client messages

**Status:** Open — implementation on branch **`issue-571`**.

**GitHub:** [#571 — OpenAI relay (createOpenAIWss) drops client messages until upstream opens — queue like Deepgram path](https://github.com/Signal-Meaning/dg_react_agent/issues/571)

**Branch:** `issue-571`

---

## Problem

In `@signal-meaning/voice-agent-backend`, `createOpenAIWss` (`packages/voice-agent-backend/src/attach-upgrade.js`) registers `clientWs.on('message')` only inside `upstream.on('open')`. The browser’s WebSocket is already open after the Express upgrade, so the client may send **Settings** (and other frames) while the upstream socket to the translator (e.g. `ws://127.0.0.1:3011/...`) is still connecting. Those frames have **no listener** yet and are **dropped**; there is no queue.

## Why responses never arrive

The translator (`scripts/openai-proxy/server.ts`) expects Settings to drive `session.update` to OpenAI. If Settings never arrives, `hasSentSettingsApplied` stays false and binary audio is held in `pendingAudioQueue` indefinitely. The user sees no agent audio or completion.

## Contrast

- **`createDeepgramWss`** (same file): registers `clientWs.on('message')` immediately and pushes to `messageQueue` until `deepgramWs` is `OPEN`, then drains on `open`.
- **Translator `server.ts`**: registers `(clientWs).on('message', …)` in the connection path immediately and uses `clientMessageQueue` when upstream is not open.

Direct test-app → translator connections avoid the relay race; **browser → backend forwarder → translator** does not.

## Proposed fix

Mirror the Deepgram pattern in `createOpenAIWss`:

1. Register `clientWs.on('message')` as soon as the client connection is accepted.
2. If `upstream.readyState !== WebSocket.OPEN`, push `{ data, isBinary }` to a queue.
3. On `upstream.on('open')`, flush the queue to `upstream.send`, then keep piping as today.

Also consider registering **close / error** handlers in a way that does not depend solely on `upstream.on('open')` (so client disconnect during connect is still handled); align with whatever minimal behavior Deepgram path uses after review.

## Acceptance (from GitHub #571)

- Client → upstream messages sent before upstream `OPEN` are forwarded after upstream opens.
- Automated tests cover the relay path so this cannot regress (extend `tests/voice-agent-backend-attach-upgrade-upstream.test.ts` or add focused tests).

## References

| Location | Notes |
|----------|--------|
| `packages/voice-agent-backend/src/attach-upgrade.js` | `createOpenAIWss` (~L182–206), `createDeepgramWss` (~L57–175) |
| `packages/voice-agent-backend/scripts/openai-proxy/server.ts` | Immediate client `message` handler; `clientMessageQueue`; `hasSentSettingsApplied` / `pendingAudioQueue` |
| [docs/issues/ISSUE-522/FINDINGS.md](../ISSUE-522/FINDINGS.md) | Hypothesis **F1** (forwarder drops/reorders) — #571 is a concrete instance for early Settings |

## Release / qualification

If the fix ships in a release that touches proxy relay behavior, follow [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md) and project rules: run relevant integration/E2E with mocks in CI; use real APIs where the change affects ordering or timing.

---

## Local docs

| Doc | Purpose |
|-----|---------|
| [CURRENT-STATUS.md](./CURRENT-STATUS.md) | Snapshot and acceptance checkboxes. |
| [NEXT-STEP.md](./NEXT-STEP.md) | Ordered follow-ups (TDD, PR, close-out). |
| [TRACKING.md](./TRACKING.md) | Checklist while implementing #571. |
