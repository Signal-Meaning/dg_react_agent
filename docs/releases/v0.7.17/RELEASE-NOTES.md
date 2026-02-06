# Release Notes - v0.7.17

**Release Date**: February 2026  
**Type**: Patch

## Summary

This patch release addresses **Issue #405**: the published npm package now includes the root-level **`tests/`** folder (Jest unit and integration tests) so customers receive the same test suite used in the repository.

## Changes

- **Package contents**: `package.json` `files` array now includes `"tests"`. The published tarball includes the full `tests/` directory (e.g. `tests/*.test.ts`, `tests/utils/`, `tests/fixtures/`, `tests/api-baseline/`).
- No API or runtime behavior changes.

## References

- **Issue #405**: Quick Release v0.7.17 — Include tests in published package — [Issue #405](https://github.com/Signal-Meaning/dg_react_agent/issues/405)
