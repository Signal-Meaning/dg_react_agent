# GitHub Issue Templates

This directory contains GitHub issue templates for the Deepgram Voice Interaction React component project.

## Available Templates

### 1. Release Checklist (`release-checklist.md`)
**Use for**: Major and minor releases that require comprehensive documentation and testing.

**Features**:
- Complete release process checklist
- Pre-release preparation steps
- Version management
- CI build and package validation (no local build required)
- Comprehensive documentation requirements
- Git operations and tagging
- Package publishing to GitHub Registry
- GitHub release creation

**CLI Usage**:
```bash
# Using the script (recommended)
npm run release:issue 0.5.0 minor

# Or directly with GitHub CLI
gh issue create --template release-checklist.md --title "Release v0.5.0: Complete Release Process and Documentation" --label "release,documentation,priority:high"
```

### 2. Quick Release (`quick-release.md`)
**Use for**: Patch releases with bug fixes and minor improvements.

**Features**:
- Streamlined checklist for patch releases
- Essential testing and validation steps
- Simplified documentation requirements
- Quick release process

**CLI Usage**:
```bash
gh issue create --template quick-release.md --title "Quick Release v0.4.2: Patch Release" --label "release,patch,priority:medium"
```

## Release Types

### Major Release (X.0.0)
- Breaking changes
- New major features
- Use: `release-checklist.md` template
- Requires: Migration guide, comprehensive documentation

### Minor Release (0.X.0)
- New features
- Backward compatible changes
- Use: `release-checklist.md` template
- Requires: Feature documentation, API changes documentation

### Patch Release (0.0.X)
- Bug fixes
- Minor improvements
- No breaking changes
- Use: `quick-release.md` template
- Requires: CHANGELOG update only

## Using the Release Script

The `npm run release:issue` script provides a convenient way to create release issues:

```bash
# Create a minor release issue
npm run release:issue 0.5.0 minor

# Create a major release issue
npm run release:issue 1.0.0 major

# Create a patch release issue
npm run release:issue 0.4.2 patch
```

## Release Process Overview

1. **Create Release Issue**: Use appropriate template
2. **Complete Checklist**: Follow all checklist items
3. **Test Thoroughly**: Ensure all tests pass
4. **Update Documentation**: Follow documentation standards
5. **Publish Package**: Publish to GitHub Package Registry
6. **Create GitHub Release**: Tag and create release on GitHub
7. **Close Issue**: Mark issue as completed

## Documentation Standards

All releases must follow the established documentation structure in `docs/releases/`:

- `CHANGELOG.md`: Keep a Changelog format
- `MIGRATION.md`: Breaking changes and migration guide
- `NEW-FEATURES.md`: New features with examples
- `API-CHANGES.md`: API surface changes
- `EXAMPLES.md`: Usage examples and best practices

## Related Documentation

- [Release Documentation Standards](docs/releases/README.md)
- [Development Workflow](docs/DEVELOPMENT.md)
- [Migration Guide](docs/migration/README.md)
- [Package Distribution](issues/ISSUE-package-distribution.md)
