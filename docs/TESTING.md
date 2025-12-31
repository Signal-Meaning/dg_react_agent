# Testing Guide

## Overview

This project uses a **hybrid testing strategy** that separates concerns for maximum reliability and maintainability:

1. **Unit/Integration Tests (Jest + jsdom)** - Component logic with mocks
2. **WebSocket Connectivity Tests (Jest + Node.js)** - Real API connections
3. **E2E Tests (Playwright)** - Full browser integration

## Test Environments

### Jest with jsdom (Component Tests)

**Purpose:** Test React component logic, state management, and event handling.

**Environment:** `@jest-environment jsdom`

**WebSocket:** Uses MockWebSocket (from `tests/setup.js`)

**When to Use:**
- Testing component rendering
- Testing state management
- Testing event handlers
- Testing prop handling
- Fast, isolated unit tests

**Example:**
```typescript
/**
 * @jest-environment jsdom
 */
describe('Component Tests', () => {
  it('should handle connection state changes', () => {
    // Uses MockWebSocket - fast and isolated
  });
});
```

### Jest with Node.js (WebSocket Connectivity Tests)

**Purpose:** Test actual Deepgram API connections without jsdom interference.

**Environment:** `@jest-environment node`

**WebSocket:** Uses real Node.js `ws` library

**When to Use:**
- Testing WebSocket connectivity
- Testing authentication
- Testing connection lifecycle
- Validating API compatibility

**Example:**
```javascript
/**
 * @jest-environment node
 */
describe('WebSocket Connectivity', () => {
  it('should connect to Deepgram API', async () => {
    const WebSocket = require('ws');
    const ws = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', 
      ['token', process.env.DEEPGRAM_API_KEY]);
    // Real connection test
  });
});
```

**Why Separate?**
- jsdom's WebSocket wrapper interferes with real connections
- Node.js environment provides clean WebSocket implementation
- Tests actual API connectivity without browser simulation

### Playwright (E2E Tests)

**Purpose:** Test full integration in real browser environment.

**Environment:** Real browser (Chromium, Firefox, WebKit)

**WebSocket:** Real browser WebSocket API

**When to Use:**
- Testing full user workflows
- Testing browser-specific behavior
- Testing audio/video APIs
- End-to-end integration testing

**Current Limitation:**
- Some E2E tests are blocked by automated browser detection
- See `docs/issues/ISSUE-341/AUTOMATED-BROWSER-RESTRICTIONS.md` for details

## Running Tests

### All Tests
```bash
npm test
```

### Unit/Integration Tests Only
```bash
npm test
# Runs all Jest tests (jsdom + node environments)
```

### WebSocket Connectivity Tests Only
```bash
DEEPGRAM_API_KEY=your-key npm test -- tests/integration/websocket-connectivity.test.js
```

### E2E Tests
```bash
cd test-app
npm run test:e2e
```

### Specific Test File
```bash
npm test -- path/to/test.file
```

### Comprehensive Test Run (All Test Types)

Run all test types in stages with comprehensive reporting:

```bash
./scripts/comprehensive-test-run.sh
```

**Features:**
- Runs all test types sequentially (Jest unit/integration, WebSocket connectivity, test-app unit/integration, E2E)
- Pauses between stages for inspection
- Generates comprehensive report in `test-results/comprehensive_TIMESTAMP/`
- Includes API mode detection (Real APIs vs Mock APIs)
- Creates individual log files for each test suite

**Report Location:**
- `test-results/comprehensive_TIMESTAMP/SUMMARY.md` - Markdown summary
- `test-results/comprehensive_TIMESTAMP/summary.json` - JSON summary
- `test-results/comprehensive_TIMESTAMP/*.log` - Individual suite logs

**Skip Prompts:**
```bash
SKIP_PROMPTS=true ./scripts/comprehensive-test-run.sh
```

