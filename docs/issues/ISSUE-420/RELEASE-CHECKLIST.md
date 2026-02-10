**Use this template for every new release.** Create a new issue from this template (or copy its checklist); do **not** copy from old release folders (e.g. `docs/releases/v0.4.0/RELEASE-CHECKLIST.md`). Those files are archival only and may be outdated; this template is the source of truth.

## 🚀 Release v0.7.19 - Complete Release Process

### Overview
This issue tracks the complete release process for version v0.7.19 of the Deepgram Voice Interaction React component. This is a **patch** version release. It is primarily a large patch in support of **openai-proxy** (backend proxy, POST /function-call, E2E and integration tests, docs), and also includes **new logging support** (OTel-style logger, trace ID propagation, backend and test-app adoption), idle timeout and callback fixes, and related documentation. This release includes every commit since the last official published release (v0.7.18).

### 📋 Release Checklist

#### Pre-Release Preparation
- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [ ] Run: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`
- [ ] **Documentation Updated**: All relevant documentation updated
- [ ] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management
- [ ] **Bump Version**: Update package.json to v0.7.19
  - [ ] Run: `npm version patch` (or manually update)
- [ ] **Update Dependencies**: Ensure all dependencies are up to date
  - [ ] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package (CI performs build — no local build required)
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/v0.7.19/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `v0.7.19` and `0.7.19` placeholders with actual version
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs v0.7.19`
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
  - [ ] Message: `chore: prepare release v0.7.19`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `release/v0.7.19` branch
  - [ ] Push: `git push origin release/v0.7.19`

#### Package Publishing
- [ ] **Publish to GitHub Registry**: Publish package to GitHub Package Registry
  - [ ] **Preferred**: Use CI build (validated CI build)
    - Create GitHub release to trigger `.github/workflows/test-and-publish.yml`
    - CI workflow will: test (mock APIs only), **build in CI**, validate package, and publish. No local build required.
    - Test job runs first: linting, mock tests, build, package validation
    - Publish job only runs if test job succeeds
    - **All non-skipped tests must pass** before publishing
    - **Monitor CI workflow**: Wait for CI build to complete successfully
      - Check GitHub Actions workflow status
      - Verify all CI checks pass
      - Verify package appears in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - Run: `npm publish` (automatically publishes to GitHub Registry)
    - Verify: Package appears in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package is successfully published to GitHub Packages
  - [ ] Tag: `git tag v0.7.19`
  - [ ] Push: `git push origin v0.7.19`
- [ ] **Verify Installation**: Test package installation from registry
  - [ ] Test: Install from `@signal-meaning/deepgram-voice-interaction-react@v0.7.19`
  - [ ] Verify: Package works correctly in test environment

