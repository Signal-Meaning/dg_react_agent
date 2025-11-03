import React, { useCallback, useEffect, useRef } from 'react';
import { VoiceInteractionState } from '../utils/state/VoiceInteractionState';
import { WebSocketManager } from '../utils/websocket/WebSocketManager';
import { IdleTimeoutService, IdleTimeoutEvent } from '../utils/IdleTimeoutService';

/**
 * Custom hook for managing idle timeout using the IdleTimeoutService
 * 
 * This hook provides a clean interface between the component and the
 * centralized idle timeout service.
 */
export function useIdleTimeoutManager(
  state: VoiceInteractionState,
  agentManagerRef: React.RefObject<WebSocketManager | null>,
  debug: boolean = false
) {
  const serviceRef = useRef<IdleTimeoutService | null>(null);
  const prevStateRef = useRef<VoiceInteractionState>(state);

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
      timeoutMs: 10000, // 10 seconds
      debug,
    });
    if (debug) {
      console.log('🎯 [DEBUG] IdleTimeoutService created successfully');
    }

    // Set up timeout callback
    serviceRef.current.onTimeout(() => {
      console.log('🎯 [IDLE_TIMEOUT] Idle timeout reached - closing agent connection');
      agentManagerRef.current?.close();
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

    // Emit events for state changes
    if (currentState.isUserSpeaking !== prevState.isUserSpeaking) {
      const event: IdleTimeoutEvent = currentState.isUserSpeaking 
        ? { type: 'USER_STARTED_SPEAKING' }
        : { type: 'USER_STOPPED_SPEAKING' };
      serviceRef.current.handleEvent(event);
    }

    if (currentState.agentState !== prevState.agentState) {
      serviceRef.current.handleEvent({ 
        type: 'AGENT_STATE_CHANGED', 
        state: currentState.agentState 
      });
    }

    if (currentState.isPlaying !== prevState.isPlaying) {
      serviceRef.current.handleEvent({ 
        type: 'PLAYBACK_STATE_CHANGED', 
        isPlaying: currentState.isPlaying 
      });
    }

    prevStateRef.current = state;
  }, [state.isUserSpeaking, state.agentState, state.isPlaying]);

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

  return {
    handleMeaningfulActivity,
    handleUtteranceEnd,
  };
}