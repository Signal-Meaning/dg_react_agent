---
name: Quick Release
about: Quick release process for patch versions
title: 'Quick Release vX.X.X: Patch Release'
labels: ['release', 'patch', 'priority:medium']
assignees: ''
---

<!-- 
CLI Usage:
gh issue create --template quick-release.md --title "Quick Release vX.X.X: Patch Release" --label "release,patch,priority:medium"
-->

## 🚀 Quick Release vX.X.X - Patch Release

### Overview
This is a patch release for version vX.X.X of the Deepgram Voice Interaction React component. This release includes bug fixes and minor improvements with no breaking changes.

### 📋 Quick Release Checklist

#### Pre-Release
- [ ] **Tests Passing**: All tests passing
  - [ ] Run: `npm test`
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`

#### Version & Build
- [ ] **Bump Version**: Update to vX.X.X
  - [ ] Run: `npm version patch`
- [ ] **Build Package**: Create production build
  - [ ] Run: `npm run build`
- [ ] **Test Package**: Verify package works
  - [ ] Run: `npm run package:local`

#### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/vX.X.X/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `vX.X.X` and `X.X.X` placeholders with actual version
  - [ ] Create: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs vX.X.X`
- [ ] **Update Version**: Update version references in docs

#### Release
- [ ] **Commit & Tag**: Commit changes and create tag
  - [ ] Commit: `git add . && git commit -m "chore: prepare release vX.X.X"`
  - [ ] Tag: `git tag vX.X.X && git push origin vX.X.X`
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/publish.yml`)
    - Create GitHub release (this triggers CI publish workflow)
    - Verify CI build completes successfully
    - Verify package appears in GitHub Packages
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - Run: `npm publish` (automatically publishes to GitHub Registry)
    - Verify: Package appears in GitHub Packages
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] Title: `vX.X.X`
  - [ ] Description: Copy from CHANGELOG.md

### 🚨 Important Notes
- This is a patch release - no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes

### ✅ Completion Criteria
- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated
- [ ] All tests passing
