# Issue #571 — next step

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571)

---

## Done (this slice)

- Branch **`issue-571`** and docs under `docs/issues/ISSUE-571/`.
- **TDD:** `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js` (delayed upstream `verifyClient` + `upstreamVerifyInvoked` so the client send races ahead of `cb(true)`).
- **Implementation:** `packages/voice-agent-backend/src/attach-upgrade.js` — `createOpenAIWss` queues client→upstream until `upstream` is `OPEN`, mirrors Deepgram pattern; teardown if client disconnects while upstream is still connecting.

---

## Recommended follow-ups

1. **PR** — **[#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572)** (`issue-571` → `main`, **Closes #571**). Review and merge.
2. **Patch release** — After merge, follow [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md): **v0.11.1** + **@signal-meaning/voice-agent-backend 0.2.13** (or document a backend-only exception on #571 per [PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md)).
3. **Qualification** — Real-API integration and/or OpenAI proxy E2E slice when qualifying relay timing (see checklist and [.cursorrules](../../../.cursorrules)).
4. **Close issue** — After merge and publish, close #571 on GitHub and set [README.md](./README.md) / [CURRENT-STATUS.md](./CURRENT-STATUS.md) to **Closed** in a small doc commit if you keep issue folders in sync with GitHub.

---

## References

- [README.md](./README.md) — problem statement and file pointers.
- [TRACKING.md](./TRACKING.md) — checkbox TDD list.
