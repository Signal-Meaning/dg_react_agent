# Release Notes - v0.9.6

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.6 is a **patch** release that strengthens function-calling test coverage. Tests already exercised the real API path (real OpenAI, proxy, backend HTTP); they now **assert that the agent's reply presents the function result** to the user.

## Highlights

- **Integration test (Issue #470 real-API function-call):** Asserts that at least one assistant `ConversationText` content includes the function result (12:00 or UTC), so we verify the API delivered a reply that reflects the function-call result.
- **E2E tests 6 & 6b:** Wait for the agent-response element to contain the function result (UTC or time pattern), then assert; 45s timeout for the function-call round-trip. Verifies the user sees the agent's follow-up with the result.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.6`. No backend version change in this release (voice-agent-backend remains 0.2.5).

See [CHANGELOG.md](./CHANGELOG.md) for details.
