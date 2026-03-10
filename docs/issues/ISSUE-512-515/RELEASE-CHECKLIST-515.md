# Release checklist for #515 (patch: 512, 513, 514, 517)

**Use this checklist when the work on PR [#516](https://github.com/Signal-Meaning/dg_react_agent/pull/516) (issues #512, #513, #514, #517) has concluded and the patch release is ready.**  
**Release issue:** [#515](https://github.com/Signal-Meaning/dg_react_agent/issues/515)  
**Full template:** [.github/ISSUE_TEMPLATE/release-checklist.md](../../.github/ISSUE_TEMPLATE/release-checklist.md) — use for detailed steps; this doc is a focused list for this patch.

---

## Scope of this release

- **#512** — Unmapped upstream events → warnings only (no Error to client)
- **#513** — Release gate / test coverage for upstream event types
- **#514** — No retries when function call succeeds
- **#517** — Root cause of unmapped events (explicit handling for `conversation.created`, `conversation.item.input_audio_transcription.failed` / `.segment`)

---

## Pre-release preparation

- [ ] **Code review:** PR #516 (and any follow-up PRs) merged; code reviewed
- [x] **Lint:** `npm run lint` — passes
- [x] **Unit / mock tests:** `npm run test:mock` — passes (CI uses this)
- [x] **E2E in proxy mode:** From test-app: start backend, then `USE_PROXY_MODE=true npm run test:e2e` — passed (one @flaky TTS diagnostic test failed as expected; marked @flaky, deal with later)
- [x] **Real-API integration (required for this release):** When `OPENAI_API_KEY` available: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — in-scope tests pass. Issue #480 test fixed: ignore JSON parse failures in WS handler (binary PCM frames can start with 0x7b).
- [x] **#513 Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts` — passes (all canonical event types have handler); no new unmapped event types introduced (review logs if staging ran).
- [x] **npm audit:** `npm audit --audit-level=high` — passes (required for CI)
- [x] **Docs:** All relevant docs updated (UPSTREAM-EVENT-COMPLETE-MAP, PROTOCOL-SPECIFICATION, ISSUE-512-515 README/TDD plans)

---

## Version and release branch

- [ ] **Bump version (patch):** e.g. `npm version patch` (or set `vX.Y.Z` in root `package.json` and `packages/voice-agent-backend/package.json` if releasing backend). Suggested: **v0.10.2** (current 0.10.1).
- [ ] **Release branch:** Create `release/v0.10.2`, push (e.g. `npm run release:issue 0.10.2 patch` or manual branch + push). Typically from main after PR #516 is merged.
- [x] **Changelog:** In `docs/releases/v0.10.2/CHANGELOG.md` include fixes for #512, #513, #514, #517 (and any other changes in scope)
- [x] **Release docs:** Create `docs/releases/v0.10.2/` (CHANGELOG.md, RELEASE-NOTES.md); run `npm run validate:release-docs 0.10.2` — passes

---

## Publish and release

- [ ] **GitHub release:** Create release with tag `vX.Y.Z` to trigger CI (version must already be bumped and committed on release branch)
- [ ] **CI:** Test job passes (lint, test:mock, build, package validation); publish job runs and publishes to GitHub Package Registry
- [ ] **Tag:** After publish succeeds, ensure tag `vX.Y.Z` exists and is pushed
- [ ] **Verify install:** Test install from registry at `@signal-meaning/voice-agent-react@vX.Y.Z` (and backend if released)

---

## Post-release

- [ ] **Merge to main:** Open PR `release/vX.Y.Z` → `main`, merge via PR (do not push directly to main)
- [ ] **Notify:** Update voice-commerce / consumers as needed; update external docs if any
- [ ] **Close issues:** #512, #513, #514, #515, #517 closed or linked to release

---

## Quick command reference

| Step | Command |
|------|--------|
| Lint | `npm run lint` |
| Mock tests | `npm run test:mock` |
| E2E (from test-app) | `cd test-app && npm run backend` (then) `USE_PROXY_MODE=true npm run test:e2e` |
| Real-API integration | `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` |
| Audit | `npm audit --audit-level=high` |
| Version bump | `npm version patch` |
| Release docs validation | `npm run validate:release-docs vX.Y.Z` |
