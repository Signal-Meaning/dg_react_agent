# Changelog - v0.9.6

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #473 (speaker CVE / npm audit):** Optional dependency `speaker` bumped from `^0.5.4` to `^0.5.6` to address CVE-2024-21526 (GHSA-w5fc-gj3h-26rx). Consumers of `@signal-meaning/voice-agent-react` can now pass `npm audit` without high-severity findings from this package.
- **Issue #478:** Function-call tests now assert that the agent's reply **presents the function result** to the user (not just "we got a response"). Integration: the real-API function-call test asserts that at least one assistant `ConversationText` content includes the function result (e.g. `12:00` or `UTC`). E2E tests 6 and 6b: wait for `[data-testid="agent-response"]` to contain the function result (UTC or time pattern), then assert; use `FUNCTION_CALL_RESULT_TIMEOUT` 45s so we verify the user sees the agent's follow-up with the result. See `docs/issues/ISSUE-478/`.

## Added

- **CI: npm audit:** The test-and-publish workflow now runs `npm audit --audit-level=high` and fails the build on high/critical vulnerabilities.
- **CI: Audit workflow:** New workflow `.github/workflows/audit.yml` runs `npm audit --audit-level=high` on every pull request targeting `main` and on every push to `main`, so vulnerable dependencies are caught before merge and release rather than by consumers.

## Backward Compatibility

✅ **Fully backward compatible** — No component or backend API changes. Dependency, CI, and test assertion changes only.

## References

- Issue #473: npm audit failure – vulnerable `speaker` dependency; GitHub Advisory: https://github.com/advisories/GHSA-w5fc-gj3h-26rx
- Issue #478: Function-call tests do not assert presentation of agent response (result content); docs/issues/ISSUE-478/
- docs/issues/ISSUE-475/RELEASE-CHECKLIST-v0.9.6.md
- docs/issues/ISSUE-478/RELEASE-CHECKLIST.md
