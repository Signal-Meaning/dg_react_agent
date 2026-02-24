# Issue #484: Release v0.9.7 – Release Checklist (from davidrmcgee/issue484)

**GitHub:** [#484 Release v0.9.7: Complete Release Process and Documentation](https://github.com/Signal-Meaning/dg_react_agent/issues/484)

**Branch:** `davidrmcgee/issue484`. After merge to `main`, create `release/v0.9.7` from `main` (or from this branch before merge, per repo preference) and proceed to GitHub release to trigger CI publish.

**Use the release template:** `.github/ISSUE_TEMPLATE/release-checklist.md` is the source of truth. This file is a focused checklist for preparing release v0.9.7 from this branch.

---

## Release v0.9.7 (component) – Preparation

### Overview

This issue tracks the complete release process for version v0.9.7 of the Deepgram Voice Interaction React component. Scope and type (patch/minor/major) to be filled in as work is planned.

**Packages:** **@signal-meaning/voice-agent-react** (root 0.9.7). **@signal-meaning/voice-agent-backend** — bump only if releasing backend in this release; otherwise leave at current version.

---

### Pre-Release Preparation

- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [x] **Tests Passing**
  - [x] **Run what CI runs:** `npm run lint` then `npm run test:mock` — **passed**
  - [x] Optionally full suite: `npm test` — **passed**
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (run to completion before publish)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (245 tests; allow ~10+ min)
    - [ ] Verify: All tests pass in proxy mode before proceeding
  - [ ] **⚠️ REQUIRED for proxy/API behavior releases:** When `OPENAI_API_KEY` is available:
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All in-scope tests pass against the real API; if keys not available, document the exception.
- [x] **Linting Clean**: `npm run lint` — **no errors**
- [x] **Documentation Updated**: Release checklist and release docs (this dir + docs/releases/v0.9.7)
- [x] **API Changes Documented**: None (no API changes)
- [x] **Breaking Changes Documented**: None

### Version Management

- [x] **Bump Version**: Root `package.json` → 0.9.7 — **done** (`npm version patch --no-git-tag-version`)
- [x] **voice-agent-backend**: Leave at current version (no backend release in this cut)
- [ ] **Update Dependencies (optional):** `npm update`; review if needed

### Build and Package (CI performs build)

- [x] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional local validation**: `npm run clean && npm run build && npm run validate` (do not commit dist/.tgz)

### Documentation

- [x] **Create Release Documentation**
  - [x] Create: `docs/releases/v0.9.7/` directory
  - [x] Create: `CHANGELOG.md` (Keep a Changelog format)
  - [x] Create: `RELEASE-NOTES.md`
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (v0.9.7)
  - [ ] MIGRATION.md / NEW-FEATURES.md / API-CHANGES.md / EXAMPLES.md — not required for this patch
- [x] **Validate Documentation**: `npm run validate:release-docs 0.9.7` — **passed**
- [x] **Review Documentation**: Completeness, links, typos — **reviewed**

### Git Operations

- [x] **Commit release prep**: Version bump and release docs; message `chore: prepare release v0.9.7 (Issue #484)` — **done**
- [ ] **Merge to main**: Open PR from this branch (or release/v0.9.7) to `main`; get review/approval; merge
- [x] **Create Release Branch**: Create `release/v0.9.7`, push — **done** (includes npm audit fix commit)

### Package Publishing

- [x] **Publish via CI**
  - [x] Version bumped and committed on release branch (incl. npm audit fix for minimatch/ajv)
  - [x] GitHub release created to trigger `.github/workflows/test-and-publish.yml`
  - [x] CI: test job then publish job — **both passed** (run 22373611664)
  - [x] Root package and voice-agent-backend published to GitHub Packages
- [x] **Tag**: v0.9.7 created with release
- [ ] **Verify Installation (optional):** Install @signal-meaning/voice-agent-react@0.9.7 and smoke test

### GitHub Release

- [x] **Create GitHub Release**: Title `Release v0.9.7`; tag `v0.9.7`; target `release/v0.9.7` — **done**
- [ ] **Labels**: Add `release`, `v0.9.7` to release and/or release branch as per repo practice

### Post-Release

- [ ] **Merge release branch to main via PR**: Open PR `release/v0.9.7` → `main`; merge via GitHub (do not push directly to main)
- [ ] **Close #484** on GitHub with comment linking to `docs/issues/ISSUE-484/` and this checklist (after GitHub release and CI publish succeed)
- [ ] **Announcement** (if applicable)

---

### Completion Criteria

- [x] Lint and test:mock pass locally (and CI)
- [ ] E2E tests pass in proxy mode (and real-API when required for proxy/API releases)
- [x] Release docs created and validated (`npm run validate:release-docs 0.9.7`)
- [ ] Feature branch merged to main via PR
- [x] Release branch `release/v0.9.7` created and pushed
- [x] GitHub release v0.9.7 created; CI publish succeeded
- [x] Tag v0.9.7 created with release
- [ ] Release branch merged to main via PR
- [ ] #484 closed with link to this folder

---

### References

- [Release template](.github/ISSUE_TEMPLATE/release-checklist.md)
- [PUBLISHING-AND-RELEASING.md](docs/PUBLISHING-AND-RELEASING.md)
