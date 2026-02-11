# Changelog - v0.8.1

**Release Date**: February 2026  
**Release Type**: Patch Release

## Changed

### CI/CD (Issue #425)

- **Publish workflow:** Backend package is published from repo root via `npm publish ./packages/voice-agent-backend` (no `cd` into package dir) so the same auth context as the root package is used.
- **Root package:** Added `repository` to root `package.json` for repo linkage; both packages now declare the same repo.
- **Publish Only workflow:** Isolated `publish-only.yml` for testing publish without running the full test suite.

### Version bumps

- **Root:** 0.8.0 → 0.8.1
- **voice-agent-backend:** 0.1.0 → 0.1.1

## Backward Compatibility

✅ **Fully backward compatible** — No API changes. Patch release for versions and CI/CD fixes.

## References

- **Issue #425**: Two-package publish and CI/CD workflow fixes
