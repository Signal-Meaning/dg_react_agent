# Issue #571 — current status

**Last updated:** 2026-04-10

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571) — **closed** (merged with [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572))

**Branches:** **`main`** — fix + test; **`release/v0.11.1`** — **0.11.1** / **0.2.13** + `docs/releases/v0.11.1/` for npm publish

---

## Snapshot

| Area | State |
|------|--------|
| **Bug (historical)** | `createOpenAIWss` used to register `clientWs.on('message')` only inside `upstream.on('open')`; frames sent before upstream was open were **dropped**. |
| **Impact** | Early **Settings** could be lost → translator never applies session → audio stuck in `pendingAudioQueue`; no agent response. |
| **Reference implementation** | `createDeepgramWss` in the same file (`attach-upgrade.js`) queues client → upstream until upstream is `OPEN`. |
| **Fix** | **On `main` (PR #572):** client→upstream `messageQueue`, immediate `clientWs.on('message')`, flush on `upstream.on('open')`; early `clientWs` close/error tears down upstream (`CONNECTING` \| `OPEN`). |
| **Tests** | `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js` — delayed upstream `verifyClient` so client sends while relay→upstream is still held. |

---

## Acceptance criteria (from GitHub)

- [x] Client → upstream messages sent before upstream `OPEN` are forwarded after upstream opens.
- [x] Automated tests cover the relay path (new `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js`).

---

## Next

See [NEXT-STEP.md](./NEXT-STEP.md). For the **0.11.1 / 0.2.13** patch, use [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md).
