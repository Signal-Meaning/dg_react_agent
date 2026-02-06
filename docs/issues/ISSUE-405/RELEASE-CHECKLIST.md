# Release Checklist – Issue #405

**Release v0.7.17** – patch release. Purpose: **Include the `tests/` folder in the published npm package** so customers receive Jest unit/integration tests with the package. No breaking changes.

**GitHub issue:** [Issue #405](https://github.com/Signal-Meaning/dg_react_agent/issues/405)

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm test` — all pass (76 suites, 813 tests)
  - [ ] **E2E in proxy mode** (skipped for this release)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `cd test-app && USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Confirm 0 failures (or document any authorized skips)
- [x] **Lint clean**
  - [x] Run: `npm run lint` — 0 errors

---

## Version & build

- [x] **Bump version to v0.7.17**
  - [x] Run: `npm version patch --no-git-tag-version`
- [x] **Build** (optional locally; CI builds on release)
  - [x] Do not run build/package locally for release; CI builds when GitHub release is created.

---

## Documentation

- [x] **Create release docs before publishing**
  - [x] Create: `docs/releases/v0.7.17/`
  - [x] Create: `CHANGELOG.md` (Keep a Changelog format; lead with Issue #405 – include `tests/` in published package)
  - [x] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md` (replace vX.X.X / X.X.X with v0.7.17 / 0.7.17)
  - [x] Create: `RELEASE-NOTES.md` (optional but standard)
- [x] **Validate release docs**
  - [x] Run: `npm run validate:release-docs 0.7.17` — passed
- [x] **Update version** references in docs
- [x] **Do not proceed to Release until docs are complete**

---

## Release

- [x] **Commit release prep**
  - [x] `git add . && git commit -m "chore: prepare release v0.7.17"`
- [x] **Release branch**
  - [x] Create: `git checkout -b release/v0.7.17` (from current branch or main)
  - [x] Push: `git push origin release/v0.7.17`
- [x] **Publish**
  - [x] Create GitHub release to trigger CI (`.github/workflows/test-and-publish.yml`) — [v0.7.17](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.17)
  - [x] Monitor Actions until workflow succeeds; confirm package in GitHub Packages
  - [x] Tag created with release
- [x] **Tag release**
  - [x] Verify package published to GitHub Packages (CI completed successfully)
  - [x] Tag: `v0.7.17` (created with GitHub release)
  - [x] Push: tag pushed with release
- [x] **GitHub release**
  - [x] Title: `v0.7.17`; description from CHANGELOG.md; target `release/v0.7.17`
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.17` → `main` (e.g. via PR)
  - [ ] Push: `git push origin main`

---

## Completion criteria

- [x] Package published to GitHub Package Registry (CI workflow completed)
- [x] GitHub release created — [v0.7.17](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.17)
- [x] CHANGELOG.md updated (include tests in package for v0.7.17)
- [x] All tests passing

---

## Important notes

- **Purpose:** Issue #405 – Include `tests/` in published npm package so customers receive Jest unit/integration tests.
- **Change:** `package.json` `files` array includes `"tests"` (root-level tests folder).
- **Version:** v0.7.17 (patch). No breaking changes.
- Package publishes to **GitHub Package Registry**.
