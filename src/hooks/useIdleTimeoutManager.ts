import { useCallback, useEffect, useRef } from 'react';
import { WebSocketManager } from '../utils/websocket/WebSocketManager';
import { VoiceInteractionState } from '../utils/state/VoiceInteractionState';

/**
 * Custom hook for managing idle timeout resets based on component state
 * 
 * This hook centralizes all idle timeout management logic and provides
 * a clean interface for the DeepgramVoiceInteraction component.
 */
export function useIdleTimeoutManager(
  state: VoiceInteractionState,
  agentManagerRef: React.RefObject<WebSocketManager | null>,
  transcriptionManagerRef: React.RefObject<WebSocketManager | null>,
  debug: boolean = false
) {
  // Track previous state to avoid unnecessary calls
  const prevStateRef = useRef<{
    isUserSpeaking: boolean;
    agentState: string;
    isPlaying: boolean;
  }>({
    isUserSpeaking: false,
    agentState: 'idle',
    isPlaying: false,
  });

  // DRY helper for idle timeout management
  const manageIdleTimeoutResets = useCallback((action: 'enable' | 'disable', context: string) => {
    try {
      const logPrefix = action === 'enable' ? '🎯 [IDLE_TIMEOUT] Re-enabling' : '🎯 [IDLE_TIMEOUT] Disabling';
      if (debug) {
        console.log(`${logPrefix} idle timeout resets for both services (${context})`);
      }
      
      if (agentManagerRef.current) {
        agentManagerRef.current[action === 'enable' ? 'enableIdleTimeoutResets' : 'disableIdleTimeoutResets']();
      }
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current[action === 'enable' ? 'enableIdleTimeoutResets' : 'disableIdleTimeoutResets']();
      }
    } catch (error) {
      console.error(`Error managing idle timeout resets (${action}):`, error);
    }
  }, [agentManagerRef, transcriptionManagerRef, debug]);

  // Centralized idle timeout management based on component state
  useEffect(() => {
    const currentState = {
      isUserSpeaking: state.isUserSpeaking,
      agentState: state.agentState,
      isPlaying: state.isPlaying,
    };

    const prevState = prevStateRef.current;

    // Only update if state actually changed
    const stateChanged = 
      currentState.isUserSpeaking !== prevState.isUserSpeaking ||
      currentState.agentState !== prevState.agentState ||
      currentState.isPlaying !== prevState.isPlaying;

    if (!stateChanged) {
      return;
    }

    // Determine if we should disable idle timeout resets
    const shouldDisableResets = 
      currentState.isUserSpeaking || 
      currentState.agentState === 'listening' || 
      currentState.agentState === 'thinking' || 
      currentState.agentState === 'speaking' || 
      currentState.isPlaying;

    // Update idle timeout resets based on current state
    if (shouldDisableResets) {
      manageIdleTimeoutResets('disable', 'ActivityDetected');
    } else {
      manageIdleTimeoutResets('enable', 'AllIdle');
    }

    // Update previous state
    prevStateRef.current = currentState;
  }, [state.isUserSpeaking, state.agentState, state.isPlaying, manageIdleTimeoutResets]);

  return {
    manageIdleTimeoutResets,
  };
}
