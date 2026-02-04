# Release Notes - v0.7.16

**Release Date**: February 2026  
**Type**: Patch

## Summary

This patch release follows up on **Issue #399** (SETTINGS_ALREADY_APPLIED): it improves sendAgentSettings failure logging, fixes e2e-helpers-scheme tests under Jest (no ESM dynamic import), documents E2E verification, and adds test-app improvements (localhost hint, proxy endpoint testid).

## Changes

- **sendAgentSettings**: On send failure, WebSocket state is logged via a fresh `getReadyState()` call so logs reflect state at failure time (and satisfy TypeScript).
- **e2e-helpers-scheme**: Tests use in-process scheme logic instead of dynamic import of `test-helpers.mjs`; they run in CI without `--experimental-vm-modules`.
- **Issue #399 docs**: E2E verified (simple-mic-test); Jest regression and verification steps documented.
- **test-app**: Vite prints a localhost hint when the dev server starts; README has localhost troubleshooting; UI proxy endpoint has `data-testid="connection-proxy-endpoint"`.

## References

- **Issue #399**: SETTINGS_ALREADY_APPLIED — [docs/issues/ISSUE-399/README.md](../../issues/ISSUE-399/README.md)
- **Issue #404**: Quick Release v0.7.16 — [Issue #404](https://github.com/Signal-Meaning/dg_react_agent/issues/404)
- **PR #403**: davidrmcgee/issue399 → main
