# Issue #571 — current status

**Last updated:** 2026-04-10

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571) — **open** (close after fix merged and tests green)

**Branch:** `issue-571`

---

## Snapshot

| Area | State |
|------|--------|
| **Bug** | `createOpenAIWss` registers `clientWs.on('message')` only inside `upstream.on('open')`; frames sent before upstream is open are **dropped** (no queue). |
| **Impact** | Early **Settings** can be lost → translator never applies session → audio stuck in `pendingAudioQueue`; no agent response. |
| **Reference implementation** | `createDeepgramWss` in the same file (`attach-upgrade.js`) queues client → upstream until upstream is `OPEN`. |
| **Fix** | Not implemented yet — docs + branch only. |
| **Tests** | No failing/regression test for this relay race yet (add per TDD). |

---

## Acceptance criteria (from GitHub)

- [ ] Client → upstream messages sent before upstream `OPEN` are forwarded after upstream opens.
- [ ] Automated tests cover the relay path (extend `tests/voice-agent-backend-attach-upgrade-upstream.test.ts` or add focused tests).

---

## Next

See [NEXT-STEP.md](./NEXT-STEP.md).
