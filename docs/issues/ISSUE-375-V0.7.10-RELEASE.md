# Issue #375: Quick Release v0.7.10 - Patch Release

**GitHub Issue**: [#375](https://github.com/Signal-Meaning/dg_react_agent/issues/375) 🟡 **IN PROGRESS**  
**Status**: 🚧 **IN PROGRESS** - Release Preparation  
**Priority**: Medium  
**Labels**: release, patch, priority:medium  
**Branch**: `davidrmcgee/issue375`  
**Release Branch**: `release/v0.7.10` (to be created)

## 📋 Release Overview

**Version**: v0.7.10  
**Release Type**: Patch Release  
**Target Date**: TBD  
**Working Branch**: `davidrmcgee/issue375`  
**Release Branch**: `release/v0.7.10` (to be created)

This is a patch release for version v0.7.10 of the Deepgram Voice Interaction React component. This release includes critical bug fixes and minor improvements with no breaking changes.

## 🔑 Key Changes Since v0.7.9

### Critical Bug Fix: Issue #373

**Issue #373**: Fix idle timeout firing during function call execution
- ✅ Prevents connections from closing during active function calls
- ✅ Implements reference counting for concurrent function calls
- ✅ Ensures function call responses can be sent successfully
- ✅ Includes comprehensive tests (5 unit/integration + 4 E2E tests)

**Impact**:
- Fixes connection closures during function call execution
- Prevents lost function call responses
- Resolves non-responsive agent issues during function calls
- Fixes voice-commerce team Issue #809

### Other Changes

- ✅ Improved greeting detection to prevent false positives
- ✅ Added shared utility for writing test transcripts to files
- ✅ Enhanced dual channel tests with better prompts and logging
- ✅ Documentation updates and improvements

## 📝 Commits Since v0.7.9

```
- refactor: apply DRY principles to Issue #373 implementation (be32cf0)
- Fix Issue #373: Prevent idle timeout during function call execution (3448d9d)
- fix: improve greeting detection to prevent false positives (97495b4)
- feat: add shared utility for writing test transcripts to files (d76e5cc)
- docs: add dual channel test transcripts documentation (9e498be)
- test: update Test 1 text message to use factual question (193eb36)
- test: improve dual channel tests with better prompts and greeting detection (58d0c7c)
- test: add conversation transcript logging to dual channel tests (1bef430)
- test: add conversation transcript logging to dual channel tests (377d31a)
- test: improve dual channel tests with agent response logging and pre-recorded audio (4f670b8)
```

## ✅ Release Checklist Progress

### Pre-Release
- [ ] **Tests Passing**: All tests passing
  - [ ] **Jest Tests**: Run `npm test`
    - [ ] **Status**: TBD
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start proxy server: `npm run test:proxy:server` (in test-app directory)
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
    - [ ] **Status**: TBD
- [ ] **Linting Clean**: No linting errors
  - [ ] **Run**: `npm run lint`
  - [ ] **Status**: TBD

### Version & Build
- [ ] **Bump Version**: Update to v0.7.10
  - [ ] **Run**: `npm version patch`
  - [ ] **Status**: TBD
- [ ] **Build Package**: Create production build
  - [ ] **Run**: `npm run build`
  - [ ] **Status**: TBD
- [ ] **Test Package**: Verify package works
  - [ ] **Run**: `npm run package:local`
  - [ ] **Status**: TBD

### Documentation
- [ ] **⚠️ CRITICAL: Create Release Documentation BEFORE Publishing** ⚠️
  - [ ] **Create**: `docs/releases/v0.7.10/` directory
  - [ ] **Create**: `CHANGELOG.md` with all changes (Keep a Changelog format)
    - Include Issue #373 fix as main feature
    - Include other improvements and fixes
  - [ ] **Create**: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `vX.X.X` and `X.X.X` placeholders with `v0.7.10` and `0.7.10`
  - [ ] **Create**: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate Release Documentation**: Run validation script
  - [ ] **Run**: `npm run validate:release-docs 0.7.10` (version without "v" prefix)
  - [ ] **Status**: TBD
- [ ] **Update Version**: Update version references in docs
  - [ ] **Status**: TBD
- [ ] **⚠️ DO NOT proceed to Release section until documentation is complete** ⚠️

### Release
- [ ] **Commit Changes**: Commit all release-related changes (including documentation)
  - [ ] **Commit**: `git add . && git commit -m "chore: prepare release v0.7.10"`
  - [ ] **Status**: TBD
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] **Create**: `git checkout -b release/v0.7.10` (from current working branch or main)
  - [ ] **Push**: `git push origin release/v0.7.10`
  - [ ] **Status**: TBD
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **⚠️ Documentation must be committed to release branch BEFORE creating GitHub release** ⚠️
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/test-and-publish.yml`)
    - [ ] Create GitHub release (this triggers CI publish workflow)
    - [ ] **Monitor CI workflow**: Wait for CI build to complete successfully
      - [ ] Check GitHub Actions workflow status
      - [ ] Verify all CI checks pass
      - [ ] Verify package appears in GitHub Packages
    - [ ] **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - [ ] Run: `npm publish` (automatically publishes to GitHub Registry)
    - [ ] Verify: Package appears in GitHub Packages
    - [ ] **Only proceed to tagging if publish succeeds**
  - [ ] **Status**: TBD
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package is successfully published to GitHub Packages
  - [ ] Tag: `git tag v0.7.10`
  - [ ] Push: `git push origin v0.7.10`
  - [ ] **Status**: TBD
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] Title: `v0.7.10`
  - [ ] Description: Copy from CHANGELOG.md
  - [ ] Target: `release/v0.7.10` branch (or `main` if release branch merged)
  - [ ] **Status**: TBD
- [ ] **Post-Release**: Merge release branch to main (if not already merged)
  - [ ] Merge: `release/v0.7.10` → `main`
  - [ ] Push: `git push origin main`
  - [ ] **Status**: TBD

## 🚨 Important Notes

- This is a patch release - no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes
- **Critical**: Issue #373 fix is the main feature of this release
- **⚠️ CRITICAL: E2E tests must pass in proxy mode** - proxy mode is the default and primary mode

## ✅ Completion Criteria

- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated
- [ ] All tests passing

## 🔗 Related Issues

- Closes #373 (Main feature - Idle timeout during function calls) ✅ **FIXED**
- Fixes voice-commerce team Issue #809 ✅ **FIXED**
- Issue #375 (this release) 🟡 **IN PROGRESS**

## Test Summary

### Issue #373 Test Coverage

**Unit/Integration Tests**: 5 tests
- Reference counting for concurrent function calls
- Idle timeout prevention during function calls
- Function call lifecycle management

**E2E Tests**: 4 tests
- Function call execution without timeout
- Concurrent function calls handling
- Function call response delivery
- Connection stability during function calls

### Total Test Coverage

- ✅ **Jest Unit/Integration Tests**: 5 new tests for Issue #373
- ✅ **E2E Tests**: 4 new tests for Issue #373
- **Total**: 9 new tests added for Issue #373

## Implementation Details

### Issue #373: Idle Timeout During Function Calls

**Problem**: The component's idle timeout was incorrectly firing during active function call execution, causing connections to close before function call responses could be sent.

**Solution**: 
- Implemented reference counting for concurrent function calls
- Automatically disable idle timeout when function calls are active
- Re-enable idle timeout when all function calls complete
- Added comprehensive test coverage

**Files Modified**:
- `src/utils/IdleTimeoutService.ts` - Added reference counting logic
- `src/hooks/useIdleTimeoutManager.ts` - Added function call tracking
- `src/components/DeepgramVoiceInteraction/index.tsx` - Integrated function call tracking

**Test Files**:
- `tests/` - Unit/integration tests for idle timeout service
- `test-app/tests/e2e/` - E2E tests for function call scenarios
