# Microphone Test Migration Guide

## Issue #188: Fixing Microphone Test Failures

This guide shows how to migrate failing microphone tests to use the new `MicrophoneHelpers` utility that ensures proper sequence execution.

## Root Cause of Failures

The microphone tests were failing because they didn't follow the proper sequence:

1. ❌ **Missing**: Wait for agent connection establishment
2. ❌ **Missing**: Wait for agent greeting completion (settings applied)  
3. ❌ **Missing**: Wait for microphone enablement confirmation
4. ✅ **Present**: Click microphone button

## The Fix: MicrophoneHelpers Utility

The new `MicrophoneHelpers` utility provides:

- `waitForMicrophoneReady()` - Complete activation sequence
- `enableMicrophoneWithRetry()` - Retry logic for flaky environments
- `verifyMicrophonePrerequisites()` - Pre-activation validation
- `testMicrophoneFunctionality()` - Comprehensive testing
- `MICROPHONE_TEST_PATTERNS` - Common test patterns

## Migration Examples

### Before (Failing Test)

```javascript
// ❌ FAILING PATTERN
test('should enable microphone when button is clicked', async ({ page }) => {
  await setupTestPage(page);
  await page.click('[data-testid="microphone-button"]');
  
  // This fails because agent isn't connected yet
  const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
  expect(micStatus).toBe('Enabled'); // ❌ FAILS - gets "Disabled"
});
```

### After (Fixed Test)

```javascript
// ✅ WORKING PATTERN
import { MicrophoneHelpers } from './helpers/test-helpers.js';

test('should enable microphone when button is clicked', async ({ page }) => {
  // Use the helper that handles the complete sequence
  const result = await MicrophoneHelpers.waitForMicrophoneReady(page);
  
  expect(result.success).toBe(true);
  expect(result.micStatus).toBe('Enabled'); // ✅ PASSES
});
```

## Migration Steps

### Step 1: Import the Helpers

```javascript
import { MicrophoneHelpers } from './helpers/test-helpers.js';
```

### Step 2: Replace Manual Sequence

**Replace this pattern:**
```javascript
await setupTestPage(page);
await page.click('[data-testid="microphone-button"]');
await page.waitForTimeout(3000);
const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
expect(micStatus).toBe('Enabled');
```

**With this pattern:**
```javascript
const result = await MicrophoneHelpers.waitForMicrophoneReady(page);
expect(result.success).toBe(true);
expect(result.micStatus).toBe('Enabled');
```

### Step 3: Choose the Right Helper

| Test Type | Use This Helper |
|-----------|----------------|
| Basic microphone activation | `waitForMicrophoneReady()` |
| Flaky test environment | `enableMicrophoneWithRetry()` |
| Comprehensive testing | `testMicrophoneFunctionality()` |
| Pre-activation validation | `verifyMicrophonePrerequisites()` |
| After idle timeout | `MICROPHONE_TEST_PATTERNS.activationAfterTimeout()` |

## Complete Migration Examples

### Example 1: Basic Microphone Test

```javascript
// Before
test('should enable microphone', async ({ page }) => {
  await setupTestPage(page);
  await page.click('[data-testid="microphone-button"]');
  await page.waitForTimeout(3000);
  const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
  expect(micStatus).toBe('Enabled');
});

// After
test('should enable microphone', async ({ page }) => {
  const result = await MicrophoneHelpers.waitForMicrophoneReady(page);
  expect(result.success).toBe(true);
  expect(result.micStatus).toBe('Enabled');
});
```

### Example 2: VAD Elements Test

```javascript
// Before
test('should show VAD elements', async ({ page }) => {
  await setupTestPage(page);
  await page.click('[data-testid="microphone-button"]');
  await page.waitForTimeout(2000);
  
  await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-speaking"]')).toBeVisible();
});

// After
test('should show VAD elements', async ({ page }) => {
  const result = await MicrophoneHelpers.testMicrophoneFunctionality(page);
  expect(result.success).toBe(true);
  expect(result.vadElements.vadStates).toBe(true);
  expect(result.vadElements.userSpeaking).toBe(true);
});
```

### Example 3: Retry Logic Test

```javascript
// Before
test('should handle flaky microphone activation', async ({ page }) => {
  await setupTestPage(page);
  
  // Multiple attempts with manual retry logic
  let success = false;
  for (let i = 0; i < 3; i++) {
    try {
      await page.click('[data-testid="microphone-button"]');
      await page.waitForTimeout(3000);
      const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
      if (micStatus === 'Enabled') {
        success = true;
        break;
      }
    } catch (error) {
      await page.reload();
    }
  }
  expect(success).toBe(true);
});

// After
test('should handle flaky microphone activation', async ({ page }) => {
  const success = await MicrophoneHelpers.enableMicrophoneWithRetry(page, {
    maxRetries: 3,
    retryDelay: 2000
  });
  expect(success).toBe(true);
});
```

## Files to Migrate

The following test files need to be updated:

- `microphone-functionality.spec.js`
- `vad-realistic-audio.spec.js` 
- `simple-mic-test.spec.js`
- `microphone-activation-after-idle-timeout.spec.js`
- `idle-timeout-behavior.spec.js`
- `microphone-reliability.spec.js`
- And ~35 other microphone-related tests

## Benefits of Migration

1. **Reliability**: Proper sequence ensures tests pass consistently
2. **Maintainability**: Centralized logic in one utility
3. **Debugging**: Better error messages and logging
4. **Retry Logic**: Built-in handling of flaky test environments
5. **Validation**: Comprehensive prerequisite checking

## Testing the Migration

After migrating tests, verify they work by running:

```bash
cd test-app
npm run test:e2e -- --grep "microphone"
```

The migrated tests should now pass consistently instead of failing with "Expected: Enabled, Received: Disabled" errors.
