# Release Documentation Validation

## Overview

This document outlines the required documentation for each release type and provides a validation tool to ensure all required documents are present before packaging.

## Manual Release Documentation Setup Process

The release documentation process is **manual** and follows these steps:

### Step 1: Create Release Issue & Branch

```bash
npm run release:issue 0.6.1 patch
```

This creates:
- GitHub issue with appropriate template
- Working branch `issueNNN`
- Switches to the new branch

### Step 2: Create Release Directory

Manually create the release directory:

```bash
mkdir -p docs/releases/v0.6.1
```

### Step 3: Create Initial Template Documents

#### For Patch Releases

1. **Create `CHANGELOG.md`**:
   - Create new file: `docs/releases/v0.6.1/CHANGELOG.md`
   - Use [Keep a Changelog](https://keepachangelog.com/) format
   - Copy structure from previous release if helpful

2. **Create `PACKAGE-STRUCTURE.md`** (optional but recommended):
   ```bash
   cp docs/releases/PACKAGE-STRUCTURE.template.md docs/releases/v0.6.1/PACKAGE-STRUCTURE.md
   ```
   - Replace all instances of `vX.X.X` with actual version (e.g., `v0.6.1`)
   - Replace all instances of `X.X.X` with actual version (e.g., `0.6.1`)

3. **Create `RELEASE-NOTES.md`** (optional but standard):
   - Create new file with release summary
   - Include installation instructions
   - Link to detailed documentation

#### For Minor/Major Releases

1. **Create `CHANGELOG.md`** (same as patch)

2. **Create `PACKAGE-STRUCTURE.md`** (required):
   ```bash
   cp docs/releases/PACKAGE-STRUCTURE.template.md docs/releases/v0.6.1/PACKAGE-STRUCTURE.md
   ```
   - Replace version placeholders as above

3. **Create `EXAMPLES.md`** (required):
   - Create new file with usage examples
   - Include basic and advanced examples
   - Add best practices and common patterns

4. **Create `NEW-FEATURES.md`** (if new features added):
   - Document new features with examples
   - Explain benefits and use cases

5. **Create `API-CHANGES.md`** (if API changes):
   - Document component props, callbacks, methods
   - Include TypeScript type changes
   - Provide before/after examples

6. **Create `MIGRATION.md`** (if breaking changes):
   - Document breaking changes
   - Provide migration steps
   - Include before/after code examples

7. **Create `RELEASE-NOTES.md`** (optional but standard):
   - Release summary and highlights

### Step 4: Validate Documents

After creating the initial documents, validate them:

```bash
npm run validate:release-docs 0.6.1
```

This will:
- Check that all required documents exist
- Verify documents have content
- Warn about missing standard documents
- Check for template placeholders

### Step 5: Complete Documentation

Fill in the template documents with actual release content:
- Update `CHANGELOG.md` with all changes
- Complete `PACKAGE-STRUCTURE.md` (already has version replaced)
- Write `EXAMPLES.md` with actual examples
- Document features, API changes, migration steps as applicable

### Step 6: Re-validate Before Packaging

Before packaging, run validation again to ensure everything is complete:

```bash
npm run validate:release-docs 0.6.1
```

All required documents should pass validation before proceeding with packaging.

## Publishing Strategy

**This is the standard publishing approach for all releases.**

### Preferred Approach: CI Build Publishing

Use CI build for publishing (validated CI build) - **this is the standard process for all releases**:
- Create GitHub release to trigger `.github/workflows/test-and-publish.yml`
- CI workflow automatically: tests (mock APIs only), builds, validates, and publishes
- **Test Job**: Runs first and includes:
  - Linting (`npm run lint`)
  - Tests with mock APIs only (`npm run test:mock` - no real API calls)
  - Build (`npm run build`)
  - Package validation (`npm run package:local`)
- **Publish Job**: Only runs if test job succeeds
  - Publishes to GitHub Package Registry
  - Verifies package installation
- Provides validated, reproducible build process
- Ensures package is built and tested in a clean CI environment
- **All non-skipped tests must pass** before publishing
- See `.github/workflows/test-and-publish.yml` for workflow details

### Fallback Approach: Dev Publish

Dev publish (only if CI fails) - **use only as last resort**:
- Run `npm publish` locally when CI workflow fails or is unavailable
- Still publishes to GitHub Package Registry (configured in `package.json`)
- Should be avoided in favor of fixing CI issues when possible

**Note**: The CI publish workflow runs automatically when a GitHub release is created. This is the preferred method for all releases going forward.

## Validation Tool

Run the validation script to check release documentation:

```bash
# Validate current version from package.json
npm run validate:release-docs

# Validate specific version
npm run validate:release-docs 0.6.1
```

## Required Documents by Release Type

### Patch Releases (Quick Release)

**Template**: `.github/ISSUE_TEMPLATE/quick-release.md`

**Required**:
- ✅ `CHANGELOG.md` - All changes in Keep a Changelog format

**Standard** (present in most releases):
- ⚠️ `RELEASE-NOTES.md` - Release summary (recommended)

**Optional**:
- `MIGRATION.md` - Only if there are breaking changes

### Minor Releases (Full Release Checklist)

**Template**: `.github/ISSUE_TEMPLATE/release-checklist.md`

**Required**:
- ✅ `CHANGELOG.md` - All changes in Keep a Changelog format
- ✅ `EXAMPLES.md` - Usage examples and best practices
- ✅ `PACKAGE-STRUCTURE.md` - From template (`docs/releases/PACKAGE-STRUCTURE.template.md`)

**Conditionally Required** (based on release content):
- ⚠️ `NEW-FEATURES.md` - Required if new features are added
- ⚠️ `API-CHANGES.md` - Required if there are API changes
- ⚠️ `MIGRATION.md` - Required if there are breaking changes

**Standard** (present in most releases):
- ⚠️ `RELEASE-NOTES.md` - Release summary (recommended)

**Optional**:
- `RELEASE-STATUS.md` - Release status tracking
- `GITHUB-RELEASE-NOTES.md` - GitHub release notes
- `RELEASE-CHECKLIST.md` - Release checklist tracking

### Major Releases (Full Release Checklist)

**Template**: `.github/ISSUE_TEMPLATE/release-checklist.md`

**Required**:
- ✅ `CHANGELOG.md` - All changes in Keep a Changelog format
- ✅ `MIGRATION.md` - Breaking changes and migration guide
- ✅ `EXAMPLES.md` - Usage examples and best practices
- ✅ `PACKAGE-STRUCTURE.md` - From template

**Conditionally Required** (based on release content):
- ⚠️ `NEW-FEATURES.md` - Required if new features are added
- ⚠️ `API-CHANGES.md` - Required if there are API changes

**Standard**:
- ⚠️ `RELEASE-NOTES.md` - Release summary (recommended)

## v0.6.0 Release Analysis

**Release Type**: Minor  
**Status**: ❌ Missing required documents

### Missing Documents

1. **EXAMPLES.md** ❌
   - **Status**: Required for minor releases per `release-checklist.md` template
   - **Impact**: Users lack usage examples and best practices
   - **Action**: Create `docs/releases/v0.6.0/EXAMPLES.md`

2. **RELEASE-NOTES.md** ⚠️
   - **Status**: Standard document (present in v0.4.0, v0.4.1, v0.5.0)
   - **Impact**: Missing release summary for users
   - **Action**: Create `docs/releases/v0.6.0/RELEASE-NOTES.md`

### Present Documents

- ✅ `CHANGELOG.md` - Complete
- ✅ `NEW-FEATURES.md` - Complete (echo cancellation features)
- ✅ `API-CHANGES.md` - Complete (new callbacks and props)
- ✅ `PACKAGE-STRUCTURE.md` - Complete
- ✅ `RELEASE-STATUS.md` - Present (optional)

### Validation Results

```bash
$ npm run validate:release-docs 0.6.0
```

**Output**:
- ❌ Missing required document: `EXAMPLES.md`
- ⚠️ `RELEASE-NOTES.md` missing (standard document)
- ⚠️ `MIGRATION.md` check (no breaking changes, so not required)
- ⚠️ `CHANGELOG.md` contains "TBD" placeholders

## Best Practices

1. **Run Validation Before Packaging**: Always run `npm run validate:release-docs` before creating the package
2. **Follow Templates**: Use the appropriate issue template (quick-release for patches, release-checklist for minor/major)
3. **Complete All Required Docs**: Ensure all required documents are present and complete
4. **Review Standard Docs**: Include standard documents like `RELEASE-NOTES.md` for consistency
5. **Update Templates**: Ensure `PACKAGE-STRUCTURE.md` is updated from template (replace `vX.X.X` with actual version)

## Document Purposes

### CHANGELOG.md
- Comprehensive list of all changes
- Keep a Changelog format
- Links to issues, PRs, and documentation

### EXAMPLES.md
- Basic and advanced usage examples
- Migration examples and common patterns
- Best practices and recommended patterns

### NEW-FEATURES.md
- High-level feature descriptions
- Usage examples and patterns
- Benefits and documentation links

### API-CHANGES.md
- Component props, callbacks, state interface
- Method changes and TypeScript types
- Before/after code examples

### MIGRATION.md
- Breaking changes and migration steps
- Deprecated features and alternatives
- Before/after code examples

### PACKAGE-STRUCTURE.md
- Visual representation of included files
- Package entry points and purposes
- Installation and verification steps

### RELEASE-NOTES.md
- Release summary and key highlights
- Installation instructions
- Links to detailed documentation

## Related Documentation

- [Release Documentation Standards](README.md)
- [Release Checklist Template](.github/ISSUE_TEMPLATE/release-checklist.md)
- [Quick Release Template](.github/ISSUE_TEMPLATE/quick-release.md)
- [Package Structure Template](PACKAGE-STRUCTURE.template.md)

