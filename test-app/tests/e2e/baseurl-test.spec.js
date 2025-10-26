import { test, expect } from '@playwright/test';

test('baseURL test', async ({ page }) => {
  console.log('Navigating to http://localhost:5173');
  await page.goto('http://localhost:5173');
  console.log('Page loaded, title:', await page.title());
  await expect(page).toHaveTitle(/Vite \+ React \+ TS/);
});
