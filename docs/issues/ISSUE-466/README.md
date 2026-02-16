# Issue #466: Process — Require real-API qualification before release

**GitHub:** [#466 Process: Require real-API qualification before release](https://github.com/Signal-Meaning/dg_react_agent/issues/466)

## Summary

We must never qualify a release that fixes proxy/API behavior on **mock-only** tests. For such releases we must run the relevant integration (and where applicable E2E) tests **against the real API** (or document an explicit exception). Trigger: 0.9.2/0.2.2 was qualified using a mock-only test; voice-commerce's real-API E2E (function-call flow) could still fail.

## Changes (this issue)

- **`.cursorrules`** — Added section "Release Qualification (Real API) — CRITICAL" with the requirement and reference to #466.
- **`.github/ISSUE_TEMPLATE/release-checklist.md`** — Real-API integration test step is **REQUIRED** for proxy/API behavior releases (no longer optional for those); note that mock-only success is not sufficient.
- **`.github/ISSUE_TEMPLATE/quick-release.md`** — Pre-Release: added **REQUIRED if this patch fixes proxy/API behavior** bullet with real-API integration test and verification.

## References

- Issue #462 (reopened): fix was qualified on mock-only test.
- voice-commerce analysis: comparison of our mock-only test vs their real-API E2E.
- `tests/integration/openai-proxy-integration.test.ts`: Issue #462 test is `itMockOnly`; run with `USE_REAL_APIS=1` for real-API qualification.
