# Changelog - v0.9.6

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #473 (speaker CVE / npm audit):** Optional dependency `speaker` bumped from `^0.5.4` to `^0.5.6` to address CVE-2024-21526 (GHSA-w5fc-gj3h-26rx). Consumers of `@signal-meaning/voice-agent-react` can now pass `npm audit` without high-severity findings from this package.

## Added

- **CI: npm audit:** The test-and-publish workflow now runs `npm audit --audit-level=high` and fails the build on high/critical vulnerabilities.
- **CI: Audit workflow:** New workflow `.github/workflows/audit.yml` runs `npm audit --audit-level=high` on every pull request targeting `main` and on every push to `main`, so vulnerable dependencies are caught before merge and release rather than by consumers.

## Backward Compatibility

✅ **Fully backward compatible** — No component or API changes. Dependency and CI changes only.

## References

- Issue #473: npm audit failure – vulnerable `speaker` dependency
- GitHub Advisory: https://github.com/advisories/GHSA-w5fc-gj3h-26rx
- docs/issues/ISSUE-475/RELEASE-CHECKLIST-v0.9.6.md
