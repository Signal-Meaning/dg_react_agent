# Release Notes - v0.9.6

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.6 is a **patch** release that includes:

1. **Issue #473 (Voice Commerce report):** Consumers were failing `npm audit` due to a high-severity vulnerability in the optional dependency `speaker` (CVE-2024-21526). This release updates the dependency to a patched version and adds npm audit to CI.
2. **Issue #478:** Function-calling tests now **assert that the agent's reply presents the function result** to the user (integration and E2E).

## Highlights

- **Speaker dependency:** `optionalDependencies.speaker` updated from `^0.5.4` to `^0.5.6` so installs resolve to a version that fixes CVE-2024-21526 / GHSA-w5fc-gj3h-26rx.
- **CI: test-and-publish:** The publish workflow now runs `npm audit --audit-level=high` and fails the build on high/critical vulnerabilities.
- **CI: Audit workflow:** New workflow runs `npm audit --audit-level=high` on every pull request targeting `main` and on every push to `main`.
- **Function-call tests (#478):** Integration test asserts assistant `ConversationText` includes the function result (12:00 or UTC). E2E tests 6 & 6b wait for agent-response to contain the function result (UTC or time pattern), then assert; 45s timeout.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.6` to get the updated `speaker` range and pass `npm audit`. Existing 0.9.5 behavior is unchanged. No backend version change (voice-agent-backend remains 0.2.5).

See [CHANGELOG.md](./CHANGELOG.md) for details.
