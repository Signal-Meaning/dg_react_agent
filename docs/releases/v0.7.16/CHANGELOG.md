# Changelog - v0.7.16

**Release Date**: February 2026  
**Release Type**: Patch Release

## Fixed (Issue #399 follow-up)

### SETTINGS_ALREADY_APPLIED — follow-up and verification

- **sendAgentSettings logging**: On Settings send failure, WebSocket state is now logged using a fresh `getReadyState()` call instead of the pre-send `wsState` (fixes TypeScript narrowing; reflects state at failure time).
- **e2e-helpers-scheme tests**: Replaced dynamic `import()` of ESM (`test-helpers.mjs`) with in-process scheme logic so Jest runs without `--experimental-vm-modules`. Tests assert proxy endpoint scheme (wss/ws) from env; e2e-helpers-scheme no longer excluded in CI.
- **E2E verified**: simple-mic-test passed with existing server + proxy (connect-then-mic, connection stayed connected). Issue #399 tracking updated with verification steps and checklist.
- **test-app**: Localhost troubleshooting (README + Vite localhostHint when dev server starts); `data-testid="connection-proxy-endpoint"` for proxy URL display in UI.

## Backward Compatibility

✅ **Fully backward compatible** — Logging, tests, and test-app UX only. No API or behavior changes to the component beyond the v0.7.15 fix (send Settings only once per connection).

## References

- **Issue #399**: SETTINGS_ALREADY_APPLIED — [docs/issues/ISSUE-399/README.md](../../issues/ISSUE-399/README.md)
- **Issue #404**: Quick Release v0.7.16 — [Issue #404](https://github.com/Signal-Meaning/dg_react_agent/issues/404)
- **PR #403**: davidrmcgee/issue399 → main
