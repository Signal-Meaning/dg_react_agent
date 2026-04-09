# Issue #262: Standalone Diagnostic Script

This script can be run in the browser console to diagnose why idle timeout isn't starting.

## How to Use

1. Open your voice-commerce app in the browser
2. Open browser DevTools (F12)
3. Go to Console tab
4. **Enable debug mode** (required to see idle-timeout service lines): add `?debug=true` to the URL or set component `debug={true}`. The "Started idle timeout" line is emitted at **debug** level and may be **debounced** when the countdown re-arms in quick succession (default 100ms — Issue #559).
5. Copy and paste this entire script into the console
6. Trigger an agent response (send a message or speak)
7. Wait for agent to finish speaking
8. Watch the console output

## Stable signal (recommended)

Whether or not a matching console line appears, the component sets `window.__idleTimeoutStarted__ === true` when the idle **countdown is actually armed** (every `setTimeout` start). Prefer this for automation:

```javascript
window.__idleTimeoutStarted__ === true
```

Playwright / E2E in this repo waits on that flag where the idle line is no longer guaranteed at **info** level.

## Diagnostic Script

```javascript
// Issue #262 Diagnostic Script
// Run this in browser console after agent finishes speaking

(function() {
  console.log('🔍 Issue #262 Diagnostic Script Started');
  console.log('==========================================\n');
  
  const logs = [];
  const originalLog = console.log;
  
  // Capture IdleTimeoutService-related console output (debug mode must be on for most lines)
  console.log = function(...args) {
    const text = args.join(' ');
    if (text.includes('[IDLE_TIMEOUT_SERVICE]') || 
        text.includes('Started idle timeout') ||
        text.includes('updateTimeoutBehavior') ||
        text.includes('handleEvent') ||
        text.includes('Idle timeout reached')) {
      logs.push({ text, timestamp: Date.now() });
      originalLog.apply(console, args);
    }
    originalLog.apply(console, args);
  };
  
  // Monitor agent state and playback state
  let lastAgentState = null;
  let lastPlaybackState = null;
  let checkCount = 0;
  const maxChecks = 30; // Check for 30 seconds
  
  const monitor = setInterval(() => {
    checkCount++;
    
    // Get agent state from DOM
    const agentStateEl = document.querySelector('[data-testid="agent-state"]');
    const agentState = agentStateEl ? agentStateEl.textContent : 'unknown';
    
    // Get playback state from DOM
    const playbackEl = document.querySelector('[data-testid="audio-playing-status"]');
    const playbackState = playbackEl ? playbackEl.textContent : 'unknown';
    
    // Get connection state
    const connectionEl = document.querySelector('[data-testid="connection-status"]');
    const connectionState = connectionEl ? connectionEl.textContent : 'unknown';
    
    // Log state changes
    if (agentState !== lastAgentState) {
      console.log(`[MONITOR] Agent state changed: ${lastAgentState} → ${agentState}`);
      lastAgentState = agentState;
    }
    
    if (playbackState !== lastPlaybackState) {
      console.log(`[MONITOR] Playback state changed: ${lastPlaybackState} → ${playbackState}`);
      lastPlaybackState = playbackState;
    }
    
    // Check if all conditions are idle
    if (agentState === 'idle' && playbackState === 'false' && connectionState === 'connected') {
      console.log(`[MONITOR] ✅ All idle conditions met (check ${checkCount}/${maxChecks})`);
      console.log(`[MONITOR]   - Agent state: ${agentState}`);
      console.log(`[MONITOR]   - Playback: ${playbackState}`);
      console.log(`[MONITOR]   - Connection: ${connectionState}`);
      console.log(`[MONITOR]   - Timeout should start now if not already started`);
    }
    
    // Stop monitoring after maxChecks or if connection closes
    if (checkCount >= maxChecks || connectionState === 'closed') {
      clearInterval(monitor);
      
      console.log('\n==========================================');
      console.log('🔍 DIAGNOSTIC RESULTS');
      console.log('==========================================\n');
      
      const countdownArmed = typeof window !== 'undefined' && window.__idleTimeoutStarted__ === true;

      // Analyze captured logs (optional when debug on)
      const startedTimeoutLog = logs.find(log => 
        log.text.includes('Started idle timeout') || 
        log.text.includes('startTimeout')
      );
      
      const timeoutReachedLog = logs.find(log =>
        log.text.includes('Idle timeout reached')
      );
      
      const handleEventLogs = logs.filter(log =>
        log.text.includes('handleEvent')
      );
      
      console.log(`📊 Summary:`);
      console.log(`  Total IdleTimeoutService logs: ${logs.length}`);
      console.log(`  window.__idleTimeoutStarted__: ${countdownArmed ? '✅ true' : '❌ false'}`);
      console.log(`  "Started idle timeout" console line: ${startedTimeoutLog ? '✅ FOUND' : '⚠️  MISSING (may be OK if flag is true — debounce or log level)'}`);
      console.log(`  "Idle timeout reached" log: ${timeoutReachedLog ? '✅ FOUND' : '❌ MISSING'}`);
      console.log(`  handleEvent calls: ${handleEventLogs.length}`);
      
      if (countdownArmed) {
        console.log(`\n✅ Idle countdown was armed (__idleTimeoutStarted__)`);
        if (startedTimeoutLog) {
          console.log(`   Matching console line: "${startedTimeoutLog.text}"`);
        }
      } else {
        console.log(`\n❌ BUG CONFIRMED: Countdown does not appear to have started (__idleTimeoutStarted__ is false)`);
        console.log(`   This matches Issue #262`);
        
        if (handleEventLogs.length > 0) {
          console.log(`\n   Events received by IdleTimeoutService:`);
          handleEventLogs.forEach((log, i) => {
            console.log(`     ${i + 1}. ${log.text}`);
          });
        } else {
          console.log(`\n   ⚠️  No events received by IdleTimeoutService!`);
          console.log(`   This suggests events aren't being sent from component.`);
        }
      }
      
      if (timeoutReachedLog) {
        console.log(`\n✅ Timeout fired correctly`);
        console.log(`   Log: "${timeoutReachedLog.text}"`);
      } else if (countdownArmed) {
        console.log(`\n⚠️  Countdown armed but close log not seen yet`);
        console.log(`   Check connection state and idle duration.`);
      }
      
      console.log(`\n📋 All IdleTimeoutService logs:`);
      if (logs.length > 0) {
        logs.forEach((log, i) => {
          console.log(`  ${i + 1}. ${log.text}`);
        });
      } else {
        console.log(`  ⚠️  No logs captured!`);
        console.log(`  Enable debug (?debug=true) to capture [IDLE_TIMEOUT_SERVICE] lines.`);
      }
      
      console.log('\n==========================================');
      console.log('🔍 Diagnostic Complete');
      console.log('==========================================\n');
    }
  }, 1000); // Check every second
  
  console.log('✅ Monitoring started. Waiting for agent to finish speaking...');
  console.log('   The script will analyze logs after 30 seconds or when connection closes.\n');
})();
```

## What to Look For

After running the script and waiting:

### ✅ If Working Correctly:
- `window.__idleTimeoutStarted__` is **true** after the agent is idle and playback has stopped
- With **debug** on, you may see a **debug**-level line containing `"Started idle timeout (10000ms)"` (exact ms depends on config; line can be **debounced** on rapid re-arms)
- You'll see: `"Idle timeout reached (10000ms) - firing callback"` (service debug) and/or the hook's **debug** line about closing the connection
- Connection closes after the configured idle period

### ❌ If Bug Exists:
- `window.__idleTimeoutStarted__` stays **false** after idle conditions are met
- Connection stays open until some other timeout
- You'll see which events (if any) were received by IdleTimeoutService

## Alternative: Minimal Test Code

If you want to add this to your test suite, here's a minimal version:

```javascript
// Minimal test for Issue #262
test('idle timeout should start after agent finishes speaking', async ({ page }) => {
  // Setup and trigger agent response
  await setupYourApp(page);
  await triggerAgentResponse(page);
  
  // Wait for agent to finish
  await waitForAgentIdle(page);
  
  await page.waitForFunction(
    () => typeof window !== 'undefined' && window.__idleTimeoutStarted__ === true,
    null,
    { timeout: 20000 }
  );
  
  // Wait for connection to close
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="connection-status"]')?.textContent === 'closed';
  }, { timeout: 20000 });
  
  expect(await page.evaluate(() => window.__idleTimeoutStarted__)).toBe(true);
});
```
