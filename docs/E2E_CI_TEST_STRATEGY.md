# E2E Test Strategy for CI

## Problem Statement

Many E2E tests require real Deepgram API connections and specific conditions (audio playback, microphone permissions, etc.) that are not reliably available in CI environments. These tests are failing or timing out, blocking the CI pipeline.

## Current State

### Tests with CI Skip Logic ✅
- `vad-events-core.spec.js` - Uses `setupVADTest` with `skipInCI: true`
- `manual-vad-workflow.spec.js` - Uses `setupVADTest` with `skipInCI: true`
- `vad-audio-patterns.spec.js` - Uses `setupVADTest` with `skipInCI: true`
- `vad-configuration-optimization.spec.js` - Manual CI skip check
- `real-user-workflows.spec.js` - Checks for API key availability

### Tests Without CI Skip Logic ❌
Many tests don't have proper skip logic and attempt to run in CI, causing failures:
- Tests requiring audio playback (`greeting-audio-timing.spec.js`, `audio-interruption-timing.spec.js`)
- Tests requiring microphone permissions
- Tests with long timeouts
- Tests requiring specific browser capabilities

## Recommended Strategy

### Option 1: CI-Safe Test Suite (Recommended)

Create a curated set of E2E tests that are known to work reliably in CI:

**CI-Safe Tests:**
- `api-key-validation.spec.js` - API key validation
- `text-only-conversation.spec.js` - Text input without audio
- `lazy-initialization-e2e.spec.js` - Component initialization
- `page-content.spec.js` - Basic rendering
- `deepgram-ux-protocol.spec.js` - Protocol validation
- `protocol-validation-modes.spec.js` - Protocol modes

**Implementation:**
1. Add a `--grep` filter to Playwright config for CI
2. Tag CI-safe tests with `@ci-safe` or similar
3. Run only tagged tests in CI

### Option 2: Make E2E Tests Optional in CI

Allow E2E tests to fail without blocking the publish job:

**Implementation:**
```yaml
- name: Run Playwright E2E tests
  run: |
    cd test-app
    npm run test:e2e || echo "E2E tests failed but continuing..."
  continue-on-error: true
  env:
    CI: true
    VITE_DEEPGRAM_API_KEY: ${{ secrets.VITE_DEEPGRAM_API_KEY }}
    VITE_DEEPGRAM_PROJECT_ID: ${{ secrets.VITE_DEEPGRAM_PROJECT_ID }}
```

**Pros:**
- Simple to implement
- Doesn't block releases
- Still provides visibility into E2E test status

**Cons:**
- E2E failures might go unnoticed
- Less strict quality gate

### Option 3: Skip E2E Tests Entirely in CI

Only run Jest tests (unit + integration) in CI, skip E2E tests:

**Implementation:**
- Remove `test-e2e` job from CI workflow
- Run E2E tests only locally or in separate scheduled workflow

**Pros:**
- Simplest solution
- No CI failures from E2E tests
- Faster CI runs

**Cons:**
- No E2E validation in CI
- E2E issues only caught locally

### Option 4: Comprehensive Skip Logic (Most Robust)

Add consistent skip logic to all tests that shouldn't run in CI:

**Implementation:**
1. Create a helper function for CI detection
2. Apply skip logic consistently across all tests
3. Use Playwright's `test.skip()` with clear messages

**Example Pattern:**
```javascript
test.beforeEach(async ({ page }) => {
  if (process.env.CI && !process.env.RUN_FULL_E2E) {
    test.skip(true, 'Skipped in CI - requires real API and specific conditions');
    return;
  }
  // ... test setup
});
```

## Recommendation

**Recommended: Option 1 (CI-Safe Test Suite) + Option 2 (Continue on Error)**

1. **Create a CI-safe test suite** that runs core functionality tests
2. **Make the E2E job continue-on-error** so failures don't block releases
3. **Add clear documentation** about which tests run in CI vs locally

This provides:
- ✅ Quality gate for core functionality
- ✅ Visibility into E2E test status
- ✅ No blocking failures from flaky tests
- ✅ Clear separation between CI and local testing

## Implementation Steps

1. **Tag CI-safe tests** with a consistent pattern (e.g., `@ci-safe`)
2. **Update Playwright config** to filter by tag in CI:
   ```javascript
   grep: process.env.CI ? /@ci-safe/ : undefined
   ```
3. **Update CI workflow** to use `continue-on-error: true` for E2E job
4. **Document** which tests are CI-safe vs local-only
5. **Add skip logic** to remaining tests that shouldn't run in CI

## Alternative: Test Filtering by File Pattern

Instead of tags, filter by file pattern in CI:

```yaml
- name: Run Playwright E2E tests (CI-safe only)
  run: |
    cd test-app
    npx playwright test \
      tests/e2e/api-key-validation.spec.js \
      tests/e2e/text-only-conversation.spec.js \
      tests/e2e/lazy-initialization-e2e.spec.js \
      tests/e2e/page-content.spec.js \
      tests/e2e/deepgram-ux-protocol.spec.js \
      tests/e2e/protocol-validation-modes.spec.js \
      || echo "Some E2E tests failed"
  continue-on-error: true
```

This is simpler but less flexible than tagging.

