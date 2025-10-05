# E2E Tests for Deepgram Voice Agent

## ⚠️ IMPORTANT: Real API Key Required

These E2E tests use **REAL Deepgram WebSocket connections**, not mocks. This provides authentic integration testing but requires a valid Deepgram API key.

## Setup

### 1. Get a Deepgram API Key
- Sign up at [https://deepgram.com](https://deepgram.com)
- Get a free API key (includes free credits for testing)

### 2. Configure Environment Variables
Create or update `test-app/.env` with your real API credentials:

```bash
# Required for E2E tests
VITE_DEEPGRAM_API_KEY=your-real-deepgram-api-key-here
VITE_DEEPGRAM_PROJECT_ID=your-real-project-id-here

# Optional configuration
VITE_DEEPGRAM_MODEL=nova-2
VITE_DEEPGRAM_LANGUAGE=en-US
VITE_DEEPGRAM_VOICE=aura-asteria-en
```

### 3. Run Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/auto-connect-dual-mode.spec.js

# Run with UI
npm run test:e2e:ui
```

## Why Real API Key Instead of Mocks?

| Real API Key | Mocked API |
|--------------|------------|
| ✅ Authentic integration testing | ❌ Mock behavior may drift from real |
| ✅ Catches real connection issues | ❌ Misses integration problems |
| ✅ Tests actual WebSocket protocols | ❌ Complex mock maintenance |
| ✅ Zero mock development time | ❌ 13-19 hours of mock development |
| ✅ Always up-to-date with API changes | ❌ Mocks need constant updates |

## Test Files

- **`auto-connect-dual-mode.spec.js`** - Tests auto-connect behavior and dual mode functionality
- **`microphone-control.spec.js`** - Tests microphone enable/disable and state management  
- **`text-only-conversation.spec.js`** - Tests text-only conversation without audio

## Troubleshooting

### Tests Fail with "Connection Closed"
- Check that `VITE_DEEPGRAM_API_KEY` is set in `test-app/.env`
- Verify the API key is valid and has credits
- Ensure the API key is not a placeholder value

### Tests Fail with "API Key Required"
- The test app will show a red error banner if the API key is missing
- Follow the instructions in the error banner to set up your `.env` file

### Component Not Ready / Microphone Button Disabled
- This usually means the component couldn't connect to Deepgram
- Check your API key and network connection
- Look for console errors in the browser

## Alternative Testing

If you need to run tests without a real API key:

1. **Use Jest Unit Tests**: `npm test` (uses mocks)
2. **Use Component Tests**: `npm run test:components` (isolated testing)
3. **Set up Test Account**: Get a free Deepgram account for testing

## Cost Considerations

- Deepgram offers free credits for new accounts
- E2E tests use minimal API calls (just connection + greeting)
- Estimated cost: < $1/month for regular testing
- Much cheaper than 13-19 hours of mock development time
