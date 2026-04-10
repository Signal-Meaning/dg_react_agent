# Issue #571 — next step

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571)

---

## Done (this slice)

- Branch **`issue-571`** and docs under `docs/issues/ISSUE-571/`.
- **TDD:** `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js` (delayed upstream `verifyClient` + `upstreamVerifyInvoked` so the client send races ahead of `cb(true)`).
- **Implementation:** `packages/voice-agent-backend/src/attach-upgrade.js` — `createOpenAIWss` queues client→upstream until `upstream` is `OPEN`, mirrors Deepgram pattern; teardown if client disconnects while upstream is still connecting.

---

## Recommended follow-ups

1. **PR** — Open PR from `issue-571`, link #571 (`Fixes` / `Closes` as appropriate).
2. **Qualification** — If the release touches relay timing: proxy-mode E2E and/or integration per [.cursorrules](../../../.cursorrules) and the release checklist.
3. **Close issue** — After merge, close #571 on GitHub and set [README.md](./README.md) / [CURRENT-STATUS.md](./CURRENT-STATUS.md) to **Closed** in a small doc commit if you keep issue folders in sync with GitHub.

---

## References

- [README.md](./README.md) — problem statement and file pointers.
- [TRACKING.md](./TRACKING.md) — checkbox TDD list.
