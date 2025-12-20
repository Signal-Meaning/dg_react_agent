# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2025-12-20

### Added

#### Declarative Props API (Issue #305)
- **New declarative props for React-friendly component control**:
  - `userMessage?: string` - Declaratively send user messages
  - `onUserMessageSent?: () => void` - Callback when user message is sent
  - `autoStartAgent?: boolean` - Automatically start agent service
  - `autoStartTranscription?: boolean` - Automatically start transcription service
  - `connectionState?: ConnectionState` - Declaratively control connection state
  - `interruptAgent?: boolean` - Declaratively interrupt agent speech
  - `onAgentInterrupted?: () => void` - Callback when agent is interrupted
  - `startAudioCapture?: boolean` - Declaratively start audio capture
- **Benefits**: Better React integration patterns, eliminates need for imperative refs in many cases
- **Documentation**: See [Issue #305 Documentation](docs/issues/ISSUE-305-REFACTORING-ANALYSIS.md)
- **Related PRs**: #325

#### Backend Proxy Support (Issue #242)
- **Secure API key management through backend proxy**:
  - `proxyEndpoint?: string` - Backend proxy WebSocket endpoint
  - `proxyAuthToken?: string` - Authentication token for proxy endpoint
  - Automatic connection mode selection (direct vs proxy)
  - Full feature parity between direct and proxy modes
- **Benefits**: Keeps API keys secure on backend, prevents frontend exposure
- **Documentation**: See [Issue #242 Documentation](docs/issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md)
- **Related PRs**: #322
- **Commits**:
  - `d5a8bad` - Issue #242: Phase 1 (Red) - Add failing tests for backend proxy support
  - `f549933` - Issue #242: Phase 2 (Green) - Implement backend proxy support
  - `729e2a9` - Issue #242: Phase 3 (Green) - Feature parity and E2E tests
  - `7da7e7c` - Issue #242: Phase 4 (Refactor) - DRY improvements
  - `91756f2` - Issue #242: Documentation - API reference and backend proxy guides
  - `ecb2e5d` - Issue #242: Complete documentation suite
  - `0895a68` - Issue #242: Mark all documentation requirements as complete
  - `767cab5` - Issue #242: Reorganize docs and remove test-only App.tsx changes
  - `38f8a15` - Issue #242: Update API reference link and finalize E2E test updates

### Changed

- **Removed `lazyLog` feature** (Issue #185):
  - Replaced all 32 `lazyLog()` calls with standard `if (props.debug) console.log()` statements
  - Removed unnecessary abstraction layer for logging
  - All logging now consistently controlled by `props.debug` prop
  - Simplifies codebase and aligns with simplified architecture
  - **Related PRs**: #326
  - **Commits**: `8e55f2d` - Remove lazyLog feature - replace with standard console.log controlled by debug prop

- **Made console.log statements debug-only** (Issue #306):
  - All `[DEBUG]` prefixed console.log statements now properly guarded by `props.debug` checks
  - Prevents debug logs from appearing in production console
  - **Related PRs**: #323
  - **Commits**: `0aa56b1` - Fix issue #306: Make console.log statements debug-only

- **Declarative Props Implementation** (Issue #305):
  - Refactored declarative props for better DRY and maintainability
  - Improved test coverage and documentation
  - **Related PRs**: #325
  - **Commits**:
    - `e29c1a8` - Issue #305: Add declarative props API tests and documentation
    - `870814f` - Issue #305: Implement declarative props in component
    - `d691c63` - Issue #305: Update test app to support declarative props
    - `f6e7da2` - Fix waitForTimeout antipattern and linting errors (Issue #305)
    - `65fac0f` - Fix startAudioCapture prop tests (Issue #305)
    - `2347ca7` - Fix linting errors and update Issue #305 documentation
    - `8b7b1a8` - Complete Issue #305 future work: Unit tests and refactoring analysis
    - `c1df6ca` - Merge Issue #305 refactoring analysis into main document
    - `1c8b54c` - Fix failing declarative props unit tests
    - `b3ac24c` - Refactor declarative props implementation for better DRY and maintainability

### Fixed

- **Test fixes for v0.7.0 release**:
  - Updated module-exports test to expect optional `apiKey` (`apiKey?: string`)
  - Fixed WebSocket tests to use `close()` instead of `disconnect()`
  - Added missing `apiKey` prop to error-handling tests
  - **Commits**: `9f3e869` - Fix failing tests for v0.7.0 release

### Complete Commit List

All commits since v0.6.16 (22 commits total):

1. `9f3e869` - Fix failing tests for v0.7.0 release (David R. McGee)
2. `8e55f2d` - Remove lazyLog feature - replace with standard console.log controlled by debug prop (David R. McGee)
3. `b3ac24c` - Refactor declarative props implementation for better DRY and maintainability (David R. McGee)
4. `1c8b54c` - Fix failing declarative props unit tests (David R. McGee)
5. `c1df6ca` - Merge Issue #305 refactoring analysis into main document (David R. McGee)
6. `8b7b1a8` - Complete Issue #305 future work: Unit tests and refactoring analysis (David R. McGee)
7. `2347ca7` - Fix linting errors and update Issue #305 documentation (David R. McGee)
8. `65fac0f` - Fix startAudioCapture prop tests (Issue #305) (David R. McGee)
9. `f6e7da2` - Fix waitForTimeout antipattern and linting errors (Issue #305) (David R. McGee)
10. `d691c63` - Issue #305: Update test app to support declarative props (David R. McGee)
11. `870814f` - Issue #305: Implement declarative props in component (David R. McGee)
12. `e29c1a8` - Issue #305: Add declarative props API tests and documentation (David R. McGee)
13. `0aa56b1` - Fix issue #306: Make console.log statements debug-only (David R. McGee)
14. `38f8a15` - Issue #242: Update API reference link and finalize E2E test updates (David R. McGee)
15. `767cab5` - Issue #242: Reorganize docs and remove test-only App.tsx changes (David R. McGee)
16. `0895a68` - Issue #242: Mark all documentation requirements as complete (David R. McGee)
17. `ecb2e5d` - Issue #242: Complete documentation suite (David R. McGee)
18. `91756f2` - Issue #242: Documentation - API reference and backend proxy guides (David R. McGee)
19. `7da7e7c` - Issue #242: Phase 4 (Refactor) - DRY improvements (David R. McGee)
20. `729e2a9` - Issue #242: Phase 3 (Green) - Feature parity and E2E tests (David R. McGee)
21. `f549933` - Issue #242: Phase 2 (Green) - Implement backend proxy support (David R. McGee)
22. `d5a8bad` - Issue #242: Phase 1 (Red) - Add failing tests for backend proxy support (David R. McGee)

### Related Pull Requests

- **#326**: Remove lazyLog feature - resolves #185
- **#325**: Issue #305: Declarative Props API - Refactor from Imperative to Declarative
- **#323**: Fix issue #306: Make console.log statements debug-only
- **#322**: Issue #242: Backend Proxy Support for Secure API Key Management

---

[0.6.16]: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.6.16
