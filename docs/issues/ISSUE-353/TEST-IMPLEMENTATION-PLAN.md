# Issue #353: Test Implementation Plan

## Recommended Approach: Hybrid Strategy

**Keep ArrayBuffer tests in Jest, move Blob tests to Playwright**

## Rationale

1. **ArrayBuffer tests work perfectly in Jest/jsdom** ✅
   - No polyfills needed
   - Fast unit tests
   - Test core logic

2. **Blob tests need real browser APIs** ✅
   - `Blob.arrayBuffer()` requires real browser
   - E2E tests already test full integration
   - More realistic testing

3. **Clear separation of concerns** ✅
   - Unit tests = fast, isolated logic testing
   - E2E tests = full integration, real browser

## Implementation Steps

### Step 1: Clean up Jest tests (Keep only what works)

**File:** `tests/websocket-binary-json.test.ts`

**Keep:**
- ✅ ArrayBuffer binary JSON tests (all work)
- ✅ Text JSON backward compatibility tests
- ✅ Error handling tests (logic, no browser APIs)
- ✅ Edge cases with ArrayBuffer

**Remove:**
- ❌ Blob-specific tests (move to Playwright)
- ❌ Complex polyfills (not needed for ArrayBuffer)

### Step 2: Enhance Playwright E2E test

**File:** `test-app/tests/e2e/issue-353-binary-json-messages.spec.js`

**Add:**
- ✅ Blob binary JSON test cases
- ✅ Test with real Deepgram API
- ✅ Test in proxy mode
- ✅ Test all agent message types as binary Blob

### Step 3: Optional - Add simple polyfill library (if we want some Blob tests in Jest)

**Option A: Use a library**
```bash
npm install --save-dev blob-polyfill
```

**Option B: Skip Blob tests in Jest, test only in Playwright** (Recommended)

## Test Coverage After Implementation

### Jest Unit Tests (Fast, Isolated)
- ✅ ArrayBuffer with FunctionCallRequest → 'message' event
- ✅ ArrayBuffer with SettingsApplied → 'message' event  
- ✅ ArrayBuffer with ConversationText → 'message' event
- ✅ ArrayBuffer with Error → 'message' event
- ✅ ArrayBuffer with non-JSON → 'binary' event
- ✅ ArrayBuffer with invalid UTF-8 → 'binary' event
- ✅ Text JSON messages → 'message' event (backward compat)
- ✅ Empty ArrayBuffer → 'binary' event
- ✅ Large ArrayBuffer JSON → 'message' event

### Playwright E2E Tests (Real Browser, Full Integration)
- ✅ Blob with FunctionCallRequest → 'message' event
- ✅ Blob with other agent messages → 'message' event
- ✅ Blob with non-JSON → 'binary' event
- ✅ Full integration flow in proxy mode
- ✅ Real Deepgram API testing

## Benefits

1. **Fast unit tests** - ArrayBuffer tests run quickly in Jest
2. **Real browser testing** - Blob tests use actual browser APIs
3. **No polyfill maintenance** - No need to maintain custom polyfills
4. **Clear test purpose** - Each test type in appropriate environment
5. **Comprehensive coverage** - Both formats tested thoroughly

## Decision: Which Approach?

**Recommendation: Hybrid (Option B - No polyfill library)**

- Keep ArrayBuffer tests in Jest ✅
- Move Blob tests to Playwright ✅
- No polyfill library needed ✅
- Simpler, cleaner codebase ✅

**Alternative: Add polyfill library (Option A)**

- Keep all tests in Jest
- Requires maintaining polyfill
- May not catch browser-specific issues
- More complex setup

## Next Actions

1. ✅ Create test strategy document (this file)
2. ⏳ Refactor Jest tests (remove Blob tests, keep ArrayBuffer)
3. ⏳ Enhance Playwright E2E test (add Blob test cases)
4. ⏳ Update tracking document
5. ⏳ Verify all tests pass

