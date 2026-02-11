# Changelog - v0.8.0

**Release Date**: February 2026  
**Release Type**: Minor Release

## Added

### CI/CD and voice-agent-backend package (Issues #423, #425)

- **CI workflow:** Test-and-publish workflow now builds and publishes both packages: `@signal-meaning/deepgram-voice-interaction-react` (root) and `@signal-meaning/voice-agent-backend` (`packages/voice-agent-backend`). Test job validates voice-agent-backend with `npm pack --dry-run`; publish job publishes root then backend (each skips if version exists unless force is set).
- **First publish of voice-agent-backend:** Package `@signal-meaning/voice-agent-backend@0.1.0` is published to GitHub Package Registry. Provides mountable routes for Deepgram/OpenAI proxy and function-call; test-app uses it as a thin wrapper. See `packages/voice-agent-backend/README.md` and [Issue #423](https://github.com/Signal-Meaning/dg_react_agent/issues/423).
- **Release checklist:** Template and ISSUE-425 checklist updated for two-package releases; backend README includes Install section with GitHub Packages registry config.

## Changed

- **Release template:** `.github/ISSUE_TEMPLATE/release-checklist.md` documents two publishable packages, version bump and verify steps for both, and fallback publish commands for root and backend.

## Backward Compatibility

✅ **Fully backward compatible** — No component API changes. New package is additive.

## References

- **Issue #423**: voice-agent-backend package and test-app thin wrapper
- **Issue #425**: CI/CD updates and release for voice-agent-backend
