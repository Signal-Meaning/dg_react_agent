# Issue #475: Release v0.9.6 – Release Checklist (from davidrmcgee/issue475)

**GitHub:** [#475 Quick Release v0.9.6: Patch Release (addresses #473)](https://github.com/Signal-Meaning/dg_react_agent/issues/475)

**Branch:** Work from `davidrmcgee/issue475`. Create `release/v0.9.6` from this branch when ready; proceed to GitHub release to trigger CI publish.

**Scope:** Patch release addressing **#473** (speaker CVE-2024-21526 / npm audit): optionalDependency `speaker` bumped to ^0.5.6; npm audit added to CI (test-and-publish + Audit workflow on PRs). No API or proxy changes.

**Use the quick-release template:** `.github/ISSUE_TEMPLATE/quick-release.md` is the source of truth. This file is a focused checklist for preparing the release from this branch.

---

## Release v0.9.6 – Preparation

### Overview

Patch release from branch `davidrmcgee/issue475`. Delivers:

- **#473 fix:** `optionalDependencies.speaker` ^0.5.4 → ^0.5.6 (CVE-2024-21526 / GHSA-w5fc-gj3h-26rx).
- **CI:** `npm audit --audit-level=high` in test-and-publish workflow; new Audit workflow (`.github/workflows/audit.yml`) runs on every PR and push to main so vulnerable deps are caught before consumers.

Single package version bump for this release: **@signal-meaning/voice-agent-react** (root 0.9.6). Backend unchanged unless you choose to bump for consistency.

---

### Pre-Release Preparation

- [x] **Code Review Complete**: PR #474 merged to main; branch has main merged.
- [x] **Tests Passing**
  - [x] Run: `npm run test:mock` — passed (CI-equivalent).
  - [ ] **E2E in proxy mode:** `cd test-app && npm run backend` (in another terminal), then `USE_PROXY_MODE=true npm run test:e2e` — run before creating GitHub release if desired.
  - [x] **Real-API:** Not required for this patch (no proxy/API behavior change).
- [x] **Linting Clean**: `npm run lint` — passed.
- [x] **npm audit**: `npm audit --audit-level=high` — passed (0 high/critical).

### Version & Build (CI performs build)

- [x] **Bump Version**: Root `package.json` → 0.9.6 — done.
- [x] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional:** `npm run build` or `npm run package:local` locally to verify (do not commit .tgz).

### Documentation

- [x] **Create Release Documentation**
  - [x] Create: `docs/releases/v0.9.6/` directory
  - [x] Create: `CHANGELOG.md` (Keep a Changelog; Fixed: speaker CVE-2024-21526, npm audit in CI)
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`), replace vX.X.X / X.X.X with v0.9.6 / 0.9.6
  - [x] Create: `RELEASE-NOTES.md` (optional but standard)
- [x] **Validate Documentation**: `npm run validate:release-docs 0.9.6` — passed.
- [x] **Update version references** in docs as needed

### Git Operations

- [x] **Commit release docs**: `chore: prepare release v0.9.6 (Issue #475, addresses #473)` — done.
- [ ] **Create Release Branch**: `git checkout -b release/v0.9.6` (from `davidrmcgee/issue475`), push `origin release/v0.9.6` — do when ready to publish.

### Package Publishing

- [ ] **Publish via CI**
  - [ ] Create GitHub release (tag `v0.9.6`, target `release/v0.9.6`) to trigger `.github/workflows/test-and-publish.yml`
  - [ ] Monitor CI: test-jest (incl. npm audit), then publish
  - [ ] Verify package in GitHub Packages
- [ ] **Tag**: Created with GitHub release (v0.9.6)
- [ ] **Verify installation (optional):** Install from registry and smoke test

### GitHub Release

- [ ] **Create GitHub Release** (if not already created for CI)
  - Title: `v0.9.6`
  - Description: From CHANGELOG / `docs/releases/v0.9.6/`
  - Tag: `v0.9.6`
  - Target: `release/v0.9.6`

### Post-Release

- [ ] **Merge to main via PR**: `release/v0.9.6` → `main` (do not push directly to main)
- [ ] **Close or update #475** with release link
- [ ] **Optional:** Notify consumers (e.g. Voice Commerce) that v0.9.6 resolves npm audit for speaker

---

### Completion Criteria

- [x] Lint, test, and npm audit pass locally (CI will run on release)
- [x] Release docs created and validated for v0.9.6
- [ ] GitHub release created; CI published @signal-meaning/voice-agent-react@0.9.6
- [ ] PR merged: `release/v0.9.6` → `main`

---

### References

- [Quick release template](/.github/ISSUE_TEMPLATE/quick-release.md)
- [PUBLISHING-AND-RELEASING.md](/docs/PUBLISHING-AND-RELEASING.md)
- [Issue #473](https://github.com/Signal-Meaning/dg_react_agent/issues/473) — speaker CVE / npm audit (fixed in this release)
