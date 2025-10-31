# Release Documentation

This directory contains comprehensive documentation for each release of dg_react_agent.

## Release Structure

Each release follows a consistent documentation structure:

```
releases/
├── v1.0.0/
│   ├── CHANGELOG.md           # Detailed change log
│   ├── MIGRATION.md           # Breaking changes & migration guide
│   ├── NEW-FEATURES.md        # New features documentation
│   ├── API-CHANGES.md         # API surface changes
│   └── EXAMPLES.md            # Usage examples
└── README.md                  # This file
```

## Release Documentation Standards

### CHANGELOG.md
- **Format**: [Keep a Changelog](https://keepachangelog.com/) format
- **Categories**: Added, Changed, Deprecated, Removed, Fixed, Security
- **Details**: Comprehensive list of all changes
- **Links**: Links to issues, PRs, and documentation

### MIGRATION.md
- **Breaking Changes**: Detailed list with migration steps
- **Deprecated Features**: What's deprecated and alternatives
- **API Changes**: Method signature changes, prop changes
- **Configuration Changes**: Environment variable changes
- **Code Examples**: Before/after code examples

### NEW-FEATURES.md
- **Feature Overview**: High-level feature descriptions
- **Usage Examples**: Code examples and usage patterns
- **Benefits**: Why the feature was added
- **Documentation**: Links to detailed documentation

### API-CHANGES.md
- **Component Props**: New props, changed props, removed props
- **Callback Functions**: New callbacks, signature changes
- **State Interface**: New state properties, type changes
- **Methods**: New methods, deprecated methods
- **Types**: New TypeScript types and interfaces

#### API Validation

Every release must validate:

1. **Deepgram Server API Compliance**
   - Run `npm run api:fetch-spec` to get latest official API
   - Verify all official events are handled
   - Document any new Deepgram events

2. **Component API Changes**
   - Document all new methods/props in `API-CHANGES.md`
   - Add to `tests/api-baseline/approved-additions.ts`
   - Provide usage examples
   - Justify necessity of each addition

3. **Pre-Release Validation**
   - Run `npm run api:validate` before release
   - All API validation tests must pass
   - No unauthorized additions in CI

### EXAMPLES.md
- **Basic Usage**: Simple implementation examples
- **Advanced Usage**: Complex scenarios and patterns
- **Migration Examples**: Before/after code examples
- **Best Practices**: Recommended usage patterns
- **Common Patterns**: Typical implementation patterns

## Release Process

1. **Planning**: Create release issue with documentation requirements
2. **Documentation**: Write comprehensive release documentation
3. **Review**: Review documentation for completeness and accuracy
4. **Testing**: Test all examples and migration guides
5. **Release**: Publish release with documentation
6. **Announcement**: Announce release with migration guidance

## Creating Release Issues

### Automated Release Issue Creation

The project includes an automated script to create release issues and set up the proper working environment:

```bash
# Create a patch release issue and branch
npm run release:issue 0.4.2 patch

# Create a minor release issue and branch
npm run release:issue 0.5.0 minor

# Create a major release issue and branch
npm run release:issue 1.0.0 major
```

### What the Script Does

1. **Validates Environment**: Checks that the working directory is clean (no uncommitted changes)
2. **Switches to Main**: Switches to the main branch and pulls latest changes
3. **Creates GitHub Issue**: Creates a GitHub issue using the appropriate template:
   - **Patch releases**: Uses `quick-release.md` template (streamlined checklist)
   - **Minor/Major releases**: Uses `release-checklist.md` template (comprehensive checklist)
4. **Creates Working Branch**: Creates a new branch named `issueNNN` (where NNN is the issue number)
5. **Switches to New Branch**: Leaves you on the new release branch ready to start work

### Release Issue Templates

#### Quick Release Template (Patch)
- Streamlined checklist for bug fixes and minor improvements
- Essential testing and validation steps
- Simplified documentation requirements (CHANGELOG only)
- Quick release process

#### Release Checklist Template (Minor/Major)
- Complete pre-release preparation
- Version management and dependency updates
- Build and package validation
- Comprehensive documentation requirements
- Git operations and tagging
- Package publishing to GitHub Registry
- GitHub release creation

### Prerequisites

- Working directory must be clean (no uncommitted changes)
- GitHub CLI (`gh`) must be installed and authenticated
- Must have push access to the repository

### Manual Release Issue Creation

If you prefer to create release issues manually:

1. **Go to GitHub Issues**: Navigate to the repository's Issues page
2. **Click "New Issue"**: Click the "New Issue" button
3. **Select Template**: Choose either "Release Checklist" or "Quick Release" template
4. **Fill in Details**: Replace `vX.X.X` with the actual version number
5. **Create Issue**: Click "Submit new issue"
6. **Create Branch**: Manually create a branch named `issueNNN` based on main

## Release Checklist

Each release includes a comprehensive checklist to ensure all steps are completed correctly. The checklist covers both technical release tasks and documentation requirements.

### Using the Release Checklist

1. **Create Release Issue**: Use the "Release Checklist" issue template when creating a new release issue
   - Go to GitHub Issues → "New Issue" → Select "Release Checklist" template
   - This automatically includes the complete checklist with proper labels
2. **Locate the Checklist**: Find the `RELEASE-CHECKLIST.md` file in the version-specific directory (e.g., `docs/releases/v0.4.0/RELEASE-CHECKLIST.md`)

3. **Follow the Process**: Work through each section systematically:
   - **Pre-Release Preparation**: Code review, testing, linting
   - **Version Management**: Bump version, update dependencies
   - **Build and Package**: Clean, build, validate, test package
   - **Documentation**: Create all required documentation files
   - **Git Operations**: Commit, branch, tag
   - **Package Publishing**: Publish to GitHub Registry
   - **GitHub Release**: Create release with proper labeling
   - **Post-Release**: Merge, cleanup, announcements

4. **Check Off Items**: Mark each item as completed using the checkboxes `[ ]` → `[x]`

5. **Verify Completion**: Ensure all items are checked before considering the release complete

### Checklist Features

- **Comprehensive Coverage**: Includes all technical and documentation steps
- **Automated Workflows**: References GitHub Actions workflows that run automatically
- **Documentation Standards**: Ensures compliance with established documentation formats
- **Quality Assurance**: Includes testing and review steps for all documentation
- **GitHub Integration**: Links to related issues and provides proper labeling guidance

### Example Checklist Structure

```markdown
#### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/v0.4.0/` directory
  - [ ] Create: `CHANGELOG.md` with all changes
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
- [ ] **Review Documentation**: Review documentation for completeness and accuracy
- [ ] **Test Documentation Examples**: Test all examples and migration guides
```

### Best Practices

- **Start Early**: Begin the checklist process well before the planned release date
- **Test Thoroughly**: Don't skip the testing steps, especially for documentation examples
- **Review Carefully**: Take time to review all documentation for accuracy and completeness
- **Follow Standards**: Ensure all documentation follows the established formats
- **Document Issues**: Note any problems or deviations in the release issue

## Contributing to Release Documentation

When contributing to release documentation:

1. **Follow Standards**: Use established documentation formats
2. **Be Comprehensive**: Include all relevant changes
3. **Provide Examples**: Include working code examples
4. **Test Examples**: Ensure all examples work correctly
5. **Review Thoroughly**: Check for accuracy and completeness

## Support

For questions about releases or migration:

- **GitHub Issues**: Create an issue for release questions
- **Documentation**: Check release documentation first
- **Examples**: Review usage examples
- **Migration Guides**: Follow step-by-step migration guides
