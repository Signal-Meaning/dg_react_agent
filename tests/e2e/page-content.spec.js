/**
 * Page Content Test
 * 
 * This test just checks what's actually on the page
 */

import { test, expect } from '@playwright/test';

test.describe('Page Content Tests', () => {
  
  test('should check what elements are on the page', async ({ page }) => {
    // Navigate to test app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'test-results/page-content.png' });
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get all text content
    const bodyText = await page.locator('body').textContent();
    console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));
    
    // Check for any buttons
    const buttons = await page.locator('button').count();
    console.log('Number of buttons found:', buttons);
    
    // Check for any elements with data-testid
    const testIds = await page.locator('[data-testid]').count();
    console.log('Number of elements with data-testid:', testIds);
    
    // List all data-testid values
    const testIdElements = await page.locator('[data-testid]').all();
    console.log('Data-testid elements:');
    for (const element of testIdElements) {
      const testId = await element.getAttribute('data-testid');
      const tagName = await element.evaluate(el => el.tagName);
      console.log(`  ${tagName}[data-testid="${testId}"]`);
    }
    
    // Test passes if we can access the page
    expect(title).toBeDefined();
  });
});
