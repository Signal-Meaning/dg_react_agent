# Issue #571 — Tracking

Use this checklist while working [GitHub #571](https://github.com/Signal-Meaning/dg_react_agent/issues/571). Update checkboxes in the PR or here as work completes.

## TDD / implementation

- [x] **RED:** Failing test that sends a client message before upstream `open` and expects it on the upstream side after connect (attach-upgrade / `createOpenAIWss`).
- [x] **GREEN:** Queue + flush in `createOpenAIWss` (`packages/voice-agent-backend/src/attach-upgrade.js`), matching `createDeepgramWss` semantics (`data`, `isBinary`).
- [x] **REFACTOR:** Minimal change; `clientWs` close/error registered before upstream `open`; single `upstream.on('error')` for log + `clientWs.close()`.
- [x] **`npm test`** — `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js` and `tests/voice-agent-backend-attach-upgrade-upstream.test.ts` green.

## Review / close-out

- [x] PR [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572) merged; **#571** closed.
- [x] **Publish:** GitHub Release **[v0.11.1](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.11.1)** → CI [24249265463](https://github.com/Signal-Meaning/dg_react_agent/actions/runs/24249265463) → mergeback [#573](https://github.com/Signal-Meaning/dg_react_agent/pull/573) to **`main`** ([RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)).
- [ ] Optional: real-API integration / OpenAI E2E slice before or after publish per policy.
