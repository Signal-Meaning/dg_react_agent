# Release Notes - v0.8.0

**Release Date**: February 2026  
**Type**: Minor

## Summary

This **minor** release adds a second publishable package to the repo: **voice-agent-backend** (Issues #423, #425). CI/CD now publishes both `@signal-meaning/deepgram-voice-interaction-react` and `@signal-meaning/voice-agent-backend`. The React component API is unchanged; the bump reflects the expanded offering (official backend package).

## Highlights

- **CI:** Test-and-publish workflow now runs tests, validates packaging, and publishes both `@signal-meaning/deepgram-voice-interaction-react` and `@signal-meaning/voice-agent-backend` on release.
- **Backend package:** Install with `npm install @signal-meaning/voice-agent-backend` (see [packages/voice-agent-backend/README.md](../../../packages/voice-agent-backend/README.md) for GitHub Packages registry config).
- **Release process:** Release checklist and template updated for two-package releases; independent versioning for component and backend.

## Installation

**React component (unchanged API):**
```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.8.0
```

**Voice-agent-backend (first publish):**
```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
# Configure auth (see packages/voice-agent-backend/README.md)
npm install @signal-meaning/voice-agent-backend@0.1.0
```

## Documentation

- [Changelog](CHANGELOG.md)
- [Package structure](PACKAGE-STRUCTURE.md)
- Issue #423: [TDD-PLAN](../../issues/ISSUE-423/TDD-PLAN.md), voice-agent-backend package
- Issue #425: [Release checklist](../../issues/ISSUE-425/RELEASE-CHECKLIST.md), [CI/CD workflow](../../issues/ISSUE-425/CICD-WORKFLOW-423.md)
