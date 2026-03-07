# E2E / Playwright run notes (Issue #489)

**Current E2E failure status and next steps:** See [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md). Integration tests (real API) prove the client receives AgentAudioDone after FunctionCallResponse; the remaining failure is issue-373 "re-enable idle timeout after function calls complete" (component/E2E env).

## Why not reinstall browsers from the agent?

The project and Cursor sandbox are set up so that:

- **Config fallback:** Both `playwright.config.js` (root) and `test-app/tests/playwright.config.mjs` set `PLAYWRIGHT_BROWSERS_PATH` **only when unset** (`if (!process.env.PLAYWRIGHT_BROWSERS_PATH)`), so a pre-set value (e.g. from the sandbox) is not overwritten.
- **Project-local path:** The npm scripts set `PLAYWRIGHT_BROWSERS_PATH` to `test-app/.playwright-browsers` so local runs and the project share one install; the config uses the same path when the env is unset.
- **No reinstall from agent:** We do **not** run `npx playwright install` from the agent/sandbox because (1) the sandbox may not have network or write access to the right place, and (2) the improvement is to use the existing project/sandbox setup, not to reinstall.

## What went wrong (recent run)

When rerunning the two E2E tests (interruptAgent + TTS diagnostic) with real APIs:

1. **First attempt:** The command was run from **test-app** with an **ad-hoc** shell command that **explicitly set** `PLAYWRIGHT_BROWSERS_PATH=$(node -p "require('path').resolve(process.cwd(), '.playwright-browsers')")`. That pointed to `test-app/.playwright-browsers`, which in the **sandbox** can be empty or not present (e.g. gitignored, or not mounted) → “Executable doesn’t exist at ... test-app/.playwright-browsers/...”.
2. **Second attempt:** Ran from **repo root** and **did not** set `PLAYWRIGHT_BROWSERS_PATH`. Playwright then used the **sandbox cache** path (`/var/folders/.../cursor-sandbox-cache/.../playwright/`), where the browser binary is also not installed → same error.
3. **Conclusion:** In the agent sandbox, neither the project-local path nor the default/sandbox cache path currently has Playwright browsers installed. The **intended** setup is that the config only sets the path when unset (so sandbox can provide one), and we do not reinstall from the agent. Running these two tests with **real APIs** needs to be done **from your own terminal** (outside the agent), where `test-app/.playwright-browsers` is populated (e.g. after `npm run playwright:install-browsers` from root or test-app).

## How to run the two tests with real APIs (from your terminal)

**Use npm scripts** (see `.cursorrules` and `docs/development/TEST-STRATEGY.md`). From **test-app**, with browsers already installed (e.g. `npm run playwright:install-browsers` once):

```bash
cd test-app && npm run test:e2e -- tests/e2e/declarative-props-api.spec.js tests/e2e/openai-proxy-tts-diagnostic.spec.js --grep "should interrupt TTS when interruptAgent prop is true|diagnose TTS path"
```

Or use the dedicated script: `npm run test:e2e:openai` for the OpenAI proxy E2E set. Ensure `test-app/.env` (and proxy/backend if needed) is configured for real APIs. The interruptAgent test is skipped in CI; it runs when not in CI and when real API is available (`skipIfNoRealAPI()`).
