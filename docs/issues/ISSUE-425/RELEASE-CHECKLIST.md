# Issue #425: Standard release checklist

**GitHub:** [#425](https://github.com/Signal-Meaning/dg_react_agent/issues/425)  
**Branch:** `davidrmcgee/issue425`

This is the standard release checklist for the repo. For Issue #425, complete the **CI/CD workflow changes** first (see [CICD-WORKFLOW-423.md](./CICD-WORKFLOW-423.md)); then use this checklist for the release that includes publishing `@signal-meaning/voice-agent-backend` (and optionally a component release).

**Source of truth for checklist structure:** `.github/ISSUE_TEMPLATE/release-checklist.md`

---

## Release v0.8.0 – complete release process (minor: new package)

### Overview

This checklist tracks the complete release process for **v0.8.0** (minor release: first publish of voice-agent-backend; component API unchanged). The repo contains two publishable packages:

- **Root package:** `@signal-meaning/voice-agent-react` (React component)
- **Backend package:** `@signal-meaning/voice-agent-backend` (in `packages/voice-agent-backend`)

CI must be updated to publish the backend package (see CICD-WORKFLOW-423.md) before both packages can be released via the same workflow.

---

### Pre-release preparation

- [ ] **Code review complete:** All PRs merged and code reviewed
- [ ] **Tests passing:** All unit and integration tests passing
  - [ ] Run: `npm test`
  - [ ] **Critical: Run E2E tests in proxy mode** (proxy mode is default and primary)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Verify: All E2E tests pass in proxy mode
- [ ] **Linting clean:** No linting errors
  - [ ] Run: `npm run lint`
- [ ] **Documentation updated:** All relevant documentation updated
- [ ] **API changes documented:** Any API changes in API-REFERENCE.md evolution section
- [ ] **Breaking changes documented:** Any breaking changes identified and documented

---

### Version management

- [ ] **Bump root package version:** Update root `package.json` to vX.X.X
  - [ ] Run: `npm version [patch/minor/major]` (or manually update)
- [ ] **Bump voice-agent-backend version (if releasing it):** Update `packages/voice-agent-backend/package.json` (e.g. 0.1.0, 0.2.0)
- [ ] **Update dependencies:** Ensure dependencies are up to date
  - [ ] Run: `npm update` (root)
  - [ ] Optionally: `cd packages/voice-agent-backend && npm update`

---

### Build and package (CI performs build — no local build required)

- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release.
- [ ] **Optional local validation:** To verify build before pushing:
  - [ ] Root: `npm run clean` then `npm run build` then `npm run package:local`
  - [ ] Backend: `cd packages/voice-agent-backend && npm pack --dry-run`
  - [ ] Do **not** commit `.tgz` or `dist/` (gitignored).

---

### Documentation

- [ ] **Create release documentation:** Follow structure in `docs/releases/`
  - [ ] Create: `docs/releases/vX.X.X/` directory
  - [ ] Create: `CHANGELOG.md` (Keep a Changelog format)
  - [ ] Create: `MIGRATION.md` if breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
- [ ] **Validate documentation:** `npm run validate:release-docs vX.X.X`
- [ ] **Review documentation:** Completeness, accuracy, working links
- [ ] **Backend package:** If releasing voice-agent-backend, ensure `packages/voice-agent-backend/README.md` has Install section and registry setup

---

### Git operations

- [ ] **Commit changes:** Commit all release-related changes
  - [ ] Message: `chore: prepare release vX.X.X`
- [ ] **Create release branch:** Create release branch for the version
  - [ ] Create: `release/vX.X.X` branch
  - [ ] Push: `git push origin release/vX.X.X`

---

### Package publishing

- [ ] **CI/CD workflow updated:** All items in [CICD-WORKFLOW-423.md](./CICD-WORKFLOW-423.md) completed so CI can publish both packages (or backend as configured).
- [ ] **Publish via CI (preferred):** Create GitHub release to trigger `.github/workflows/test-and-publish.yml`
  - [ ] CI: test job (lint, mock tests, build, package validation)
  - [ ] CI: publish job publishes root package and (once workflow updated) voice-agent-backend
  - [ ] Monitor CI; verify packages in GitHub Packages
- [ ] **Fallback (if CI fails):** Manual publish
  - [ ] Root: `npm publish` from repo root
  - [ ] Backend: `cd packages/voice-agent-backend && npm publish`
- [ ] **Tag release (after publish succeeds):** `git tag vX.X.X` then `git push origin vX.X.X`
- [ ] **Verify installation:** Install from registry and smoke-test
  - [ ] `npm install @signal-meaning/voice-agent-react@vX.X.X`
  - [ ] `npm install @signal-meaning/voice-agent-backend@<version>` (if released)

---

### GitHub release

- [ ] **Create GitHub release:** Title `Release vX.X.X`, description from changelog, tag `vX.X.X`, target `main`
- [ ] **Add labels:** `release`, `vX.X.X` on issue and branch
- [ ] **Post-release:** Merge `release/vX.X.X` → `main` via Pull Request (do not push directly to main)

---

### Completion criteria

- [ ] All checklist items completed
- [ ] Package(s) published to GitHub Package Registry
- [ ] GitHub release created and labeled
- [ ] Documentation complete and accurate
- [ ] All tests passing
- [ ] Package installation verified

---

### Related

- [CICD-WORKFLOW-423.md](./CICD-WORKFLOW-423.md) — CI/CD workflow work to accommodate Issue #423
- `.github/ISSUE_TEMPLATE/release-checklist.md` — Template source
- [Release documentation standards](docs/releases/README.md)
