# Issue #571 — Tracking

Use this checklist while working [GitHub #571](https://github.com/Signal-Meaning/dg_react_agent/issues/571). Update checkboxes in the PR or here as work completes.

## TDD / implementation

- [x] **RED:** Failing test that sends a client message before upstream `open` and expects it on the upstream side after connect (attach-upgrade / `createOpenAIWss`).
- [x] **GREEN:** Queue + flush in `createOpenAIWss` (`packages/voice-agent-backend/src/attach-upgrade.js`), matching `createDeepgramWss` semantics (`data`, `isBinary`).
- [x] **REFACTOR:** Minimal change; `clientWs` close/error registered before upstream `open`; single `upstream.on('error')` for log + `clientWs.close()`.
- [x] **`npm test`** — `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js` and `tests/voice-agent-backend-attach-upgrade-upstream.test.ts` green.

## Review / close-out

- [ ] PR links **#571** (closes or fixes).
- [ ] If release-worthy: version/changelog per package maintainer process; run any required real-API qualification for proxy changes.
