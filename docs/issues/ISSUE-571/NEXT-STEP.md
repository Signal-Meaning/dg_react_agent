# Issue #571 — next step

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571)

---

## Done (this slice)

Branch **`issue-571`** and in-repo docs under `docs/issues/ISSUE-571/` (README, TRACKING, CURRENT-STATUS, NEXT-STEP).

---

## Recommended follow-ups

1. **RED** — Add a Jest test that simulates `createOpenAIWss`: client sends a message while the upstream `WebSocket` is still connecting, then upstream fires `open`; assert the upstream received the payload after open (binary and text cases if both matter).
2. **GREEN** — In `packages/voice-agent-backend/src/attach-upgrade.js`, implement a client→upstream `messageQueue` + flush on `upstream.on('open')`, mirroring `createDeepgramWss`; register `clientWs.on('message')` immediately on connection. Revisit `close` / `error` handler attachment so a client disconnect during upstream connect is still handled cleanly.
3. **REFACTOR** — Keep duplication minimal vs Deepgram path; run `npm test` for affected packages / root.
4. **PR** — Open PR from `issue-571`, link #571 (`Fixes` or `Closes` as appropriate).
5. **Qualification** — If reviewers or release notes require it: proxy-mode E2E and/or integration per [.cursorrules](../../../.cursorrules) and release checklist for timing-sensitive relay changes.
6. **Close issue** — After merge, close #571 on GitHub and set [README.md](./README.md) status to **Closed** in a small doc commit if you keep issue folders in sync with GitHub.

---

## References

- [README.md](./README.md) — problem statement and file pointers.
- [TRACKING.md](./TRACKING.md) — checkbox TDD list.
