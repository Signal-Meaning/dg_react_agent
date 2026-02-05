# Release Checklist – Issue #405

**Release v0.7.17** – patch release. Purpose: **Include the `tests/` folder in the published npm package** so customers receive Jest unit/integration tests with the package. No breaking changes.

**GitHub issue:** [Issue #405](https://github.com/Signal-Meaning/dg_react_agent/issues/405)

---

## Pre-Release

- [ ] **Tests passing**
  - [ ] Run: `npm test` — all pass
  - [ ] **E2E in proxy mode** (recommended)
    - [ ] Start proxy: `cd test-app && npm run test:proxy:server`
    - [ ] Run: `cd test-app && USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Confirm 0 failures (or document any authorized skips)
- [ ] **Lint clean**
  - [ ] Run: `npm run lint` — 0 errors

---

## Version & build

- [ ] **Bump version to v0.7.17**
  - [ ] Run: `npm version patch --no-git-tag-version`
- [ ] **Build** (optional locally; CI builds on release)
  - [ ] Do not run build/package locally for release; CI builds when GitHub release is created.

---

## Documentation

- [ ] **Create release docs before publishing**
  - [ ] Create: `docs/releases/v0.7.17/`
  - [ ] Create: `CHANGELOG.md` (Keep a Changelog format; lead with Issue #405 – include `tests/` in published package)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md` (replace vX.X.X / X.X.X with v0.7.17 / 0.7.17)
  - [ ] Create: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate release docs**
  - [ ] Run: `npm run validate:release-docs 0.7.17` — must pass
- [ ] **Update version** references in docs
- [ ] **Do not proceed to Release until docs are complete**

---

## Release

- [ ] **Commit release prep**
  - [ ] `git add . && git commit -m "chore: prepare release v0.7.17"`
- [ ] **Release branch**
  - [ ] Create: `git checkout -b release/v0.7.17` (from current branch or main)
  - [ ] Push: `git push origin release/v0.7.17`
- [ ] **Publish**
  - [ ] Create GitHub release to trigger CI (`.github/workflows/test-and-publish.yml`)
  - [ ] Monitor Actions until workflow succeeds; confirm package in GitHub Packages
  - [ ] Tag created with release (e.g. `gh release create v0.7.17`)
- [ ] **Tag release**
  - [ ] Verify package published to GitHub Packages (after CI completes)
  - [ ] Tag: `v0.7.17` (created with GitHub release)
  - [ ] Push: tag pushed with release
- [ ] **GitHub release**
  - [ ] Title: `v0.7.17`; description from CHANGELOG.md; target `release/v0.7.17`
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.17` → `main` (e.g. via PR)
  - [ ] Push: `git push origin main`

---

## Completion criteria

- [ ] Package published to GitHub Package Registry (CI workflow — monitor Actions)
- [ ] GitHub release created
- [ ] CHANGELOG.md updated (include tests in package for v0.7.17)
- [ ] All tests passing

---

## Important notes

- **Purpose:** Issue #405 – Include `tests/` in published npm package so customers receive Jest unit/integration tests.
- **Change:** `package.json` `files` array includes `"tests"` (root-level tests folder).
- **Version:** v0.7.17 (patch). No breaking changes.
- Package publishes to **GitHub Package Registry**.
