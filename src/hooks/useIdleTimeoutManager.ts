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
    serviceRef.current = new IdleTimeoutService({
      timeoutMs: 10000, // 10 seconds
      debug,
    });

    // Set up timeout callback
    serviceRef.current.onTimeout(() => {
      console.log('🎯 [IDLE_TIMEOUT] Idle timeout reached - closing agent connection');
      agentManagerRef.current?.close();
    });

    return () => {
      serviceRef.current?.destroy();
    };
  }, [agentManagerRef, debug]);

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

  return {
    handleMeaningfulActivity,
  };
}