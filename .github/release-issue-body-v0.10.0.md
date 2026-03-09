CLI Usage:
gh issue create --template release-checklist.md --title "Release v0.10.0: Complete Release Process and Documentation" --label "release,documentation,priority:high" --body "Replace v0.10.0 with actual version number"
-->

**Use this template for every new release.** Create a new issue from this template (or copy its checklist); do **not** copy from old release folders (e.g. `docs/releases/v0.4.0/RELEASE-CHECKLIST.md`). Those files are archival only and may be outdated; this template is the source of truth.

## 🚀 Release v0.10.0 - Complete Release Process

### Overview
This issue tracks the complete release process for version v0.10.0 of the Deepgram Voice Interaction React component. This is a minor version release that should include new features and improvements.

The repository publishes two packages to GitHub Package Registry. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). Each package has its own version in its `package.json`; you may release the component only, the backend only, or both in one release.

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
- [ ] **Bump Version**: Update package.json to v0.10.0
  - [ ] Run: `npm version [patch/minor/major]` (or manually update)
- [ ] **Bump voice-agent-backend version** (if releasing that package): Update `packages/voice-agent-backend/package.json` version (e.g. 0.1.0 → 0.2.0)
- [ ] **Update Dependencies**: Ensure all dependencies are up to date
  - [ ] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package (CI performs build — no local build required)
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/v0.10.0/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `v0.10.0` and `0.10.0` placeholders with actual version
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs v0.10.0`
- [ ] **Review Documentation**: Review documentation for completeness and accuracy
  - [ ] Check all examples work correctly
  - [ ] Verify migration guides are accurate
  - [ ] Ensure all links are working
  - [ ] Review for typos and clarity
- [ ] **Test Documentation Examples**: Test all examples and migration guides
  - [ ] Test all code examples in NEW-FEATURES.md
  - [ ] Test all code examples in EXAMPLES.md
  - [ ] Test migration steps in MIGRATION.md
  - [ ] Verify API examples in API-CHANGES.md
- [ ] **Update Main Documentation**: Update README and other docs as needed
- [ ] **Update Migration Guide**: Update migration documentation if needed

#### Git Operations
- [ ] **Commit Changes**: Commit all release-related changes
  - [ ] Commit: Version bump and documentation updates
  - [ ] Message: `chore: prepare release v0.10.0`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] **Preferred**: Run `npm run release:issue 0.10.0 minor` (or patch/major). This creates the issue and branch; it **fails** if the release branch already exists (reminder to bump version) or if root `package.json` version does not match.
  - [ ] Or manually: Create `release/v0.10.0` branch, push: `git push origin release/v0.10.0`

#### Package Publishing
- [ ] **Publish to GitHub Registry**: Publish package(s) to GitHub Package Registry
  - [ ] **Preferred**: Use CI build (validated CI build)
    - **⚠️ CRITICAL: Version must be bumped** in root `package.json` (and `packages/voice-agent-backend/package.json` if releasing the backend) and **committed on the release branch** before creating the GitHub release. If you create the release without bumping, CI will build from the previous version and the published package version will not update.
    - Create GitHub release to trigger `.github/workflows/test-and-publish.yml`
    - CI workflow will: test (mock APIs only), **build in CI**, validate packages, and publish **both** the root package and `@signal-meaning/voice-agent-backend`. No local build required.
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
  - [ ] Tag: `git tag v0.10.0`
  - [ ] Push: `git push origin v0.10.0`
- [ ] **Verify Installation**: Test package installation from registry
  - [ ] Test: Install from `@signal-meaning/voice-agent-react@v0.10.0`
  - [ ] If releasing backend: Install from `@signal-meaning/voice-agent-backend@<version>` (see `packages/voice-agent-backend/README.md` for registry config)
  - [ ] Verify: Package(s) work correctly in test environment

#### GitHub Release
- [ ] **Create GitHub Release**: Create release on GitHub
  - [ ] Title: `Release v0.10.0`
  - [ ] Description: Include changelog and migration notes
  - [ ] Tag: `v0.10.0`
  - [ ] Target: `main` branch
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `v0.10.0` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/v0.10.0` branch
  - [ ] Add: `v0.10.0` label to `release/v0.10.0` branch

