# TODO: Playwright browser launch in Cursor session

**Issue:** When running E2E from the Cursor agent/sandbox, Playwright fails with:

```text
Error: browserType.launch: Executable doesn't exist at .../playwright/chromium_headless_shell-...
npx playwright install
```

**Context:** E2E runs fine in the user’s own session (e.g. `npm run test:e2e` from `test-app/`). Another project works in Cursor. So this is specific to this repo / Cursor environment.

**Goal:** Figure out together why Playwright browsers aren’t available or aren’t found in the Cursor session (cache path, install step, or env) so E2E can be run from Cursor when needed.

**No code change required until we diagnose** — leave as TODO.
