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
