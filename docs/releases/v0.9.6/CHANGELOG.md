# Changelog - v0.9.6

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #478:** Function-call tests now assert that the agent's reply **presents the function result** to the user (not just "we got a response"). Integration: the real-API function-call test asserts that at least one assistant `ConversationText` content includes the function result (e.g. `12:00` or `UTC`). E2E tests 6 and 6b: wait for `[data-testid="agent-response"]` to contain the function result (UTC or time pattern), then assert; use `FUNCTION_CALL_RESULT_TIMEOUT` 45s so we verify the user sees the agent's follow-up with the result. See `docs/issues/ISSUE-478/`.

## Backward Compatibility

✅ **Fully backward compatible** — No component or backend API changes. Test assertions only.

## References

- Issue #478: Function-call tests do not assert presentation of agent response (result content)
- docs/issues/ISSUE-478/TRACKING.md
- docs/issues/ISSUE-478/RELEASE-CHECKLIST.md
