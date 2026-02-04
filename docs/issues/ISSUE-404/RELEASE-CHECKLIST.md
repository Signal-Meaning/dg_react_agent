# Release Checklist – Issue #404

**Release v0.7.16** – patch release. Principal emphasis: **Issue #399** (SETTINGS_ALREADY_APPLIED; send Settings only once per connection; E2E verified; e2e-helpers-scheme; test-app localhost/proxy). All commits since **v0.7.15** are included.

**GitHub issue:** [Issue #404](https://github.com/Signal-Meaning/dg_react_agent/issues/404)

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

- [ ] **Bump version to v0.7.16**
  - [ ] Run: `npm version patch --no-git-tag-version`
- [ ] **Build** (optional locally; CI builds on release)
  - [ ] Do not run build/package locally for release; CI builds when GitHub release is created.

---

## Documentation

- [ ] **Create release docs before publishing**
  - [ ] Create: `docs/releases/v0.7.16/`
  - [ ] Create: `CHANGELOG.md` (Keep a Changelog format; lead with Issue #399 – SETTINGS_ALREADY_APPLIED fix and follow-up)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md` (replace vX.X.X / X.X.X with v0.7.16 / 0.7.16)
  - [ ] Create: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate release docs**
  - [ ] Run: `npm run validate:release-docs 0.7.16` — must pass
- [ ] **Update version** references in docs
- [ ] **Do not proceed to Release until docs are complete**

---

## Release

- [ ] **Commit release prep**
  - [ ] `git add . && git commit -m "chore: prepare release v0.7.16"`
- [ ] **Release branch**
  - [ ] Create: `git checkout -b release/v0.7.16` (from current branch or main)
  - [ ] Push: `git push origin release/v0.7.16`
- [ ] **Publish**
  - [ ] Create GitHub release (draft or publish) to trigger CI (`.github/workflows/test-and-publish.yml`)
  - [ ] Monitor Actions until workflow succeeds; confirm package in GitHub Packages
  - [ ] Only tag after publish succeeds
- [ ] **Tag release**
  - [ ] Verify package published to GitHub Packages
  - [ ] Tag: `git tag v0.7.16`
  - [ ] Push: `git push origin v0.7.16`
- [ ] **GitHub release**
  - [ ] Title: `v0.7.16`; description from CHANGELOG.md; target `release/v0.7.16`
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.16` → `main` (e.g. via PR)
  - [ ] Push: `git push origin main`

---

## Completion criteria

- [ ] Package published to GitHub Package Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated with all changes since v0.7.15
- [ ] All tests passing

---

## Important notes

- **Principal emphasis:** Issue #399 – SETTINGS_ALREADY_APPLIED fix; send Settings only once per connection; race hardening; E2E verified; e2e-helpers-scheme; test-app localhost hint and proxy endpoint testid.
- **Version:** v0.7.16 (patch). No breaking changes.
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with Issue #399; include all commits since v0.7.15 (see [Issue #404](https://github.com/Signal-Meaning/dg_react_agent/issues/404) for list).
