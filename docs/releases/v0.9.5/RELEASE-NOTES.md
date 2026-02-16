# Release Notes - v0.9.5

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.5 is a **patch** release that ensures we do not repeat the false qualification that led to Issue #462 remaining unresolved for voice-commerce. It does **not** change proxy or component behavior; it fixes **how we qualify** the function-call flow and adds **process guards** so the same mistake cannot happen again.

## Highlights

- **Real backend HTTP in function-call test (#462):** The real-API integration test for the function-call path no longer sends a hardcoded `FunctionCallResponse` from in-test code. It now starts an in-process minimal backend and **POSTs** to it on `FunctionCallRequest`, then sends the backend's response. Qualification therefore exercises the same path as partners (real app → backend HTTP → response).
- **Process guards:** `.cursorrules` and BACKEND-PROXY-DEFECTS now require that function-call flow qualification use real backend HTTP. The release checklist template includes an explicit function-call path step.
- **Documentation:** VOICE-COMMERCE-FUNCTION-CALL-REPORT acknowledges that voice-commerce's report was correct (our test was in-test only, no HTTP/backend); documents what we did and what we should still do.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.5` and `@signal-meaning/voice-agent-backend@0.2.5` if you want to align with this release. This release is primarily for process and test correctness; existing 0.9.4/0.2.4 behavior is unchanged.

See [CHANGELOG.md](./CHANGELOG.md) for details.
