## Quick Release v0.10.3 - Patch Release

**Fixes:** [Issue #522](https://github.com/Signal-Meaning/dg_react_agent/issues/522) — conversation_already_has_active_response after successful function call (voice-commerce #1066). Customer patch release.

### Overview
This is a patch release for version v0.10.3 of the Deepgram Voice Interaction React component. This release includes OpenAI proxy bug fixes for the function-call flow (defer response.create until response.done; do not forward conversation_already_has_active_response to client). No breaking changes.

**Packages:** @signal-meaning/voice-agent-react 0.10.3, @signal-meaning/voice-agent-backend 0.2.8

### Quick Release Checklist

**Process order — do not skip:** Complete **Pre-Release** (tests, lint, audit) before Version & Build or Release. Do **not** create the GitHub release or publish until Pre-Release is complete.

#### Pre-Release
- [ ] **Tests Passing**: All tests passing
  - [ ] Run: `npm test`
  - [ ] **REQUIRED (proxy fix):** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
  - [ ] **REQUIRED (E2E partner scenario):** From test-app, `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6b"`
- [ ] **Linting Clean**: `npm run lint`
- [ ] **npm audit**: `npm audit --audit-level=high` — must pass

#### Version & Build
- [x] **Bump Version**: Root 0.10.3, packages/voice-agent-backend 0.2.8
- [ ] CI builds when GitHub release is created (do not build locally for release)

#### Documentation
- [x] **Release docs:** docs/releases/v0.10.3/ (RELEASE-NOTES.md, CHANGELOG.md, PACKAGE-STRUCTURE.md)
- [x] **Validate:** `npm run validate:release-docs 0.10.3`

#### Release
- [ ] **Commit**: Version bump + release docs (if not already committed)
- [ ] **Release branch**: Create `release/v0.10.3` from branch with fix, push
- [ ] **Publish**: Create GitHub release (tag v0.10.3, target release/v0.10.3) to trigger CI
- [ ] **Monitor CI**: Test and Publish workflow completes; both packages published
- [ ] **Tag**: After publish succeeds, `git tag v0.10.3` and `git push origin v0.10.3`
- [ ] **Post-Release**: Open PR release/v0.10.3 → main, merge via GitHub UI
- [ ] **dist-tag**: `npm dist-tag add @signal-meaning/voice-agent-react@0.10.3 latest` and `@signal-meaning/voice-agent-backend@0.2.8 latest` (registry: https://npm.pkg.github.com)

### Completion Criteria
- [ ] Both packages published to GitHub Registry
- [ ] GitHub release v0.10.3 created
- [ ] Release branch merged to main via PR
