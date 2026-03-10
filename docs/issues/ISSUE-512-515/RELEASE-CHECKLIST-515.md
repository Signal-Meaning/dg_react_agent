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
- [ ] **Lint:** `npm run lint` — passes
- [ ] **Unit / mock tests:** `npm run test:mock` — passes (CI uses this)
- [ ] **E2E in proxy mode:** From test-app: start backend, then `USE_PROXY_MODE=true npm run test:e2e` — all required E2E pass
- [ ] **Real-API integration (required for this release):** When `OPENAI_API_KEY` available: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — in-scope tests pass (see .cursorrules: proxy/API behavior releases must qualify against real API)
- [ ] **npm audit:** `npm audit --audit-level=high` — passes (required for CI)
- [ ] **Docs:** All relevant docs updated (UPSTREAM-EVENT-COMPLETE-MAP, PROTOCOL-SPECIFICATION, ISSUE-512-515 README/TDD plans)

---

## Version and release branch

- [ ] **Bump version (patch):** e.g. `npm version patch` (or set `vX.Y.Z` in root `package.json` and `packages/voice-agent-backend/package.json` if releasing backend)
- [ ] **Release branch:** Create `release/vX.Y.Z`, push (e.g. `npm run release:issue X.Y.Z patch` or manual branch + push)
- [ ] **Changelog:** In `docs/releases/vX.Y.Z/CHANGELOG.md` include fixes for #512, #513, #514, #517 (and any other changes in scope)
- [ ] **Release docs:** Create `docs/releases/vX.Y.Z/` per template (CHANGELOG, PACKAGE-STRUCTURE, etc.); run `npm run validate:release-docs vX.Y.Z`

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
