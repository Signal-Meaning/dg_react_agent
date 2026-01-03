# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.4] - 2026-01-02

### Improved

#### Test Infrastructure Improvements
- **VAD Test Refactoring**: All VAD tests now use `skipIfNoRealAPI()` helper for consistency
  - Removed `skipInCI`/`skipReason` options from `setupVADTest()` helper
  - Simplified test API: `setupVADTest(page)` instead of `setupVADTest(page, { skipInCI: true, ... })`
  - Tests now work in both local and CI environments when API keys are configured
  - Better consistency with other real API tests across the test suite
- **Test Documentation Updates**: Updated E2E test documentation and skip reasons
  - All explicitly skipped tests now have documented reasons
  - Updated `E2E_TEST_DEVELOPMENT_GUIDE.md` with new VAD test API
  - Updated `fixtures/README.md` to reflect simplified API
  - Updated `SKIPPED-E2E-TESTS.md` with refactoring details

#### Proxy Backend Validation
- **Comprehensive Validation Pass**: Issue #345 validation completed
  - 47/47 proxy mode tests passing (100% pass rate)
  - All connection-relevant features validated and working correctly
  - Equivalent test coverage confirmed between proxy and direct modes
  - All v0.7.3 fixes validated in proxy mode
  - Production readiness confirmed
- **Validation Documentation**: Comprehensive validation report created
  - Detailed phase-by-phase validation results
  - Test coverage analysis
  - Issue tracking and resolution documentation

### Documentation

- **Proxy Backend Validation Guide**: Comprehensive guide on validating proxy backend in apps
  - Step-by-step validation procedures
  - Test scenarios and expected behaviors
  - Both direct and proxy mode validation
  - Troubleshooting guide for common issues
  - See `RELEASE-NOTES.md` for complete validation guide

### Complete Commit List

All commits since v0.7.3:

1. `57d69ea` - Refactor VAD tests to use skipIfNoRealAPI() helper
2. `f7f69ca` - test: Document all E2E test skip reasons and investigate audio tests
3. `665934a` - docs: Document all explicitly skipped E2E tests and reasons
4. `dca0aa5` - Merge pull request #347 from Signal-Meaning/davidrmcgee/issue345
5. `f9ef606` - docs: Remove Issue #345 reference from Related Documentation section
6. `9901049` - docs: Generalize validation section in Backend Proxy README
7. `e733897` - refactor: Consolidate Issue #345 documents and extract component helpers
8. `9707159` - docs: Fix typo in Phase 6 Important Distinction (Issue #345)
9. `f18cccb` - docs: Update Phase 6 Success Criteria with clarification (Issue #345)
10. `2c8413e` - docs: Clarify Jest vs E2E test coverage distinction (Issue #345)

### Related Issues

- **Issue #345**: Backend Proxy Support Validation - Comprehensive validation pass completed
- **Issue #346**: Idle timeout test failures (tracked for future investigation, not proxy-specific)
- **Issue #348**: Investigate Audio Interruption E2E Test Skips (tracked for investigation)
- **Issue #349**: Quick Release v0.7.4: Test Improvements & Proxy Backend Validation

---

[0.7.3]: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.3

