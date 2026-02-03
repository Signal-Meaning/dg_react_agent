# Release Checklist – Issue #394

**Release v0.7.13** – principal emphasis: **Issue #392 – production-ready proxy code** (audit, support-scope docs). This release delivers the proxy audit confirmation, PROXY-OWNERSHIP-DECISION support-scope wording, BACKEND-PROXY support-scope section, and related documentation. All commits since **v0.7.12** are included.

**GitHub issue:** [Issue #394](https://github.com/Signal-Meaning/dg_react_agent/issues/394)

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm test` — all pass (use `CI=true npm test` to match CI; excludes e2e-helpers-scheme which needs --experimental-vm-modules)
  - [x] **E2E in proxy mode** — **Skipped for this release (authorized).** No code changes in v0.7.13; E2E will run in CI/CD workflow only.
    - [x] ~~Start proxy: `npm run test:proxy:server` (from `test-app/`)~~ — skipped
    - [x] ~~Run: `E2E_USE_HTTP=1 USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e` (from `test-app`)~~ — skipped
    - [x] ~~Confirm **0 failures**.~~ — rely on CI
    - **OpenAI proxy E2E:** run in CI or locally when needed; see `test-app/tests/e2e/README.md`.
- [x] **Lint clean**
  - [x] Run: `npm run lint` — 0 errors

---

## Version & build

- [x] **Bump version to v0.7.13**
  - [x] Run: `npm version patch --no-git-tag-version`
- [x] **Build** (optional locally; CI builds on release):
  - [x] Skipped — CI will build on release

---

## Documentation

- [x] **Create release docs before publishing**
  - [x] Create: `docs/releases/v0.7.13/`
  - [x] Create: `CHANGELOG.md` (Keep a Changelog format; lead with Issue #392 – production-ready proxy audit and support-scope docs)
  - [x] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md`
  - [x] Create: `RELEASE-NOTES.md`
- [x] **Validate release docs**
  - [x] Run: `npm run validate:release-docs 0.7.13` — passed
- [x] **Update version** references in docs
- [x] **Do not proceed to Release until docs are complete**

---

## Release

- [ ] **Commit release prep**
  - [ ] `git add . && git commit -m "chore: prepare release v0.7.13"`
- [ ] **Release branch**
  - [ ] `git checkout -b release/v0.7.13`
  - [ ] `git push origin release/v0.7.13`
- [ ] **Publish**
  - [ ] **Preferred**: Create GitHub release to trigger CI (`.github/workflows/test-and-publish.yml`)
    - [ ] Create GitHub release (draft or publish)
    - [ ] Monitor Actions until workflow succeeds
    - [ ] Confirm package in GitHub Packages
    - [ ] Only tag after publish succeeds
  - [ ] **Fallback**: `npm publish` if CI fails; then verify in GitHub Packages
- [ ] **Tag** (after publish succeeds)
  - [ ] `git tag v0.7.13`
  - [ ] `git push origin v0.7.13`
- [ ] **GitHub release** (if not already created for CI)
  - [ ] Title: `v0.7.13`
  - [ ] Description: from `CHANGELOG.md` (emphasize Issue #392 proxy audit and support-scope docs)
  - [ ] Target: `release/v0.7.13` (or `main` if merged)
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.13` → `main` via PR
  - [ ] Do not push directly to `main`; use GitHub PR merge

---

## Completion criteria

- [ ] Package published to GitHub Package Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated with all changes since v0.7.12
- [ ] All tests passing (unit, integration, E2E in proxy mode)

---

## Important notes

- **Principal emphasis**: Issue #392 – production-ready proxy code (audit, support-scope documentation). Release title and description should call out proxy audit and “we do not support third-party proxy implementations; customers should adopt 3pp for hosted/support.”
- **Version**: v0.7.13 (patch). No breaking changes. **No code changes** in this release (docs + release prep only).
- **E2E in proxy mode**: Skipped for this release by authorization; E2E runs in CI/CD workflow only.
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with Issue #392 (proxy audit, PROXY-OWNERSHIP-DECISION support scope, BACKEND-PROXY support scope); include any other changes since v0.7.12.