#### Post-Release
- [ ] **Update Main Branch**: Merge release branch to main **via Pull Request** (required — do not push directly to `main`)
  - [ ] Open a PR: `release/v0.10.0` → `main` (e.g. "Merge release/v0.10.0 into main")
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
   - Runs on GitHub release creation (or workflow_dispatch)
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
6. **Merge to main via PR**: Branch protection may require changes through a pull request. Do **not** push a local merge directly to `main`; open a PR from `release/v0.10.0` to `main` and merge the PR.

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

---

### Commits since v0.9.8

This release includes the following commits since v0.9.8:

- `39d7558 docs(issue-489): add release checklist for Quick Release v0.9.8`
- `3b5aafc chore: prepare release v0.9.8 (Issue #489)`
- `f9a56d0 docs(issue-489): update release checklist with completed items`
- `5ba1583 chore: disable workflow auto-triggers; docs(issue-489): E2E failures resolution`
- `cc76779 docs(ISSUE-489): complete E2E triage and add issue-487 component integration test`
- `31744ab test(ISSUE-489): TDD regression test for idle timeout without function call`
- `5019841 fix(ISSUE-489): AgentAudioDone fallback to idle so timeout can start in proxy mode`
- `447e3ed chore: disable E2E failure artifacts by default; document why 19 failures persist`
- `4111642 docs: backend-proxy overview, E2E resolution plan; remove AgentAudioDone fallback`
- `79af827 fix: AgentAudioDone on response.done + transition to idle on AgentAudioDone (Issue #482/#489)`
- `cf7ab3f Issue #489: Settings panel with Session pane, Deepgram proxy AgentAudioDone after greeting, disconnect helpers`
- `8c93b78 Issue #489: idle timeout state management docs and component integration test`
- `c1c3402 Issue #489: greeting idle-timeout isolation and diagnostic`
- `50e1fbe docs: resolve Playwright TODO - install steps for Cursor/sandbox`
- `e49bc93 fix(e2e): use project-local Playwright browsers for sandbox and local runs`
- `a08a81f docs(ISSUE-489): add resolution options for the 2 greeting idle-timeout E2E failures`
- `1dcee49 E2E greeting idle-timeout: resilient to text-only greeting, pass with 1s or 10s idle`
- `7c136f5 E2E: fix idle-timeout assertions, skip 8b when idle < 15s, isolate test 9 context failure`
- `84c9600 Docs: add related unit/integration tests and isolation note for test 9 context failure`
- `332ee7b Fix test-app context on reconnect; add isolation test and doc (Issue #489)`
- `e5abbe4 docs: add Issue #490 refactor doc; E2E context/capture and getAgentOptions (Issue #489)`
- `765eff3 Issue #490: TDD tests first – component-owned agent context (RED)`
- `cf97704 Issue #490: Component-owned agent context – implementation (GREEN)`
- `e33b0dd docs(ISSUE-489): E2E doc updates; openai-proxy 8b use IDLE_TIMEOUT+15`
- `0861931 fix(e2e): make test 9a pass by setting restoredAgentContext before reconnect (Issue #489)`
- `755c7c1 refactor(settings): TDD extract getHistoryForSettings, buildSettingsMessage, useSettingsContext`
- `bc71d59 refactor(Phase 3): single latest-history ref; doc E2E results`
- `a31de1d chore(Issue #489): E2E race fix, real-API run, release docs`
- `735b30f docs(Issue #489): release checklist — next step Publish, real-API note`
- `91628ba fix(Issue #489): interruptAgent + DRY real-API + backend reachability`
- `ee05b6a docs(Issue #489): release checklist — commit noted, CI/CD trigger steps`
- `6e3df01 fix: npm audit (Issue #489) — overrides, @rollup/plugin-terser, release docs`
- `b791d59 ci: add E2E stage (mocks, no real APIs) to test-and-publish workflow`
- `1b133f4 Merge pull request #491 from Signal-Meaning/release/v0.9.8`
- `2ce2285 docs(issue-489): complete release checklist, close #489, add labels`
- `4e5696d Merge pull request #492 from Signal-Meaning/davidrmcgee/issue489`
- `f5665fe Add jest timeout for real-API integration tests to prevent hang; docs and proxy/component updates`
- `cab9816 Idle/server timeout clarity, instructions env-only, skip #482 real-API when no server timeout`
- `6b8ee9d Issue #489: proxy fixes, idle-timeout state sync, docs; focus on single remaining E2E failure`
- `5bc0b2a Issue #489: resolve idle timeout after function call; update TDD plan; dist for CI only`
- `33ea374 Skip 9 E2E tests when run without real APIs (USE_REAL_APIS)`
- `21b6b6c docs(ISSUE-489): TDD plan real-API E2E failures; Phase 1 flaky, Phase 2 focus`
- `8122a49 Issue #489: 9a E2E context fallbacks, diagnostics, test-app use package source`
- `ffcaa78 Replace console.log with getLogger().debug in useSettingsContext (9a fallback)`
- `59207e5 docs(ISSUE-489): update TDD plan with Phase 2 status and §12 next steps`
- `66d8b7a Issue #489: 9a context on reconnect — sync load on reconnect, TDD plan update, E2E result`
- `a21ee81 Issue #489/9a: schedule Settings from reconnection block, reconnect preload log; TDD plan update`
- `e057300 fix(ISSUE-489): resolve 9a context-on-reconnect; cleanup diagnostics; update docs`
- `e23d79b docs: add WORKFLOW-FAILURES-RESOLUTION.md for CI workflow failure resolution`
- `e16c49f fix(e2e): 9a/9b test order so reconnect getAgentOptions is counted; add diagnosis doc`
- `8798bb1 Issue #489: TDD all-messages-in-history — RED assertions, mapper + debug logging, linter fixes`
- `458fed4 Issue #489: TDD all-messages-in-history — mark steps 1,2,4,5 Done; proxy transcript mapping, backend:log, tests`
- `0e8f570 Issue #489: pass prior-session context in instructions only; no conversation items`
- `2602205 fix(integration): resolve open handles in openai-proxy-integration tests`
- `ef4f27b Epic #493: OpenAI proxy event map gaps, unmapped as warnings, doc updates`
- `6a4a725 docs + TDD: upstream requirement — conversation.item for finalized message and history (Issue #498)`
- `21695f3 Issue #500: remove raw conversation.item forward; log raw events for debug`
- `238eedd Issue #497: delta accumulator for input_audio_transcription.delta (Epic #493)`
- `fda6abf Issue #494: map speech_stopped channel and last_word_end to UtteranceEnd (Epic #493)`
- `93704d4 Issue #495: document transcription events when VAD disabled; epic acceptance criteria`
- `20a505f Issue #496: transcription completed/delta — expose actuals (start, duration, channel, alternatives)`
- `c3426f5 Issue #499: surface function_call content parts as ConversationText (Deepgram parity)`
- `9f14d62 Epic #493 acceptance: update component docs for proxy message sources`
- `92aed81 Refactor: DRY and docs index (Epic #493 follow-up)`
- `d7dc1c0 Fix open handles and real-API integration test failures`
- `826adce Client message parsing: do not skip on parse error; surface errors`
- `840647c Epic #493: mark epic and sub-issues closed in EPIC.md`
- `df0d686 docs: E2E 6/6b still fail; document instruction attempt and integration-test isolation plan`
- `ee5d007 fix(tests): close proxy WebSocket server in afterAll to avoid Jest open handles`
- `16e6d73 fix(e2e): align tests 6/6b with function-calling setup and shared utilities`
- `2b71b86 Issue #489: backend integration tests, CORS/diagnostics, doc updates`
- `9b11a7d Issue #489: document 6d evidence, skip Step 3 when using existing server`
- `25421e4 Issue #489: LOG_LEVEL=debug for proxy debug file; 6d asserts steps 1-2 only; next steps when 6b fails`
- `d931630 fix(#489): return Promise from function-call handler; doc checkboxes and issue-373 resolved`
- `6c20857 refactor(#489): DRY and clarify openai-proxy function-call handling`
- `0de807b Merge pull request #501 from Signal-Meaning/davidrmcgee/issue489`
- `d94c6bd docs: add scope for issues #490, #379, #346, #333`
- `9335c46 fix: Issues #379, #333; TDD docs for #490, #346`
- `3de7519 fix(#346): Control E2E direct mode so test logs show it; add test:e2e:direct`
- `cf914da docs(#346): defer direct-mode fix to #503; README/TDD status, merge note`
- `5d6261d docs(ORDERING): add status line (1-3 done, #346 deferred to #503)`
- `5fdfd77 refactor(#346): attachIdleTimeoutDiagnostics helper, RECOMMENDED-IMPROVEMENTS, lint fix`
- `aabfa58 Apply remaining recommended improvements (#490/#379/#346/#333)`

---

**Labels**: `release`, `v0.10.0`, `documentation`  
**Milestone**: v0.10.0 Release
