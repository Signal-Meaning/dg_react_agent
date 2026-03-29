## EPIC-546 — Execute patch release (Voice Commerce packaging / proxy)

**Parent epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)  
**Docs hub:** `docs/issues/epic-546/README.md`, `RELEASE-AND-QUALIFICATION.md`

This issue tracks **running the full release checklist** to publish the patch that addresses OpenAI proxy consumer installs (e.g. `selfsigned` / dependency audit in [#547](https://github.com/Signal-Meaning/dg_react_agent/issues/547), [#548](https://github.com/Signal-Meaning/dg_react_agent/issues/548)). Complete implementation PRs **before** executing the steps below.

### Package versions (fill before merge — template overview)

| Package | Location | Version for this release |
|---------|----------|--------------------------|
| **@signal-meaning/voice-agent-react** | Root `package.json` | **0.10.6** on branch **`release/v0.10.6`** (update GitHub Overview if it still shows 0.10.5) |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend/package.json` | **0.2.11** (patch; adjust if a different patch is chosen) |

**Release branch / tag:** Follow `.github/ISSUE_TEMPLATE/release-checklist.md` and `docs/PUBLISHING-AND-RELEASING.md`; confirm `release/v*` branch and tag with CI (`test-and-publish.yml`) when only `voice-agent-backend` version changes.

### Qualification highlights for this release

- [ ] **Packaging smoke:** After `npm pack` of `voice-agent-backend`, install tarball in a clean temp project and start the OpenAI proxy — no `MODULE_NOT_FOUND` (see `docs/issues/epic-546/RELEASE-AND-QUALIFICATION.md`).
- [x] **Proxy / API:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` when `OPENAI_API_KEY` is available — **PASS** (logged **2026-03-28** in [ISSUE-554/TRACKING.md](./TRACKING.md)).

---

<!-- Body below is from the repository release template (frontmatter stripped). -->

<!-- 
CLI Usage:
gh issue create --template release-checklist.md --title "Release vX.X.X: Complete Release Process and Documentation" --label "release,documentation,priority:high" --body "Replace vX.X.X with actual version number"
-->

**Use this template for every new release (patch, minor, or major).** Create a new issue from this template (or copy its checklist); do **not** copy from old release folders (e.g. `docs/releases/v0.4.0/RELEASE-CHECKLIST.md`). Those files are archival only and may be outdated; this template is the single source of truth.

- **Patch (0.0.X):** Bug fixes, no breaking changes. Same checklist; use **minimal docs** (CHANGELOG, PACKAGE-STRUCTURE, optional RELEASE-NOTES).
- **Minor/Major (0.X.0 / X.0.0):** New features or breaking changes. Use the **full documentation** set (see Documentation section below).

## 🚀 Release vX.X.X - Complete Release Process

### Overview
This issue tracks the complete release process for version vX.X.X of the Deepgram Voice Interaction React component. This is a [patch/minor/major] version release that should include [bug fixes/new features or improvements/breaking changes].

The repository publishes **two packages** to GitHub Package Registry. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs. **You must determine and document the version for each package** that is part of this release (see Package versions below).

| Package | Location | Version for this release |
|---------|----------|--------------------------|
| **@signal-meaning/voice-agent-react** (React component) | Root `package.json` | vX.X.X _(fill in)_ |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend/package.json` | X.Y.Z _(fill in)_ |

You may release the component only, the backend only, or both in one release. Whichever packages you bump and publish, record their versions in the table above and use those versions in the checklist (bump, dist-tag, release notes).

**Release branch (required):** Every version is prepared and published from a dedicated branch **`release/vX.X.X`**. Version bumps and `docs/releases/vX.X.X/` must be **committed on that branch** before you create the GitHub Release. Do **not** point the GitHub Release or the release tag at `main` while `main` still lacks those commits — CI publishes from the ref you attach the tag to.

### 📋 Release Checklist

**Process order — do not skip:** Complete **Pre-Release Preparation** (tests, lint, audit) before Version Management, release branch, or publishing. The release branch may be created early for planning, but do **not** create the GitHub release or publish until Pre-Release Preparation is complete.

#### Pre-Release Preparation
- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [ ] **Run what CI runs** (catches broken imports, packaging tests, etc.): `npm run lint` then `npm run test:mock`. CI uses these same commands; passing locally means the Test and Publish workflow test job should pass.
  - [ ] Optionally run full suite: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
  - [ ] **⚠️ REQUIRED for proxy/API behavior releases: Run real-API integration tests** (when the release fixes or touches proxy↔API message ordering, timing, or openai-proxy behavior). Mock-only success is **not** sufficient for qualification; the real API's event order and timing can differ from mocks. When `OPENAI_API_KEY` is available (see `docs/issues/ISSUE-451/SCOPE.md`):
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All in-scope tests pass against the real API (CI runs mocks only; this step validates against live OpenAI). If keys are not available, document the exception and do not claim "qualified against real API" for that release.
    - [ ] **Function-call path:** The real-API function-call test must use **real backend HTTP** (no in-test hardcoded FunctionCallResponse). The test starts an in-process minimal backend and POSTs to it on FunctionCallRequest. See `docs/issues/ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md` and `.cursorrules` (Backend / Proxy Defects).
  - [ ] **Upstream event coverage (proxy releases):** Run `npm test -- tests/openai-proxy-event-coverage.test.ts` — passes; no new unmapped upstream event types (see `UPSTREAM-EVENT-COMPLETE-MAP.md` and Issue #513).
  - [ ] For other releases: Optional but recommended to run the above when keys are available.
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`
- [ ] **npm audit (prerequisite for CI)**: No high/critical vulnerabilities — **required before triggering workflow**
  - [ ] Run: `npm audit --audit-level=high` — must pass (exit 0). CI runs this same check; passing locally avoids workflow failure at the audit step.
  - [ ] If it fails: fix with `npm audit fix` or overrides as per policy, then re-run until it passes.
- [ ] **Documentation Updated**: All relevant documentation updated
- [ ] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management
- [ ] **Determine and record both package versions** (see Overview table). Fill in the version for each package you are releasing so the rest of the checklist and release notes are unambiguous.
- [ ] **Bump React component version** (if releasing the component): Update root `package.json` to the chosen version (e.g. vX.X.X)
  - [ ] Run: `npm version [patch/minor/major]` (or manually update root `package.json`)
- [ ] **Bump Backend version** (if releasing the backend): Update `packages/voice-agent-backend/package.json` to the chosen version (e.g. 0.2.8)
  - [ ] Edit `packages/voice-agent-backend/package.json` — set `"version": "X.Y.Z"` (independent from React version)
- [ ] **Update Dependencies**: Ensure all dependencies are up to date
  - [ ] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package (CI performs build — no local build required)
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/vX.X.X/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`) — replace `vX.X.X` and `X.X.X` placeholders with actual version
  - [ ] **Patch only:** Optional: `RELEASE-NOTES.md`
  - [ ] **Minor/Major only:** Create: `MIGRATION.md` if breaking changes; `NEW-FEATURES.md`; `API-CHANGES.md`; `EXAMPLES.md`
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs vX.X.X`
- [ ] **Review Documentation**: Review documentation for completeness and accuracy
  - [ ] Ensure all links are working; review for typos and clarity
  - [ ] **Minor/Major only:** Check examples work; verify migration guides; test code examples in NEW-FEATURES.md, EXAMPLES.md, MIGRATION.md, API-CHANGES.md
- [ ] **Update Main Documentation**: Update README and other docs as needed
- [ ] **Minor/Major only:** Update migration documentation if needed

#### Git Operations
- [ ] **Commit Changes**: Commit all release-related changes
  - [ ] Commit: Version bump and documentation updates
  - [ ] Message: `chore: prepare release vX.X.X`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] **Preferred**: Run `npm run release:issue X.X.X minor` (or patch/major). This creates the issue and branch; it **fails** if the release branch already exists (reminder to bump version) or if root `package.json` version does not match.
  - [ ] Or manually: Create `release/vX.X.X` branch, push: `git push origin release/vX.X.X`

#### Package Publishing
- [ ] **Publish to GitHub Registry**: Publish package(s) to GitHub Package Registry
  - [ ] **Preferred**: Use CI build (validated CI build)
    - **⚠️ CRITICAL: Version must be bumped** in root `package.json` (and `packages/voice-agent-backend/package.json` if releasing the backend) and **committed on the release branch** before creating the GitHub release. If you create the release without bumping, CI will build from the previous version and the published package version will not update.
    - Create GitHub release to trigger `.github/workflows/test-and-publish.yml` (workflow runs on `release: published`).
    - CI workflow will: test (mock APIs only), **build in CI**, validate packages, and publish **both** the root package and `@signal-meaning/voice-agent-backend`. No local build required.
    - **If the workflow did not run** (e.g. release was created before the trigger was enabled): Go to **Actions → Test and Publish Package → Run workflow**, choose branch **release/vX.X.X**, then Run. Monitor the run until the Publish job completes and both packages appear in GitHub Packages.
    - Test job runs first: linting, mock tests, build, package validation (including voice-agent-backend pack dry-run)
    - Publish job only runs if test job succeeds; it publishes root then voice-agent-backend (each skips if that version already exists unless force is set)
    - **All non-skipped tests must pass** before publishing
    - **Monitor CI workflow**: Wait for CI build to complete successfully
      - Check GitHub Actions workflow status
      - Verify all CI checks pass
      - Verify both packages appear in GitHub Packages (if released)
    - **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - Root: Run `npm publish` from repo root
    - Backend: Run `cd packages/voice-agent-backend && npm publish`
    - Verify: Package(s) appear in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package(s) successfully published to GitHub Packages
  - [ ] Tag: `git tag vX.X.X`
  - [ ] Push: `git push origin vX.X.X`
- [ ] **Verify Installation**: Test package installation from registry
  - [ ] Test: Install from `@signal-meaning/voice-agent-react@vX.X.X`
  - [ ] If releasing backend: Install from `@signal-meaning/voice-agent-backend@<version>` (see `packages/voice-agent-backend/README.md` for registry config)
  - [ ] Verify: Package(s) work correctly in test environment
- [ ] **Apply `latest` dist-tag** (only to packages published in this release)
  - [ ] **Important:** Apply `latest` only to each package that was version-bumped and published in this release. Use the **exact version** you recorded in the Overview table (and committed in that package’s `package.json`). When one package is rolled forward independently (e.g. backend-only or frontend-only release), do **not** run `dist-tag add` for the other package—otherwise you would move that package’s `latest` without a new release.
  - [ ] If you published the **React component**:  
    `npm dist-tag add @signal-meaning/voice-agent-react@<version-from-root-package.json> latest --registry https://npm.pkg.github.com`
  - [ ] If you published the **backend**:  
    `npm dist-tag add @signal-meaning/voice-agent-backend@<version-from-packages/voice-agent-backend/package.json> latest --registry https://npm.pkg.github.com`
  - [ ] Verify (optional):  
    `npm view @signal-meaning/voice-agent-react dist-tags --registry https://npm.pkg.github.com`  
    `npm view @signal-meaning/voice-agent-backend dist-tags --registry https://npm.pkg.github.com`

#### GitHub Release
- [ ] **Create GitHub Release**: Create release on GitHub
  - [ ] Title: `Release vX.X.X`
  - [ ] Description: Include changelog and migration notes
  - [ ] Tag: `vX.X.X` (create the tag from **`release/vX.X.X`**, not from `main`, unless `main` and the release branch are identical at that commit)
  - [ ] **Target branch: `release/vX.X.X`** — the release tag must reference the branch that contains the version bump and release docs so CI builds and publishes the correct tree
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `vX.X.X` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/vX.X.X` branch
  - [ ] Add: `vX.X.X` label to `release/vX.X.X` branch

#### Post-Release
- [ ] **Update Main Branch**: Merge release branch to main **via Pull Request** (required — do not push directly to `main`)
  - [ ] Open a PR: `release/vX.X.X` → `main` (e.g. "Merge release/vX.X.X into main")
  - [ ] Get review/approval if branch protection requires it
  - [ ] Merge the PR (squash or merge commit per repo policy)
  - [ ] **Do not** `git push origin main` from a local merge — use the GitHub PR merge so branch protection is satisfied
- [ ] **Clean Up**: Clean up release artifacts (only if you ran optional local package)
  - [ ] If you ran `npm run package:local` locally: remove any `.tgz` in repo root, or leave (they are gitignored)
- [ ] **Announcement**: Announce release (if applicable)
  - [ ] Update: Any external documentation
  - [ ] Notify: Relevant teams or users

### 🔧 Automated Workflows

The following GitHub Actions workflows will be triggered automatically:

1. **Test Workflow** (`.github/workflows/test.yml`):
   - Runs on push to main/develop
   - Runs linting, tests, and package validation
   - Tests package installation from tarball

2. **Test and Publish Workflow** (`.github/workflows/test-and-publish.yml`):
   - Runs on **release published** (creating a GitHub release triggers it) or **workflow_dispatch** (manual run)
   - **Test Job**: Runs first and includes:
     - Linting (`npm run lint`)
     - Tests with mock APIs only (`npm run test:mock` - no real API calls)
     - **Build in CI** (`npm run build`)
     - Package validation (`npm run package:local`)
   - **Publish Job**: Only runs if test job succeeds
     - **Builds again in CI** and publishes to GitHub Package Registry
   - Verifies package installation
   - **All non-skipped tests must pass** before publishing

### 📚 Documentation Standards

Follow the established documentation structure in `docs/releases/`:

- **CHANGELOG.md**: [Keep a Changelog](https://keepachangelog.com/) format
  - Categories: Added, Changed, Deprecated, Removed, Fixed, Security
  - Include links to issues, PRs, and documentation
- **MIGRATION.md**: Breaking changes and migration steps
  - Detailed list with migration steps
  - Deprecated features and alternatives
  - Before/after code examples
- **NEW-FEATURES.md**: New features with examples
  - High-level feature descriptions
  - Usage examples and patterns
  - Benefits and documentation links
- **API-CHANGES.md**: API surface changes
  - Component props, callbacks, state interface
  - Method changes and TypeScript types
- **EXAMPLES.md**: Usage examples and best practices
  - Basic and advanced usage examples
  - Migration examples and common patterns
- **PACKAGE-STRUCTURE.md**: Package directory structure and file listing
  - Visual representation of included files and directories
  - Package entry points and their purposes
  - Installation and verification steps

### 🚨 Important Notes

1. **Version Bump**: Use `npm version [patch/minor/major]` to automatically bump version. **Bump and push to the release branch before creating the GitHub release** — otherwise the published package version will not change.
2. **Registry**: Package is configured to publish to GitHub Package Registry
3. **Testing**: All tests must pass before release
4. **Documentation**: Comprehensive documentation is required
5. **Breaking Changes**: Must be clearly documented in MIGRATION.md
6. **Publish from `release/vX.X.X`**: Create the GitHub Release (and tag) from the **release branch** after bumps and docs are committed there. **Merge to `main` via PR** only **after** publish (or per your policy): open `release/vX.X.X` → `main`; do **not** push a local merge directly to `main` if branch protection applies.

### 🔗 Related Documentation

- [Release Documentation Standards](docs/releases/README.md)
- [Development Workflow](docs/DEVELOPMENT.md)
- [Migration Guide](docs/migration/README.md)
- [Package Distribution](issues/ISSUE-package-distribution.md)

### ✅ Completion Criteria

This release is complete when:
- [ ] All checklist items are completed
- [ ] Package is published to GitHub Registry
- [ ] GitHub release is created and labeled
- [ ] Documentation is complete and accurate
- [ ] All tests are passing
- [ ] Package installation is verified


**Labels**: `release`, `vX.X.X`, `documentation`  
**Milestone**: vX.X.X Release