#### GitHub Release
- [ ] **Create GitHub Release**: Create release on GitHub
  - [ ] Title: `Release v0.7.19`
  - [ ] Description: Include changelog and migration notes
  - [ ] Tag: `v0.7.19`
  - [ ] Target: `main` branch
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `v0.7.19` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/v0.7.19` branch
  - [ ] Add: `v0.7.19` label to `release/v0.7.19` branch

#### Post-Release
- [ ] **Update Main Branch**: Merge release branch to main **via Pull Request** (required — do not push directly to `main`)
  - [ ] Open a PR: `release/v0.7.19` → `main` (e.g. "Merge release/v0.7.19 into main")
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

1. **Version Bump**: Use `npm version patch` to automatically bump version
2. **Registry**: Package is configured to publish to GitHub Package Registry
3. **Testing**: All tests must pass before release
4. **Documentation**: Comprehensive documentation is required
5. **Breaking Changes**: Must be clearly documented in MIGRATION.md
6. **Merge to main via PR**: Branch protection may require changes through a pull request. Do **not** push a local merge directly to `main`; open a PR from `release/v0.7.19` to `main` and merge the PR.

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

### 📜 Commits since v0.7.18

<details>
<summary>Expand: full commit list (v0.7.18..HEAD)</summary>

```
5b9f7ea Merge origin/main into davidrmcgee/issue412; resolve conflicts
bde8812 docs(ISSUE-412): mark acceptance criteria complete in README
085be55 e2e: rename to callback-test.spec.js and support both Deepgram and OpenAI proxies
d8da447 fix(issue-412): tests + lint for logger adoption
3fa9c62 fix(issue-412): full scope — backend-server + remaining src/ to logger
02e122c fix(issue-412): complete test-app logger adoption (3.3)
ce349db feat(issue-412): 3.5 openai-proxy — replace console.log with emitLog
a8219f6 docs(issue-412): 3.1 audit and 3.6 allowlist
3e0ac7e feat(issue-412): complete 2.4 — proxy attaches trace ID to logger context
e234128 feat(issue-412): test-app sends X-Trace-Id, migration guide, demo doc
e103b34 feat(issue-412): OTel-style logger, trace ID propagation, backend adoption, docs
3f3d643 Merge pull request #418 from Signal-Meaning/davidrmcgee/issue407
7a05735 refactor(issue-407): refactor phase - pathname helper, REFACTOR-PHASE doc, further proposals
09b1dcb docs(issue-407): mark acceptance criteria complete
742048a docs(issue-407): add minimal inline example to BACKEND-PROXY and contract
d562cdb docs(issue-407): Phase 4 - frontend to backend example and links
9b8c5d8 docs(issue-407): Phase 3 - tests and E2E documentation
5dad057 docs: fix CONVERSATION-STORAGE relative links to BACKEND-PROXY and Issue #407
637bcd7 docs(issue-407): Phase 2 - recommend backend execution in BACKEND-PROXY and CONVERSATION-STORAGE
1082cc5 feat(issue-407): Phase 1.3 TDD - frontend forward to backend by default
68f9156 feat(issue-407): Phase 1.2 TDD - POST /function-call endpoint and common handlers
a51f18b docs(issue-407): add tracking doc and plan for backend function call execution
0f2e615 Merge pull request #417 from Signal-Meaning/davidrmcgee/issue416
7b6e659 fix: idle timeout and onTranscriptUpdate E2E (Issue #414/416)
b246060 fix: callback tests with OpenAI proxy (Issue #414) + ws Server type
b91fd39 E2E: OpenAI-only/Deepgram-only scripts, no Deepgram transcription with OpenAI proxy, callback in both runs
1114d3d Issue #414: remove redundant docs, trim CURRENT-UNDERSTANDING index, fix refs
fd521cd Issue #414: doc retention policy, remove test tone from test-app, delete firm-audio log
abdae37 Issue #414: refactor-phase doc, add idleTimeoutMs to AgentSettingsMessage.agent
bbafec8 Log assistant message received (ConversationText) without debug flag for observability
8033e47 Issue #414: shared idle timeout from Settings, proxy uses only Settings (no env)
0a1ee3e docs(414): resolution plan updates, protocol §3.7–3.8, 60-min session handling
8e1a56f Issue #414: Use TTS/speech fixtures for firm audio speech-like test
57430d9 Issue #414: Resolution plan, 12s firm audio window, idle_timeout_ms experiment
e345f42 Issue #414: NEXT-STEPS 0-4, docs, E2E and integration fixes
dff076f Issue #414: OpenAI buffer constants, firm-audio tests, Server VAD explanation
abe1d49 Issue #414: Proxy VAD debug logs; VAD doc progress section
e330005 Issue #414: VAD contract, 24k E2E fix, VAD failures doc, real-API-first
d856fd9 Issue #414: Update NEXT-STEPS stage, E2E failure review, repro tests 9/10, audio testing doc
9ddf28c docs(ISSUE-414): update §3.3 server error and §4 after 3.1/3.2 fixes
e0494b9 fix(proxy): 3.1 min audio before commit, 3.2 one response.create per turn (TDD)
50bff09 docs: E2E run results, NEXT-STEPS rewrite, session-state doc, repro reload, Jest fixes
f2e7527 fix: always log WebSocket close and idle-timeout close to console
12eea05 fix(issue-414): conversation history by value + multi-turn E2E
71d5a17 docs(issue-414): document multi-turn E2E conversation history failure
b50aead E2E: OpenAI protocol doc, user-echo test, greeting in multi-turn, history logging
bd47c3f ISSUE-414: Protocol docs, integration test gaps, BACKEND-PROXY link
27d43d2 ISSUE-414: Add NEXT-STEPS.md and link from README
9f59086 ISSUE-414: Update docs and openai-proxy translator/integration tests
2f51104 Update OpenAI proxy server and integration tests
8284d13 fix(issue-414): fix upstream error on connect and enable greeting TTS
ba6d005 test: update audio-utils createAudioBuffer expectations for new odd-length warning message
842cdcd fix(issue-414): proxy send JSON as text not binary; E2E guard + audio-quality pass
0f3dd1e Issue #414: trap upstream error in tests; docs for playback gap and timing
967497c Issue #414: recoverable workaround, regression doc, test strategy, real-API tests
57aef78 Issue #414: TTS playback + shared IAudioPlaybackSink (Node vs Web)
866caa4 Issue #414: OpenAI proxy CLI – text-in, display agent text, --help
f1ae7b4 Merge pull request #413 from Signal-Meaning/davidrmcgee/issue410
8de4ca9 chore(issue410): sync loader calm browser message; README remaining TODOs done
d8a2f93 fix(test-app): Issue #410 – setState-during-render, logs, instructions
dc744ea fix(openai-proxy): use output_text for assistant messages per OpenAI Realtime API
f555542 Merge pull request #411 from Signal-Meaning/davidrmcgee/issue410
d716f67 Backend proxy: single server, DRY, canonical launch (issue #410)
57a9cd4 Merge pull request #409 from Signal-Meaning/release/v0.7.18
bbe996d fix: add getConversationHistory to API baseline (Issue #406, v0.7.18)
```

</details>

---

**Labels**: `release`, `v0.7.19`, `documentation`  
**Milestone**: v0.7.19 Release
