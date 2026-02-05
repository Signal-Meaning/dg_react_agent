# Changelog - v0.7.17

**Release Date**: February 2026  
**Release Type**: Patch Release

## Added (Issue #405)

### Tests included in published package

- **`tests/` in package**: The root-level `tests/` folder (Jest unit and integration tests) is now included in the published npm package via `package.json` `files` array. Customers who install the package will receive the same test suite used in the repository for reference and local verification.
- No API or runtime behavior changes.

## Backward Compatibility

✅ **Fully backward compatible** — Package contents only (additive). No API or behavior changes.

## References

- **Issue #405**: Quick Release v0.7.17 — Include tests in published package — [Issue #405](https://github.com/Signal-Meaning/dg_react_agent/issues/405)
