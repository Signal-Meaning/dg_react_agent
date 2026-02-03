# Release Checklist – Issue #394

**Release v0.7.13** – principal emphasis: **Issue #392 – production-ready proxy code** (audit, support-scope docs). This release delivers the proxy audit confirmation, PROXY-OWNERSHIP-DECISION support-scope wording, BACKEND-PROXY support-scope section, and related documentation. All commits since **v0.7.12** are included.

**GitHub issue:** [Issue #394](https://github.com/Signal-Meaning/dg_react_agent/issues/394)

---

## Pre-Release

- [ ] **Tests passing**
  - [ ] Run: `npm test` — all pass
  - [ ] **E2E in proxy mode** (release must validate proxy support):
    - [ ] Start proxy: `npm run test:proxy:server` (from `test-app/`) — ensure port 8080 is free
    - [ ] Run: `E2E_USE_HTTP=1 USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e` (from `test-app`)
    - [ ] Confirm **0 failures**. See `test-app/tests/e2e/README.md` (Backend matrix).
    - **OpenAI proxy E2E:** `E2E_USE_HTTP=1 USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js` (from `test-app`)
- [ ] **Lint clean**
  - [ ] Run: `npm run lint` — 0 errors

---

## Version & build

- [ ] **Bump version to v0.7.13**
  - [ ] Run: `npm version patch`
- [ ] **Build** (optional locally; CI builds on release):
  - [ ] Run: `npm run build`

---

## Documentation

- [ ] **Create release docs before publishing**
  - [ ] Create: `docs/releases/v0.7.13/`
  - [ ] Create: `CHANGELOG.md` (Keep a Changelog format; lead with Issue #392 – production-ready proxy audit and support-scope docs – and any other changes since v0.7.12)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md`
    - Replace placeholders with `v0.7.13` and `0.7.13`
  - [ ] Create: `RELEASE-NOTES.md` (optional)
- [ ] **Validate release docs**
  - [ ] Run: `npm run validate:release-docs 0.7.13`
- [ ] **Update version** references in docs
- [ ] **Do not proceed to Release until docs are complete**

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
- **Version**: v0.7.13 (patch). No breaking changes.
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with Issue #392 (proxy audit, PROXY-OWNERSHIP-DECISION support scope, BACKEND-PROXY support scope); include any other changes since v0.7.12.
