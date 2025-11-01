/**
 * Shared fixtures and helpers for idle timeout tests
 * 
 * Provides reusable utilities for common idle timeout test patterns
 * to reduce duplication and ensure consistent test behavior.
 */

import { expect } from '@playwright/test';

/**
 * Wait for idle timeout to fire and connection to close
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {number} options.expectedTimeout - Expected timeout in ms (default: 10000)
 * @param {number} options.maxWaitTime - Maximum wait time in ms (default: expectedTimeout + 5000)
 * @param {number} options.checkInterval - Interval to check status in ms (default: 1000)
 * @returns {Promise<{actualTimeout: number, expectedTimeout: number, closed: boolean}>}
 */
export async function waitForIdleTimeout(page, options = {}) {
  const {
    expectedTimeout = 10000,
    maxWaitTime = expectedTimeout + 5000,
    checkInterval = 1000
  } = options;

  const startTime = Date.now();
  const maxChecks = Math.ceil(maxWaitTime / checkInterval);
  let connectionClosed = false;
  let closeTime = null;

  for (let i = 0; i < maxChecks; i++) {
    await page.waitForTimeout(checkInterval);
    
    const currentStatus = await page.locator('[data-testid="connection-status"]').textContent();
    const elapsed = Date.now() - startTime;
    
    if (currentStatus === 'closed') {
      connectionClosed = true;
      closeTime = Date.now();
      console.log(`✅ Connection closed after ${elapsed}ms (expected: ~${expectedTimeout}ms)`);
      break;
    }
    
    // Log progress every 5 seconds
    if (i % 5 === 0 && elapsed > 0) {
      console.log(`⏳ +${elapsed}ms: Connection still ${currentStatus}`);
    }
  }

  const actualTimeout = closeTime ? closeTime - startTime : null;

  return {
    actualTimeout,
    expectedTimeout,
    closed: connectionClosed,
    elapsed: Date.now() - startTime
  };
}

/**
 * Wait for agent to become idle (finish speaking/playing)
 * @deprecated Use waitForAgentGreeting from test-helpers.js instead
 * This is a compatibility shim - it calls waitForAgentGreeting
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout in ms (default: 15000)
 * @returns {Promise<number>} Timestamp when agent became idle
 */
export async function waitForAgentIdle(page, timeout = 15000) {
  // Import here to avoid circular dependency
  const { waitForAgentGreeting } = await import('../helpers/test-helpers.js');
  await waitForAgentGreeting(page, timeout);
  return Date.now(); // Return timestamp for compatibility
}

/**
 * Verify idle timeout timing is within expected range
 * @param {number} actualTimeout - Actual timeout in ms
 * @param {number} expectedTimeout - Expected timeout in ms (default: 10000)
 * @param {number} tolerance - Tolerance in ms (default: 5000)
 * @returns {boolean} True if timing is acceptable
 */
export function verifyIdleTimeoutTiming(actualTimeout, expectedTimeout = 10000, tolerance = 5000) {
  const minTime = expectedTimeout - tolerance;
  const maxTime = expectedTimeout + tolerance;
  const isWithinRange = actualTimeout >= minTime && actualTimeout <= maxTime;
  
  if (!isWithinRange) {
    console.log(`⚠️  Timeout timing outside expected range: ${actualTimeout}ms (expected: ${minTime}-${maxTime}ms)`);
  } else {
    console.log(`✅ Timeout timing within expected range: ${actualTimeout}ms`);
  }
  
  return isWithinRange;
}

/**
 * Monitor connection status over time for debugging
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} duration - Duration to monitor in ms (default: 30000)
 * @param {number} interval - Check interval in ms (default: 1000)
 * @returns {Promise<Array<{time: number, status: string}>>} Array of status snapshots
 */
export async function monitorConnectionStatus(page, duration = 30000, interval = 1000) {
  const startTime = Date.now();
  const snapshots = [];
  const maxChecks = Math.ceil(duration / interval);
  
  console.log(`📊 Monitoring connection status for ${duration}ms...`);
  
  for (let i = 0; i < maxChecks; i++) {
    await page.waitForTimeout(interval);
    
    const status = await page.locator('[data-testid="connection-status"]').textContent();
    const elapsed = Date.now() - startTime;
    
    snapshots.push({ time: elapsed, status });
    
    // Log every 5 seconds
    if (i % 5 === 0) {
      console.log(`  +${elapsed}ms: ${status}`);
    }
    
    // Stop early if connection closed
    if (status === 'closed') {
      console.log(`✅ Connection closed at +${elapsed}ms`);
      break;
    }
  }
  
  return snapshots;
}

