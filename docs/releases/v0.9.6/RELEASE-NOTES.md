# Release Notes - v0.9.6

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.6 is a **patch** release that addresses **Issue #473** (Voice Commerce report): consumers of `@signal-meaning/voice-agent-react` were failing `npm audit` due to a high-severity vulnerability in the optional dependency `speaker` (CVE-2024-21526). This release updates the dependency to a patched version and adds npm audit to CI so similar issues are caught before release.

## Highlights

- **Speaker dependency:** `optionalDependencies.speaker` updated from `^0.5.4` to `^0.5.6` so installs resolve to a version that fixes CVE-2024-21526 / GHSA-w5fc-gj3h-26rx.
- **CI: test-and-publish:** The publish workflow now runs `npm audit --audit-level=high` and fails the build on high/critical vulnerabilities.
- **CI: Audit workflow:** New workflow runs `npm audit --audit-level=high` on every pull request targeting `main` and on every push to `main`, so vulnerable dependencies are caught in our CI before consumers are affected.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.6` to get the updated `speaker` range and pass `npm audit`. Existing 0.9.5 behavior is unchanged.

See [CHANGELOG.md](./CHANGELOG.md) for details.
