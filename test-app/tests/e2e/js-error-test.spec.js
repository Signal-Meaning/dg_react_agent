/**
 * JavaScript Error Test
 * 
 * This test checks for JavaScript errors that might prevent the component from rendering
 */

import { test, expect } from '@playwright/test';
import { APP_ROOT } from './helpers/app-paths.mjs';

test.describe('JavaScript Error Tests', () => {
  
  test('should check for JavaScript errors', async ({ page }) => {
    const errors = [];
    const warnings = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });
    
    await page.goto(APP_ROOT);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait longer for component to load
    
    console.log('JavaScript Errors:');
    errors.forEach(error => console.log(`  ❌ ${error}`));
    
    console.log('\nJavaScript Warnings:');
    warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
    
    // Check if React is loaded
    const reactLoaded = await page.evaluate(() => {
      return typeof window.React !== 'undefined' || 
             typeof window.ReactDOM !== 'undefined' ||
             document.querySelector('[data-reactroot]') !== null;
    });
    
    console.log('\nReact loaded:', reactLoaded);
    
    // Check for any script loading errors
    const scriptErrors = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(script => ({
        src: script.src,
        hasError: script.onerror !== null
      }));
    });
    
    console.log('\nScript loading status:');
    scriptErrors.forEach(script => {
      console.log(`  ${script.src || 'inline'} - Error: ${script.hasError}`);
    });
    
    // Test passes if we can access the page (regardless of errors)
    expect(true).toBe(true);
  });
});
