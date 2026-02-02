# Release Checklist – Issue #383

**Release v0.7.11** – principal emphasis: **support for the OpenAI Realtime proxy** (Issue #381). This release delivers the proxy integration, greeting injection, E2E validation in proxy mode, and documentation so customers can use the OpenAI proxy with the component. All commits since **v0.7.10** are included.

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm test` — passed
  - [ ] **E2E in proxy mode** (OpenAI proxy is the default; release must validate proxy support):
    - [ ] Start proxy: `npm run test:proxy:server` (from `test-app/`) — ensure port 8080 is free (e.g. stop OpenAI proxy if running)
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Confirm all E2E tests pass in proxy mode before release
- [x] **Lint clean**
  - [x] Run: `npm run lint` — passed (4 warnings, 0 errors)

---

## Version & build

- [ ] **Bump version to v0.7.11**
  - [ ] Run: `npm version patch`
- [ ] **Build** (optional locally; CI builds on release):
  - [ ] Run: `npm run build`

---

## Documentation

- [ ] **Create release docs before publishing**
  - [ ] Create: `docs/releases/v0.7.11/`
  - [ ] Create: `CHANGELOG.md` (Keep a Changelog format; lead with OpenAI proxy support – Issue #381 – and all changes since v0.7.10)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md`
    - Replace placeholders with `v0.7.11` and `0.7.11`
  - [ ] Create: `RELEASE-NOTES.md` (optional)
- [ ] **Validate release docs**
  - [ ] Run: `npm run validate:release-docs 0.7.11`
- [ ] **Update version** references in docs
- [ ] **Do not proceed to Release until docs are complete**

---

## Release

- [ ] **Commit release prep**
  - [ ] `git add . && git commit -m "chore: prepare release v0.7.11"`
- [ ] **Release branch**
  - [ ] `git checkout -b release/v0.7.11`
  - [ ] `git push origin release/v0.7.11`
- [ ] **Publish**
  - [ ] **Preferred**: Create GitHub release to trigger CI (`.github/workflows/test-and-publish.yml`)
    - [ ] Create GitHub release (draft or publish)
    - [ ] Monitor Actions until workflow succeeds
    - [ ] Confirm package in GitHub Packages
    - [ ] Only tag after publish succeeds
  - [ ] **Fallback**: `npm publish` if CI fails; then verify in GitHub Packages
- [ ] **Tag** (after publish succeeds)
  - [ ] `git tag v0.7.11`
  - [ ] `git push origin v0.7.11`
- [ ] **GitHub release** (if not already created for CI)
  - [ ] Title: `v0.7.11`
  - [ ] Description: from `CHANGELOG.md` (emphasize OpenAI proxy support)
  - [ ] Target: `release/v0.7.11` (or `main` if merged)
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.11` → `main`
  - [ ] `git push origin main`

---

## Completion criteria

- [ ] Package published to GitHub Package Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated with all changes since v0.7.10
- [ ] All tests passing (unit, integration, E2E in proxy mode)

---

## Important notes

- **Principal emphasis**: This release supports the **OpenAI Realtime proxy** (Issue #381). Make release title and description clear about proxy support.
- **Version**: v0.7.11 (patch). No breaking changes.
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with OpenAI proxy (Issue #381); include Fix for #382 (CI build) and other changes since v0.7.10.
