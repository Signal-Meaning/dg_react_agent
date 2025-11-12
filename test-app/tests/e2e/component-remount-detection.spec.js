/**
 * Component Remount Detection Test
 * 
 * This test reproduces Issue #276: Component remounting on transcript updates
 * 
 * The component should remain stable (≤2 mounts: initial + StrictMode) during
 * normal operation, even when transcript updates trigger parent re-renders.
 * 
 * Uses audio fixtures to stream pre-recorded audio samples in real-time,
 * which generates transcripts and triggers parent component re-renders.
 */

import { test, expect } from '@playwright/test';
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { 
  BASE_URL,
  buildUrlWithParams
} from './helpers/test-helpers.mjs';

test.describe('Component Remount Detection (Issue #276)', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions before navigation
    await context.grantPermissions(['microphone']);
  });
  
  test('should not remount on transcript updates', async ({ page }) => {
    console.log('🔧 Testing component remounting behavior during transcript updates...');
    
    // Capture console logs to track component initialization
    const initLogs = [];
    const mountIds = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
      // Capture component initialization logs
      if (text.includes('[Component] DeepgramVoiceInteraction') && 
          (text.includes('initialized') || text.includes('Component initialized'))) {
        initLogs.push({
          text,
          timestamp: Date.now()
        });
        
        // Extract mountId from log (handle both old and new log formats)
        try {
          // Try to parse as JSON first (new format)
          if (text.includes('{')) {
            const jsonMatch = text.match(/\{([^}]+)\}/);
            if (jsonMatch) {
              const jsonStr = '{' + jsonMatch[1] + '}';
              const parsed = JSON.parse(jsonStr);
              if (parsed.mountId) {
                mountIds.push(parsed.mountId);
              }
            }
          }
          
          // Fallback: regex extraction
          const match = text.match(/mountId["\s:]+([^,}\s"']+)/);
          if (match && !mountIds.includes(match[1])) {
            mountIds.push(match[1]);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    
    // Navigate to test app first (MicrophoneHelpers will also navigate, but we need to set up console logging first)
    await page.goto(buildUrlWithParams(BASE_URL, { 'test-mode': 'true' }));
    
    // Use MicrophoneHelpers for reliable microphone activation and connection
    // This handles: component ready, mic click, connection, greeting
    // Note: MicrophoneHelpers will navigate again, but that's okay for this test
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    if (!micResult.success) {
      throw new Error(`Microphone activation failed: ${micResult.error}`);
    }
    
    console.log('✅ Connection established and settings applied');
    
    // Wait for initial mounts to settle (component + StrictMode if in dev)
    await page.waitForTimeout(1000);
    
    const initialMountCount = initLogs.length;
    const initialMountIds = [...mountIds];
    
    console.log(`📊 Initial mounts detected: ${initialMountCount}`);
    console.log(`📊 Initial mount IDs: ${initialMountIds.join(', ')}`);
    
    // Now stream audio to generate transcripts
    // This will trigger parent component re-renders via onTranscriptUpdate callback
    // The component should NOT remount during this process
    const sampleName = 'shopping-concierge-question';
    console.log(`🎤 Loading and streaming pre-recorded audio sample: ${sampleName}...`);
    console.log('   This will generate transcripts and trigger parent re-renders...');
    
    // Stream audio in real-time chunks (this generates interim + final transcripts)
    await loadAndSendAudioSample(page, sampleName);
    
    console.log(`✅ Audio sample streamed: ${sampleName}`);
    
    // Wait for transcripts to be processed and any remounts to occur
    await page.waitForTimeout(2000);
    
    const finalMountCount = initLogs.length;
    const finalMountIds = [...mountIds];
    
    console.log(`📊 Final mounts detected: ${finalMountCount}`);
    console.log(`📊 All mount IDs: ${finalMountIds.join(', ')}`);
    
    // Count unique mount IDs
    const uniqueMountIds = new Set(finalMountIds);
    const uniqueMountCount = uniqueMountIds.size;
    const remountsDuringTranscription = finalMountCount - initialMountCount;
    
    console.log(`📊 Unique mount IDs: ${uniqueMountCount}`);
    console.log(`📊 Remounts during transcription: ${remountsDuringTranscription}`);
    
    // Component should mount at most 2 times:
    // 1. Initial mount
    // 2. StrictMode re-mount (in development)
    // Any additional mounts indicate the remounting bug
    expect(uniqueMountCount).toBeLessThanOrEqual(2);
    
    if (uniqueMountCount > 2 || remountsDuringTranscription > 0) {
      console.error(`❌ BUG REPRODUCED: Component remounted ${remountsDuringTranscription} time(s) during transcription`);
      console.error(`   Total unique mounts: ${uniqueMountCount} (expected ≤2)`);
      console.error(`   Mount IDs: ${Array.from(uniqueMountIds).join(', ')}`);
      console.error(`   Mount logs:`, initLogs.map(log => ({
        time: new Date(log.timestamp).toISOString(),
        text: log.text.substring(0, 150)
      })));
      throw new Error(`Component remounted ${remountsDuringTranscription} time(s) during transcription (expected 0)`);
    } else {
      console.log('✅ Component remained stable - no excessive remounting detected');
    }
  });
});

