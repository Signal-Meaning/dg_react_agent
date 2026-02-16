# Changelog - v0.9.3

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Changed

- **Process (Issue #466):** Release qualification now requires real-API testing for proxy/API behavior releases. `.cursorrules` and release templates (release-checklist.md, quick-release.md) updated so we never qualify such releases on mock-only tests again.
- **Tests:** Issue #462 integration test now runs with both **mock and real API** (single test). Real-API path asserts no `conversation_already_has_active_response` when sending Settings during the response window. See `tests/integration/openai-proxy-integration.test.ts` and `docs/issues/ISSUE-451/SCOPE.md` (9 real-API tests).

## Added

- **Docs:** `docs/issues/ISSUE-462/MESSAGE-TO-VOICE-COMMERCE.md` — copy-paste message for customer follow-up (upgrade to 0.9.2/0.2.2). `docs/issues/ISSUE-466/README.md` — process fix tracking.

## Backward Compatibility

✅ **Fully backward compatible** — No component or backend API changes. This release ships process/tooling and test/docs updates only.

## References

- Issue #466: Process — require real-API qualification before release
- Issue #462: conversation_already_has_active_response fix (0.9.2/0.2.2); unified test and customer message
- PR #467: Merge to main
