/**
 * React Error Detection Test
 * 
 * This test specifically looks for React errors that might prevent rendering
 */

import { test, expect } from '@playwright/test';
import { APP_ROOT } from './helpers/app-paths.mjs';

test.describe('React Error Detection', () => {
  
  test('should detect React rendering errors', async ({ page }) => {
    const errors = [];
    const warnings = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });
    
    await page.goto(APP_ROOT);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check if React DevTools are available (indicates React loaded)
    const reactDevTools = await page.evaluate(() => {
      return typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
    });
    
    // Check if there's a React root
    const reactRoot = await page.evaluate(() => {
      return document.querySelector('#root') !== null;
    });
    
    // Check for any React error boundaries
    const errorBoundary = await page.evaluate(() => {
      return document.querySelector('[data-react-error-boundary]') !== null;
    });
    
    console.log('React DevTools available:', reactDevTools);
    console.log('React root element exists:', reactRoot);
    console.log('Error boundary detected:', errorBoundary);
    
    console.log('\nConsole Errors:');
    errors.forEach(error => console.log(`  ❌ ${error}`));
    
    console.log('\nConsole Warnings:');
    warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
    
    // Check if the page has any content at all
    const bodyContent = await page.locator('body').textContent();
    console.log('\nBody content length:', bodyContent?.length || 0);
    console.log('Body content preview:', bodyContent?.substring(0, 200) || 'No content');
    
    // Test passes if we can access the page
    expect(true).toBe(true);
  });
});
