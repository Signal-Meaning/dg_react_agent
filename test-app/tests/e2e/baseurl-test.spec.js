import { test, expect } from '@playwright/test';
import { APP_ROOT } from './helpers/app-paths.mjs';

test('baseURL test', async ({ page }) => {
  console.log('Navigating to app (baseURL from Playwright config)');
  await page.goto(APP_ROOT);
  console.log('Page loaded, title:', await page.title());
  await expect(page).toHaveTitle(/Vite \+ React \+ TS/);
});