**Understanding Test Results:**
- Each test suite reports its API mode (Real APIs or Mock APIs)
- E2E test failures include detailed failure list in SUMMARY.md
- Full error details available in individual log files
- Playwright HTML report available via `npm run test:e2e:report`

## Test Structure

```
tests/
├── unit/                    # Unit tests (jsdom + mocks)
├── integration/
│   ├── component.test.tsx   # React component tests (jsdom + MockWebSocket)
│   └── websocket-connectivity.test.js  # Real API tests (node + real WebSocket)
└── e2e/                     # E2E tests (Playwright)
```

## Best Practices

### ✅ DO

1. **Separate WebSocket tests from component tests**
   - Use `@jest-environment node` for WebSocket connectivity
   - Use `@jest-environment jsdom` with mocks for components

2. **Mock WebSocket for component tests**
   - Fast, isolated, reliable
   - Tests component logic without network dependencies

3. **Test real WebSocket connectivity separately**
   - Validates actual API compatibility
   - No jsdom interference
   - Can run in CI

4. **Use E2E tests for full integration**
   - Real browser environment
   - Catches integration issues
   - Most realistic testing

### ❌ DON'T

1. **Don't try to use real WebSocket in jsdom environment**
   - jsdom's WebSocket wrapper interferes
   - Custom environments are complex and fragile
   - Not worth the complexity

2. **Don't test WebSocket connectivity in component tests**
   - Mixes concerns
   - Slower and less reliable
   - Harder to maintain

3. **Don't rely solely on mocks for API validation**
   - Mocks don't validate real API compatibility
   - Need separate connectivity tests

## Environment Variables

### For Jest Tests:
- `DEEPGRAM_API_KEY` - Required for real WebSocket connectivity tests
- `CI=true` - Disables real API tests in CI (uses mocks)

### For E2E Tests:
- `VITE_DEEPGRAM_API_KEY` - Loaded from `test-app/.env`
- See `test-app/tests/e2e/README.md` for E2E-specific setup

## Troubleshooting

### Jest Tests Failing

**Issue:** WebSocket connection errors in jsdom tests
**Solution:** Use `@jest-environment node` for WebSocket tests, use mocks for component tests

**Issue:** Tests timing out
**Solution:** Check if using real API key - may need network access

### E2E Tests Failing

**Issue:** Connection fails with code 1006
**Solution:** See `docs/issues/ISSUE-341/AUTOMATED-BROWSER-RESTRICTIONS.md`

**Issue:** Tests skipped
**Solution:** Check `test-app/.env` has `VITE_DEEPGRAM_API_KEY` set

## Comprehensive Test Reports

When running comprehensive test passes, reports are generated in `test-results/comprehensive_TIMESTAMP/`:

**Report Contents:**
- `SUMMARY.md` - Human-readable summary with test results and API mode
- `summary.json` - Machine-readable JSON summary
- Individual `.log` files for each test suite

**Understanding E2E Test Failures:**
1. **Summary Report:** See `SUMMARY.md` for list of failed tests with descriptions
2. **Full Log:** Check `E2E_Tests_Playwright.log` for complete error messages
3. **Error Context:** Each failed test creates an `error-context.md` file in `test-results/` subdirectories
4. **Screenshots:** Failed tests include screenshots in their test-results subdirectories
5. **HTML Report:** Run `npm run test:e2e:report` for interactive Playwright HTML report

**API Mode Detection:**
- Reports indicate whether tests used Real APIs or Mock APIs
- Jest tests: Checks for `DEEPGRAM_API_KEY` in `.env` or `test-app/.env`
- E2E tests: Checks for `VITE_DEEPGRAM_API_KEY` in `test-app/.env`
- Validates API key format (length >= 20, not "mock" or placeholder)

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/)
- [WebSocket Testing Best Practices](./issues/ISSUE-341/JEST-WEBSOCKET-BEST-PRACTICES.md)
- [Issue #341 Documentation](./issues/ISSUE-341/README.md)

