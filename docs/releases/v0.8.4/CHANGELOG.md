# Changelog - v0.8.4

**Release Date**: February 2026  
**Release Type**: Patch Release

## Changed

- **Issue #448:** CI/CD no longer runs on push to main. The Test and Publish workflow (`.github/workflows/test-and-publish.yml`) now runs only on GitHub release creation (`release: published`) and manual `workflow_dispatch`. Merging to `main` no longer triggers automated test/publish; publishing is unchanged via creating a release or running the workflow manually.

## Backward Compatibility

✅ **Fully backward compatible** — Workflow trigger change only; no component or API changes. Patch release.

## References

- Issue #448: Release v0.8.4
