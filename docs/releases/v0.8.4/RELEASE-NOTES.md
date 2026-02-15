# Release Notes - v0.8.4

**Release Date**: February 2026  
**Type**: Patch

## Summary

Patch release for Issue #448. CI/CD is no longer triggered on every merge to `main`; the Test and Publish workflow runs only when a GitHub release is created or when the workflow is run manually. No component or API changes.

## Highlights

- **CI/CD on merge disabled:** `.github/workflows/test-and-publish.yml` no longer has a `push:` trigger. Workflow runs on `release: types: [published]` and `workflow_dispatch` only.

## Installation

**React component:**
```bash
npm install @signal-meaning/voice-agent-react@0.8.4
```

**Voice-agent-backend** (see [packages/voice-agent-backend](../../../packages/voice-agent-backend) for version):
```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
npm install @signal-meaning/voice-agent-backend
```

## Documentation

- [Changelog](CHANGELOG.md)
