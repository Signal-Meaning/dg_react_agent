# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.2] - 2025-12-30

### Added

#### Function Calling Test Coverage (Issue #336)
- **Comprehensive E2E Tests**: Added full function call execution flow tests using TDD approach
  - Test for complete flow: Connection → Message → Function Call → Execution → Response
  - Test for function call handler request structure validation
  - Test for function call tracking via DOM element (`data-testid="function-call-tracker"`)
  - Test for function call count increment when FunctionCallRequest is received
- **Test Infrastructure**: Added `waitForFunctionCall()` helper function for E2E tests
  - Supports timeout configuration and retry logic
  - Tracks function calls via DOM element for reliable test assertions
- **Function Call Tracker Element**: Added `data-testid="function-call-tracker"` element for E2E testing
  - Tracks function call count in DOM for test verification
  - Increments when `onFunctionCallRequest` callback is invoked
- **Diagnostic Logging**: Added comprehensive logging for FunctionCallRequest message flow
  - Logs function call requests, handler invocations, and response sending
  - Helps debug function calling issues in E2E tests
- **Factory Function for Function Definitions**: Extracted function definition logic to `test-app/src/utils/functionDefinitions.ts`
  - Improves code organization and testability
  - Supports test override via optional parameter
  - Uses proper TypeScript types (`AgentFunction`) instead of `any`

### Improved

- **Test Reliability**: Improved function calling tests with retry logic and explicit function descriptions
  - Added `tryPromptsForFunctionCall()` helper for retry logic
  - Enhanced function descriptions to increase likelihood of agent calling functions
  - Better error messages for test failures
- **Code Organization**: Extracted 51 lines of test-specific code from `App.tsx` to utility function
  - Cleaner component code
  - Better separation of concerns
  - Improved type safety
- **TDD Methodology**: Updated cursor rules to emphasize Test-Driven Development
  - Tests always come first (RED-GREEN-REFACTOR cycle)
  - Tests define requirements and serve as executable specifications

### Documentation

- **Best Practices Documentation**: Created comprehensive guide for deterministic function calling tests
  - Documented in `docs/issues/ISSUE-336-FUNCTION-CALLING-TEST-COVERAGE.md`
  - Includes patterns for reliable function calling tests
  - Provides examples and troubleshooting tips

**Test Results**:
- **Issue #336 Tests**: All 4 tests passing ✅
- **Jest Tests**: 67 test suites passed, 721 tests passed, 10 skipped
- **E2E Tests**: 164 passed, 3 failed (unrelated to Issue #336), 15 skipped
- **Total E2E Tests**: 182 total

### Complete Commit List

All commits since v0.7.1:

1. `f6bb2a8` - docs: add tracking document for issue 338 (v0.7.2 release)
2. `ba5e3cf` - refactor: extract function definitions to factory function (Option 3)
3. `db760c1` - docs: update release tracking with refactoring changes
4. `fa98edb` - docs: update release tracking with current E2E test status (3 failing, unrelated to Issue #336)
5. `d412d70` - Merge pull request #339 from Signal-Meaning/davidrmcgee/issue336
6. `0929939` - docs(issue-336): update refactoring section to reflect completion
7. `1691397` - refactor(issue-336): implement all refactoring improvements
8. `5cec720` - Issue #336: Fix variable scope bug in full execution flow test
9. `d4d0b41` - Issue #336: Add retry logic to full execution flow test
10. `77a47e1` - Issue #336: Improve flaky function calling tests with retry logic and explicit descriptions
11. `7856800` - Issue #336: Fix failing TDD tests - use detailed function descriptions
12. `6a9b66f` - Issue #336: Add TDD tests and diagnostic logging for function call execution flow

### Related Issues

- **Issue #336**: Function calling test coverage improvements (primary focus of this release)
- **Issue #338**: Quick Release v0.7.2 - Function Calling Test Coverage & TDD Infrastructure

---

[0.7.1]: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.1

