# Release Notes - v0.8.1

**Release Date**: February 2026  
**Type**: Patch

## Summary

Patch release for the React component and voice-agent-backend. Aligns versions (0.8.1 / 0.1.1) and includes CI/CD fixes from Issue #425: publish both packages from repo root (backend via `./packages/voice-agent-backend`), root package linked to repo, and Publish Only workflow for isolated publish testing.

## Highlights

- **Versions:** `@signal-meaning/voice-agent-react@0.8.1`, `@signal-meaning/voice-agent-backend@0.1.1`
- **CI/CD:** Full test-and-publish workflow verified; both packages publish from same job. Backend published from repo root by path to avoid auth/context issues.
- **Docs:** Release branch and release notes for v0.8.1.

## Installation

**React component:**
```bash
npm install @signal-meaning/voice-agent-react@0.8.1
```

**Voice-agent-backend:**
```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
# Configure auth (see packages/voice-agent-backend/README.md)
npm install @signal-meaning/voice-agent-backend@0.1.1
```

## Documentation

- [Changelog](CHANGELOG.md)
- Issue #425: [Publish investigation plan](../../issues/ISSUE-425/PUBLISH-INVESTIGATION-PLAN.md)
