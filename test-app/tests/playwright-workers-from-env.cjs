/**
 * Single source for Playwright `workers` when env flags require serial real-API runs.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number | undefined} 1 to force serial; undefined = Playwright default parallelism
 */
function getPlaywrightWorkers(env = process.env) {
  if (env.CI === '1' || env.CI === 'true') return 1;
  // Real upstream + shared backend: parallel files (e.g. Live + OpenAI suite) contend and can
  // flake partner function-call timing (Issue #560 / #462 E2E).
  if (env.USE_REAL_APIS === '1' || env.USE_REAL_APIS === 'true') return 1;
  return undefined;
}

module.exports = { getPlaywrightWorkers };
