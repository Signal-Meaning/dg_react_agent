# Changelog - v0.10.1

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #508 (voice-commerce #1058):** Idle timeout no longer fires between a function result and the next agent message when that message is a function call (chained flow). `IdleTimeoutService` now clears `waitingForNextAgentMessageAfterFunctionResult` and stops the max-wait timer on `FUNCTION_CALL_STARTED`, so the connection stays open until the chained function call is received. Fixes partner-reported defect where mandate flow (e.g. create_mandate → create_cart_mandate → execute_mandate) was closing on idle after the first function result.

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes to the public component API.

## References

- Issue [#508](https://github.com/Signal-Meaning/dg_react_agent/issues/508) — Idle timeout chained function calls
- PR [#509](https://github.com/Signal-Meaning/dg_react_agent/pull/509) — fix(#508)
- docs/issues/ISSUE-508/ — TDD plan and E2E coverage
