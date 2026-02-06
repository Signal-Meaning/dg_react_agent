# Release Checklist – Issue #404

**Release v0.7.16** – patch release. Principal emphasis: **Issue #399** (SETTINGS_ALREADY_APPLIED; send Settings only once per connection; E2E verified; e2e-helpers-scheme; test-app localhost/proxy). All commits since **v0.7.15** are included.

**GitHub issue:** [Issue #404](https://github.com/Signal-Meaning/dg_react_agent/issues/404)

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm test` — all pass (76 suites, 813 tests)
  - [ ] **E2E in proxy mode** (recommended; skipped for this run — run locally with proxy if desired)
    - [ ] Start proxy: `cd test-app && npm run test:proxy:server`
    - [ ] Run: `cd test-app && USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Confirm 0 failures (or document any authorized skips)
- [x] **Lint clean**
  - [x] Run: `npm run lint` — 0 errors

---

## Version & build

- [x] **Bump version to v0.7.16**
  - [x] Run: `npm version patch --no-git-tag-version`
- [x] **Build** (optional locally; CI builds on release)
  - [x] Do not run build/package locally for release; CI builds when GitHub release is created.

---

## Documentation

- [x] **Create release docs before publishing**
  - [x] Create: `docs/releases/v0.7.16/`
  - [x] Create: `CHANGELOG.md` (Keep a Changelog format; lead with Issue #399 – SETTINGS_ALREADY_APPLIED fix and follow-up)
  - [x] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md` (replace vX.X.X / X.X.X with v0.7.16 / 0.7.16)
  - [x] Create: `RELEASE-NOTES.md` (optional but standard)
- [x] **Validate release docs**
  - [x] Run: `npm run validate:release-docs 0.7.16` — passed
- [x] **Update version** references in docs
- [x] **Do not proceed to Release until docs are complete**

---

## Release

- [x] **Commit release prep**
  - [x] `git add . && git commit -m "chore: prepare release v0.7.16"`
- [x] **Release branch**
  - [x] Create: `git checkout -b release/v0.7.16` (from current branch or main)
  - [x] Push: `git push origin release/v0.7.16`
- [x] **Publish**
  - [x] Create GitHub release to trigger CI (`.github/workflows/test-and-publish.yml`) — [v0.7.16](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.16)
  - [ ] Monitor Actions until workflow succeeds; confirm package in GitHub Packages
  - [x] Tag created with release (gh release create v0.7.16)
- [x] **Tag release**
  - [ ] Verify package published to GitHub Packages (after CI completes)
  - [x] Tag: `v0.7.16` (created with GitHub release)
  - [x] Push: tag pushed with release
- [x] **GitHub release**
  - [x] Title: `v0.7.16`; description from CHANGELOG.md; target `release/v0.7.16`
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.16` → `main` (e.g. via PR)
  - [ ] Push: `git push origin main`

---

## Completion criteria

- [ ] Package published to GitHub Package Registry (CI workflow — monitor Actions)
- [x] GitHub release created — [v0.7.16](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.16)
- [x] CHANGELOG.md updated with all changes since v0.7.15
- [x] All tests passing

---

## Important notes

- **Principal emphasis:** Issue #399 – SETTINGS_ALREADY_APPLIED fix; send Settings only once per connection; race hardening; E2E verified; e2e-helpers-scheme; test-app localhost hint and proxy endpoint testid.
- **Version:** v0.7.16 (patch). No breaking changes.
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with Issue #399; include all commits since v0.7.15 (see [Issue #404](https://github.com/Signal-Meaning/dg_react_agent/issues/404) for list).
