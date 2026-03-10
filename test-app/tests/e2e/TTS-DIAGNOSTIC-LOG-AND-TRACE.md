# TTS diagnostic spec: log and trace location

For the failing spec `openai-proxy-tts-diagnostic.spec.js`, tee output to a log and capture the trace on failure so both can be inspected later.

## Tee run to a log

From **test-app**:

```bash
PW_ARTIFACTS_ON_FAILURE=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-tts-diagnostic.spec.js 2>&1 | tee tests/e2e/logs/openai-proxy-tts-diagnostic-run.log
```

- **Log file:** `test-app/tests/e2e/logs/openai-proxy-tts-diagnostic-run.log` (directory `logs` is gitignored; create it with `mkdir -p tests/e2e/logs` if needed).
- **Trace:** Only saved when the test **fails** and `PW_ARTIFACTS_ON_FAILURE=1` is set.

## Locating the trace when the test fails

- **Trace:** Under **`test-app/test-results/`**. Look for a project folder (e.g. `chromium`) containing a `.zip` trace file. Open it with:
  ```bash
  cd test-app && npx playwright show-trace test-results/<path-to-trace.zip>
  ```
  Or open the HTML report and use the failed test’s “Trace” link.

- **HTML report:** **`test-app/playwright-report/`**. Open with:
  ```bash
  cd test-app && npx playwright show-report
  ```

- **JSON/JUnit:** `test-app/test-results/results.json`, `test-results/results.xml`.
