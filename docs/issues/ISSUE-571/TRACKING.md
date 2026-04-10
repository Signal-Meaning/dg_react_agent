# Issue #571 — Tracking

Use this checklist while working [GitHub #571](https://github.com/Signal-Meaning/dg_react_agent/issues/571). Update checkboxes in the PR or here as work completes.

## TDD / implementation

- [ ] **RED:** Failing test that sends a client message before upstream `open` and expects it on the upstream side after connect (attach-upgrade / `createOpenAIWss`).
- [ ] **GREEN:** Queue + flush in `createOpenAIWss` (`packages/voice-agent-backend/src/attach-upgrade.js`), matching `createDeepgramWss` semantics (`data`, `isBinary`).
- [ ] **REFACTOR:** Share small helper or keep duplication minimal per existing style; ensure `close`/`error` paths remain correct if handlers move outside `upstream.on('open')`.
- [ ] All relevant **`npm test`** (voice-agent-backend / root Jest) green locally.

## Review / close-out

- [ ] PR links **#571** (closes or fixes).
- [ ] If release-worthy: version/changelog per package maintainer process; run any required real-API qualification for proxy changes.
