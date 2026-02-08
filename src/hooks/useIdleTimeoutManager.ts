import React, { useCallback, useEffect, useRef } from 'react';
import { VoiceInteractionState } from '../utils/state/VoiceInteractionState';
import { WebSocketManager } from '../utils/websocket/WebSocketManager';
import { IdleTimeoutService, IdleTimeoutEvent } from '../utils/IdleTimeoutService';

const DEFAULT_IDLE_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Custom hook for managing idle timeout using the IdleTimeoutService
 * 
 * This hook provides a clean interface between the component and the
 * centralized idle timeout service.
 */
export function useIdleTimeoutManager(
  state: VoiceInteractionState,
  agentManagerRef: React.RefObject<WebSocketManager | null>,
  debug: boolean = false,
  onIdleTimeoutActiveChange?: (isActive: boolean) => void
) {
  const serviceRef = useRef<IdleTimeoutService | null>(null);
  const prevStateRef = useRef<VoiceInteractionState>(state);
  // Store callback in ref to avoid stale closures and allow it to change without recreating service
  const callbackRef = useRef(onIdleTimeoutActiveChange);
  const prevTimeoutActiveRef = useRef<boolean>(false);
  // Store current state in ref so stateGetter can always read latest state
  const currentStateRef = useRef<VoiceInteractionState>(state);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onIdleTimeoutActiveChange;
  }, [onIdleTimeoutActiveChange]);

  // Initialize the service
  useEffect(() => {
    // Issue #235: Destroy any existing service BEFORE creating a new one
    // This prevents multiple timeout handlers from existing simultaneously
    if (serviceRef.current) {
      if (debug) {
        console.log('🎯 [DEBUG] Destroying existing IdleTimeoutService before creating new one');
      }
      serviceRef.current.destroy();
      serviceRef.current = null;
    }

    if (debug) {
      console.log('🎯 [DEBUG] Creating new IdleTimeoutService');
      console.log('🎯 [DEBUG] About to create IdleTimeoutService');
    }
    serviceRef.current = new IdleTimeoutService({
      timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      debug,
    });
    if (debug) {
      console.log('🎯 [DEBUG] IdleTimeoutService created successfully');
    }

    // Set up timeout callback
    serviceRef.current.onTimeout(() => {
      // Always log so operators see why the connection closed (not gated by debug)
      console.log('🎯 [IDLE_TIMEOUT] Idle timeout reached - closing agent connection');
      agentManagerRef.current?.close();
    });

    // Set up callback to expose idle timeout active state changes
    // Use ref to access latest callback without recreating service when callback changes
    prevTimeoutActiveRef.current = false;
    serviceRef.current.onStateChange(() => {
      const currentTimeoutActive = serviceRef.current?.isTimeoutActive() ?? false;
      if (currentTimeoutActive !== prevTimeoutActiveRef.current) {
        prevTimeoutActiveRef.current = currentTimeoutActive;
        // Use ref to get latest callback, avoiding stale closures
        callbackRef.current?.(currentTimeoutActive);
      }
    });

    return () => {
      if (debug) {
        console.log('🎯 [DEBUG] Destroying IdleTimeoutService (cleanup)');
      }
      // Issue #235: Ensure service is destroyed and timeout is cancelled
      if (serviceRef.current) {
        serviceRef.current.destroy();
        serviceRef.current = null;
      }
    };
  }, [debug]);

  // Set up state getter once (reads from ref to always get latest state)
  useEffect(() => {
    if (serviceRef.current) {
      // Set up state getter for polling to read state directly from component
      // Use ref to ensure we always read the latest state, not a captured value
      serviceRef.current.setStateGetter(() => {
        return {
          agentState: currentStateRef.current.agentState,
          isPlaying: currentStateRef.current.isPlaying,
          isUserSpeaking: currentStateRef.current.isUserSpeaking,
        };
      });
    }
  }, []); // Only set once - reads from ref which is always current

  // Handle state changes
  useEffect(() => {
    if (!serviceRef.current) return;

    const currentState = {
      isUserSpeaking: state.isUserSpeaking,
      agentState: state.agentState,
      isPlaying: state.isPlaying,
    };

    const prevState = {
      isUserSpeaking: prevStateRef.current.isUserSpeaking,
      agentState: prevStateRef.current.agentState,
      isPlaying: prevStateRef.current.isPlaying,
    };

    // Debug logging to track state changes
    if (debug) {
      console.log('[useIdleTimeoutManager] State change detected:', {
        prev: prevState,
        current: currentState,
        agentStateChanged: currentState.agentState !== prevState.agentState,
        isPlayingChanged: currentState.isPlaying !== prevState.isPlaying,
        isUserSpeakingChanged: currentState.isUserSpeaking !== prevState.isUserSpeaking
      });
    }

    // Emit events for state changes
    if (currentState.isUserSpeaking !== prevState.isUserSpeaking) {
      const event: IdleTimeoutEvent = currentState.isUserSpeaking 
        ? { type: 'USER_STARTED_SPEAKING' }
        : { type: 'USER_STOPPED_SPEAKING' };
      if (debug) {
        console.log('[useIdleTimeoutManager] Emitting USER_STARTED/STOPPED_SPEAKING event');
      }
      serviceRef.current.handleEvent(event);
    }

    if (currentState.agentState !== prevState.agentState) {
      if (debug) {
        console.log(`[useIdleTimeoutManager] Emitting AGENT_STATE_CHANGED: ${prevState.agentState} -> ${currentState.agentState}`);
      }
      serviceRef.current.handleEvent({ 
        type: 'AGENT_STATE_CHANGED', 
        state: currentState.agentState 
      });
    }

    if (currentState.isPlaying !== prevState.isPlaying) {
      if (debug) {
        console.log(`[useIdleTimeoutManager] Emitting PLAYBACK_STATE_CHANGED: ${prevState.isPlaying} -> ${currentState.isPlaying}`);
      }
      serviceRef.current.handleEvent({ 
        type: 'PLAYBACK_STATE_CHANGED', 
        isPlaying: currentState.isPlaying 
      });
    }

    prevStateRef.current = state;
    
    // CRITICAL FIX: If state changed but events weren't emitted (React batching issue),
    // directly update IdleTimeoutService state as fallback
    // This ensures state is always in sync even if useEffect doesn't fire for all changes
    if (serviceRef.current) {
      const stateChanged = 
        currentState.agentState !== prevState.agentState ||
        currentState.isPlaying !== prevState.isPlaying ||
        currentState.isUserSpeaking !== prevState.isUserSpeaking;
      
      if (stateChanged) {
        // Directly sync state to IdleTimeoutService as fallback
        // This handles cases where React batches updates and events aren't emitted
        serviceRef.current.updateStateDirectly({
          agentState: currentState.agentState,
          isPlaying: currentState.isPlaying,
          isUserSpeaking: currentState.isUserSpeaking
        });
      }
    }
  }, [state.isUserSpeaking, state.agentState, state.isPlaying, debug]);

  // Handle meaningful user activity from WebSocket managers
  const handleMeaningfulActivity = useCallback((activity: string) => {
    if (serviceRef.current) {
      serviceRef.current.handleEvent({ 
        type: 'MEANINGFUL_USER_ACTIVITY', 
        activity 
      });
    }
  }, []);

  // Handle UtteranceEnd events specifically
  const handleUtteranceEnd = useCallback(() => {
    if (debug) {
      console.log('🎯 [DEBUG] handleUtteranceEnd called');
    }
    if (serviceRef.current) {
      if (debug) {
        console.log('🎯 [DEBUG] Service exists, calling handleEvent');
        console.log('🎯 [DEBUG] About to call serviceRef.current.handleEvent with UTTERANCE_END');
      }
      serviceRef.current.handleEvent({ 
        type: 'UTTERANCE_END'
      });
      if (debug) {
        console.log('🎯 [DEBUG] serviceRef.current.handleEvent call completed');
      }
    } else {
      if (debug) {
        console.log('🎯 [DEBUG] Service is null!');
      }
    }
  }, [debug]);

  // Issue #373: Handle function call events for idle timeout management
  const handleFunctionCallStarted = useCallback((functionCallId: string) => {
    if (serviceRef.current) {
      serviceRef.current.handleEvent({
        type: 'FUNCTION_CALL_STARTED',
        functionCallId
      });
    }
  }, []);

  const handleFunctionCallCompleted = useCallback((functionCallId: string) => {
    if (serviceRef.current) {
      serviceRef.current.handleEvent({
        type: 'FUNCTION_CALL_COMPLETED',
        functionCallId
      });
    }
  }, []);

  return {
    handleMeaningfulActivity,
    handleUtteranceEnd,
    handleFunctionCallStarted,
    handleFunctionCallCompleted,
  };
}