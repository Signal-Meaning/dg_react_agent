/**
 * @jest-environment node
 */
const { getPlaywrightWorkers } = require('./playwright-workers-from-env.cjs');

describe('getPlaywrightWorkers', () => {
  test('CI=1 forces single worker', () => {
    expect(getPlaywrightWorkers({ CI: '1' })).toBe(1);
  });

  test('CI=true forces single worker', () => {
    expect(getPlaywrightWorkers({ CI: 'true' })).toBe(1);
  });

  test('USE_REAL_APIS=1 forces single worker (real-API E2E qualification)', () => {
    expect(getPlaywrightWorkers({ USE_REAL_APIS: '1' })).toBe(1);
  });

  test('USE_REAL_APIS=true forces single worker', () => {
    expect(getPlaywrightWorkers({ USE_REAL_APIS: 'true' })).toBe(1);
  });

  test('CI wins when both set', () => {
    expect(getPlaywrightWorkers({ CI: '1', USE_REAL_APIS: '1' })).toBe(1);
  });

  test('empty env returns undefined (Playwright default parallelism)', () => {
    expect(getPlaywrightWorkers({})).toBeUndefined();
  });
});
