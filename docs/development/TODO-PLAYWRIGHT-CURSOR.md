# Playwright browser launch in Cursor session

**Issue:** When running E2E from the Cursor agent/sandbox, Playwright can fail with:

```text
Error: browserType.launch: Executable doesn't exist at .../playwright/chromium_headless_shell-...
npx playwright install
```

**Context:** E2E runs fine in the user's own session (e.g. `npm run test:e2e` from `test-app/`). Another project may work in Cursor if its Playwright browsers were already installed in that environment.

## Resolution

Playwright installs the browser binaries on first use or via an explicit install. In a fresh Cursor/sandbox environment (or new clone), the browsers are often not present.

**Before running E2E in Cursor (or any environment where you see the "Executable doesn't exist" error):**

1. From **test-app** (where Playwright is a devDependency):
   ```bash
   cd test-app
   npx playwright install chromium
   ```
   Or install all browsers: `npx playwright install`

2. Then run E2E as usual:
   ```bash
   npm run test:e2e -- --grep "your-test-pattern"
   ```

**If install fails in Cursor** (e.g. sandbox blocks writing to the Playwright cache dir, or install is rejected): run E2E from your own terminal outside Cursor, where `npm run test:e2e` already works. The agent can still edit specs and helpers; you run the tests locally until Cursor/sandbox allows browser install.
