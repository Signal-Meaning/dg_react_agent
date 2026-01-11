import React from 'react';
import { WebSocketManager } from './websocket/WebSocketManager';

/**
 * Extended Window interface for global properties used by the component
 */
export interface WindowWithDeepgramGlobals extends Window {
  globalSettingsSent?: boolean;
  componentInitializationCount?: number;
  audioCaptureInProgress?: boolean;
  __DEEPGRAM_DEBUG_AGENT_OPTIONS__?: boolean;
  __DEEPGRAM_DEBUG_REMOUNTS__?: boolean;
  __DEEPGRAM_TEST_MODE__?: boolean;
  __DEEPGRAM_LAST_SETTINGS__?: unknown;
  __DEEPGRAM_LAST_FUNCTIONS__?: unknown;
}

/**
 * Helper function to check if Settings has been sent
 * @param hasSentSettingsRef - Ref tracking if SettingsApplied was received
 * @param windowWithGlobals - Window object with globalSettingsSent flag
 * @param agentManager - Agent manager to check if Settings was sent to WebSocket
 * @returns Object with confirmed (SettingsApplied received), sent (sent to WebSocket), and both flags
 */
export function hasSettingsBeenSent(
  hasSentSettingsRef: React.MutableRefObject<boolean>,
  windowWithGlobals: WindowWithDeepgramGlobals,
  agentManager: WebSocketManager | null
): { confirmed: boolean; sent: boolean; both: boolean } {
  const confirmed = hasSentSettingsRef.current || windowWithGlobals.globalSettingsSent || false;
  // Check if agentManager has the hasSettingsBeenSent method (defensive check for mocks)
  const sent = (agentManager && typeof agentManager.hasSettingsBeenSent === 'function')
    ? agentManager.hasSettingsBeenSent()
    : false;
  return {
    confirmed,
    sent,
    both: confirmed || sent
  };
}

/**
 * Helper function to wait for Settings to be sent with timeout
 * @param hasSentSettingsRef - Ref tracking if SettingsApplied was received
 * @param windowWithGlobals - Window object with globalSettingsSent flag
 * @param agentManager - Agent manager to check if Settings was sent to WebSocket
 * @param log - Logging function
 * @param maxWaitMs - Maximum time to wait in milliseconds (default: 5000)
 * @param checkIntervalMs - Interval between checks in milliseconds (default: 100)
 * @returns Promise that resolves to true if Settings was sent, false if timeout
 */
export async function waitForSettings(
  hasSentSettingsRef: React.MutableRefObject<boolean>,
  windowWithGlobals: WindowWithDeepgramGlobals,
  agentManager: WebSocketManager | null,
  log: (...args: unknown[]) => void,
  maxWaitMs: number = 5000,
  checkIntervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const { confirmed, sent } = hasSettingsBeenSent(hasSentSettingsRef, windowWithGlobals, agentManager);
    
    if (confirmed) {
      log('Settings confirmed (SettingsApplied received), safe to send user message');
      return true;
    }
    
    if (sent) {
      log('Settings sent (but SettingsApplied not yet received), waiting a bit more...');
      // Wait a bit more for SettingsApplied, but don't wait forever
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }
  
  return false;
}

/**
 * Helper function to warn about non-memoized options in development mode
 * @param propName - The name of the prop being checked
 * @param options - The options object to check
 */
export function warnAboutNonMemoizedOptions(propName: string, options: unknown): void {
  if (!options || typeof options !== 'object') {
    return;
  }
  
  // Check if the object appears to be an inline object (not memoized)
  // We use a heuristic: if the object has a constructor that's not Object
  // or if it's not frozen, it might be an inline object
  const isLikelyInlineObject = 
    options.constructor === Object && 
    !Object.isFrozen(options) &&
    Object.getOwnPropertyNames(options).length > 0;
  
  if (isLikelyInlineObject) {
    try {
      console.warn(
        `[DeepgramVoiceInteraction] ${propName} prop detected. ` +
        'For optimal performance, memoize this prop with useMemo() to prevent unnecessary re-initialization. ' +
        'See component documentation for details.'
      );
    } catch (error) {
      // Silently fail if console.warn is not available
    }
  }
}

