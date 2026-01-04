# Issue #353: Test Strategy for Binary JSON Message Handling

## Problem

Our comprehensive unit tests for binary JSON message handling are hitting jsdom limitations:
- `Blob.arrayBuffer()` method not fully supported in jsdom
- `TextEncoder`/`TextDecoder` may need polyfills
- Some tests require real browser APIs

## Two Approaches

### Approach 1: Polyfill in Jest (Recommended for Unit Tests)

**Pros:**
- Fast unit tests
- Can test logic in isolation
- No need for real browser

**Cons:**
- Requires maintaining polyfills
- May not catch all browser-specific issues
- Polyfills might not match browser behavior exactly

**Implementation:**
1. Install a polyfill library (e.g., `blob-polyfill`, `text-encoding`)
2. Add polyfills to `jest.setup.js` or test file
3. Keep all tests in Jest

**Example:**
```bash
npm install --save-dev blob-polyfill text-encoding
```

```javascript
// jest.setup.js
import 'blob-polyfill';
import { TextEncoder, TextDecoder } from 'text-encoding';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
```

### Approach 2: Promote to Playwright E2E Tests (Recommended for Integration)

**Pros:**
- Tests run in real browsers with full API support
- More realistic testing
- Catches browser-specific issues
- No polyfill maintenance

**Cons:**
- Slower than unit tests
- Requires real API keys
- More complex setup

**Implementation:**
1. Move Blob-specific tests to E2E test suite
2. Keep ArrayBuffer tests in Jest (they work fine)
3. Test full integration flow in Playwright

## Recommended Hybrid Approach

**Best of both worlds:**

1. **Keep ArrayBuffer tests in Jest** ✅
   - These work perfectly in jsdom
   - Fast unit tests
   - Test core logic

2. **Move Blob tests to Playwright** ✅
   - Real browser APIs
   - Test full integration
   - More realistic

3. **Add minimal polyfill for TextEncoder** ✅
   - Simple polyfill in test file
   - Only for ArrayBuffer tests that need it

## Test Organization

### Jest Unit Tests (`tests/websocket-binary-json.test.ts`)
- ✅ ArrayBuffer binary JSON handling
- ✅ Text JSON messages (backward compatibility)
- ✅ Error handling logic
- ✅ Edge cases with ArrayBuffer

### Playwright E2E Tests (`test-app/tests/e2e/issue-353-binary-json-messages.spec.js`)
- ✅ Blob binary JSON handling (real browser)
- ✅ Full integration flow
- ✅ Proxy mode testing
- ✅ Real Deepgram API testing

## Decision Matrix

| Test Type | Current Location | Recommended Location | Reason |
|-----------|------------------|---------------------|--------|
| ArrayBuffer binary JSON | Jest | ✅ Jest | Works perfectly in jsdom |
| Blob binary JSON | Jest | ✅ Playwright | Needs real browser APIs |
| Text JSON (backward compat) | Jest | ✅ Jest | Works in jsdom |
| Error handling | Jest | ✅ Jest | Logic testing, no browser APIs needed |
| Edge cases (ArrayBuffer) | Jest | ✅ Jest | Works in jsdom |
| Edge cases (Blob) | Jest | ✅ Playwright | Needs real browser |
| Full integration | E2E | ✅ Playwright | Already in E2E |

## Implementation Steps

1. **Keep working Jest tests** (ArrayBuffer, text JSON, error handling)
2. **Move Blob tests to Playwright** (update E2E test)
3. **Remove incomplete polyfills** from Jest test file
4. **Add TextEncoder polyfill** if needed for ArrayBuffer tests
5. **Update test documentation**

## Benefits

- ✅ Fast unit tests for core logic
- ✅ Real browser testing for Blob scenarios
- ✅ No polyfill maintenance burden
- ✅ Clear separation of concerns
- ✅ Tests run in appropriate environments

