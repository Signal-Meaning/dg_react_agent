# Release Checklist – Issue #394

**Release v0.7.13** – principal emphasis: **Issue #392 – production-ready proxy code** (audit, support-scope docs). This release delivers the proxy audit confirmation, PROXY-OWNERSHIP-DECISION support-scope wording, BACKEND-PROXY support-scope section, and related documentation. All commits since **v0.7.12** are included.

**GitHub issue:** [Issue #394](https://github.com/Signal-Meaning/dg_react_agent/issues/394)

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm test` — all pass (use `CI=true npm test` to match CI; excludes e2e-helpers-scheme which needs --experimental-vm-modules)
  - [x] **E2E in proxy mode** — **Skipped for this release (authorized).** No code changes in v0.7.13; E2E will run in CI/CD workflow only.
    - [x] ~~Start backend: `cd test-app && npm run backend`~~ — skipped
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

- [x] **Commit release prep**
  - [x] `chore: prepare release v0.7.13` committed
- [x] **Release branch**
  - [x] `release/v0.7.13` created and pushed
- [x] **Publish**
  - [x] GitHub release created → CI (`.github/workflows/test-and-publish.yml`) triggered
  - [x] Monitor Actions until workflow succeeds; confirm package in GitHub Packages (run 21639612725 ✓)
  - [x] Tag `v0.7.13` created with release
- [x] **GitHub release**
  - [x] Title: `v0.7.13`; description from CHANGELOG.md; target `release/v0.7.13`
- [x] **Post-release**
  - [x] Merged `release/v0.7.13` → `main` via PR #395

---

## Completion criteria

- [x] Package published to GitHub Package Registry (CI run 21639612725 succeeded)
- [x] GitHub release created
- [x] CHANGELOG.md updated with all changes since v0.7.12
- [x] All tests passing (unit, integration; E2E skipped for this release)

---

## Important notes

- **Principal emphasis**: Issue #392 – production-ready proxy code (audit, support-scope documentation). Release title and description should call out proxy audit and “we do not support third-party proxy implementations; customers should adopt 3pp for hosted/support.”
- **Version**: v0.7.13 (patch). No breaking changes. **No code changes** in this release (docs + release prep only).
- **E2E in proxy mode**: Skipped for this release by authorization; E2E runs in CI/CD workflow only.
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with Issue #392 (proxy audit, PROXY-OWNERSHIP-DECISION support scope, BACKEND-PROXY support scope); include any other changes since v0.7.12.
