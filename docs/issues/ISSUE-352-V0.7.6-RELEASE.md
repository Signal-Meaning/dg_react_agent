# Issue #352: Release v0.7.6 - FunctionCallRequest Diagnostic Logging

**GitHub Issue**: [#352](https://github.com/Signal-Meaning/dg_react_agent/issues/352)  
**Status**: 🔄 **In Progress** - Release preparation  
**Priority**: High  
**Labels**: release, patch  
**Branch**: `davidrmcgee/issue352`

## 📋 Release Overview

**Version**: v0.7.6  
**Release Type**: Patch Release  
**Target Date**: TBD  
**Working Branch**: `davidrmcgee/issue352`  
**Release Branch**: `release/v0.7.6` (to be created)

This is a patch release for version v0.7.6 of the Deepgram Voice Interaction React component. This release includes enhanced diagnostic logging for Issue #351 to help diagnose FunctionCallRequest callback issues.

## Key Changes

### Issue #351: Enhanced Diagnostic Logging for FunctionCallRequest

- ✅ Added comprehensive debug logging throughout FunctionCallRequest handling flow
- ✅ Logs message detection, function processing, callback availability, and invocation
- ✅ All logging respects `debug` prop for production-friendly diagnostics
- ✅ Helps diagnose why `onFunctionCallRequest` callback may not be invoked

**Files Modified**:
- `src/components/DeepgramVoiceInteraction/index.tsx` - Enhanced logging in FunctionCallRequest handler

**Diagnostic Messages Added**:
- `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage`
- `🔧 [FUNCTION] FunctionCallRequest received from Deepgram`
- `🔧 [FUNCTION] Functions array length: X`
- `🔧 [FUNCTION] onFunctionCallRequest callback available: true/false`
- `🔧 [FUNCTION] About to invoke onFunctionCallRequest callback`
- `🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...`
- `🔧 [FUNCTION] onFunctionCallRequest callback completed`
- `🔧 [AGENT] ⚠️` messages for early return conditions

## ✅ Release Checklist Progress

### Pre-Release
- [ ] **Tests Passing**: All tests passing
  - [ ] **Jest Tests**: Run `npm test`
  - [ ] **E2E Tests**: Run `npm run test:e2e`
  - [ ] **Status**: TBD
- [ ] **Linting Clean**: No linting errors
  - [ ] **Run**: `npm run lint`
  - [ ] **Status**: TBD

### Version & Build
- [ ] **Bump Version**: Update to v0.7.6
  - [ ] **Run**: `npm version patch`
  - [ ] **Status**: TBD
- [ ] **Build Package**: Create production build
  - [ ] **Run**: `npm run build`
  - [ ] **Status**: TBD
- [ ] **Test Package**: Verify package works
  - [ ] **Run**: `npm run package:local`
  - [ ] **Status**: TBD

### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] **Created**: `docs/releases/v0.7.6/` directory
  - [ ] **Created**: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] **Created**: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `v0.7.6` and `0.7.6` placeholders with actual version
  - [ ] **Created**: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate Release Documentation**: Run validation script
  - [ ] **Run**: `npm run validate:release-docs 0.7.6` (version without "v" prefix)
  - [ ] **Status**: TBD
- [ ] **Update Version**: Update version references in docs
  - [ ] **Status**: TBD

### Release
- [ ] **Commit Changes**: Commit all release-related changes
  - [ ] **Commit**: `git add . && git commit -m "chore: prepare release v0.7.6"`
  - [ ] **Status**: TBD
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] **Create**: `git checkout -b release/v0.7.6` (from current working branch or main)
  - [ ] **Push**: `git push origin release/v0.7.6`
  - [ ] **Status**: TBD
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/test-and-publish.yml`)
    - [ ] **Create GitHub release**: Create v0.7.6 release targeting `release/v0.7.6` branch
    - [ ] **Monitor CI workflow**: Wait for CI build to complete successfully
      - [ ] Check GitHub Actions workflow status
      - [ ] Verify all CI checks pass
      - [ ] Verify package appears in GitHub Packages
    - [ ] **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - [ ] **Run**: `npm publish` (automatically publishes to GitHub Registry)
    - [ ] **Verify**: Package appears in GitHub Packages
    - [ ] **Only proceed to tagging if publish succeeds**
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] **Verify**: Package is successfully published to GitHub Packages
  - [ ] **Tag**: `git tag v0.7.6`
  - [ ] **Push**: `git push origin v0.7.6`
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] **Title**: `v0.7.6`
  - [ ] **Description**: Copy from CHANGELOG.md
  - [ ] **Target**: `release/v0.7.6` branch (or `main` if release branch merged)
- [ ] **Post-Release**: Merge release branch to main (if not already merged)
  - [ ] **Merge**: `release/v0.7.6` → `main`
  - [ ] **Push**: `git push origin main`

## 🚨 Important Notes

- This is a patch release - no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes
- This release includes diagnostic logging to help with Issue #351
- Customer needs this release to test with enhanced logging

## ✅ Completion Criteria

- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated
- [ ] All tests passing
- [ ] Issue #351 customer can test with enhanced logging

## Related Issues

- **Issue #351**: FunctionCallRequest callback not being invoked (diagnostic logging added in this release)

## Release Notes Summary

### Enhanced Diagnostic Logging

This release adds comprehensive diagnostic logging for FunctionCallRequest handling to help diagnose callback invocation issues. When `debug={true}` is enabled on the component, detailed logs will appear showing:

- Message detection and reception
- Function processing details
- Callback availability status
- Callback invocation flow
- Error conditions and early returns

This will help identify why `onFunctionCallRequest` callbacks may not be invoked in certain environments.

