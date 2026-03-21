import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { DEFAULT_IDLE_TIMEOUT_MS } from '../constants/voice-agent';
import { VoiceInteractionState } from '../utils/state/VoiceInteractionState';
import { WebSocketManager } from '../utils/websocket/WebSocketManager';
import { IdleTimeoutService, type IdleTimeoutInteractionSnapshot } from '../utils/IdleTimeoutService';
import { getLogger } from '../utils/logger';

function interactionSnapshot(state: VoiceInteractionState): IdleTimeoutInteractionSnapshot {
  return {
    agentState: state.agentState,
    isPlaying: state.isPlaying,
    isUserSpeaking: state.isUserSpeaking,
  };
}

/**
 * Idle disconnect timer via `IdleTimeoutService`.
 *
 * **React interaction state** (`agentState`, `isPlaying`, `isUserSpeaking`) is pushed through a single
 * API — `applyCommittedInteractionState` — from `useLayoutEffect` after commit, so the service does not
 * rely on `useEffect` ordering relative to paint or other effects.
 *
 * **Other signals** (UtteranceEnd, tool/function lifecycle, WS meaningful activity, `pushIdleStateToIdleTimeoutService`)
 * still call `handleEvent` / `updateStateDirectly` directly; they are not duplicated in the layout snapshot.
 */
export function useIdleTimeoutManager(
  state: VoiceInteractionState,
  agentManagerRef: React.RefObject<WebSocketManager | null>,
  debug: boolean = false,
  onIdleTimeoutActiveChange?: (isActive: boolean) => void,
  timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
) {
  const logger = getLogger({ debug });
  const serviceRef = useRef<IdleTimeoutService | null>(null);
  const prevStateRef = useRef<VoiceInteractionState>(state);
  const callbackRef = useRef(onIdleTimeoutActiveChange);
  const prevTimeoutActiveRef = useRef<boolean>(false);
  const currentStateRef = useRef<VoiceInteractionState>(state);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onIdleTimeoutActiveChange;
  }, [onIdleTimeoutActiveChange]);

  // Create / destroy service in layout phase so it exists before the committed-state sync below (same tick).
  useLayoutEffect(() => {
    if (serviceRef.current) {
      logger.debug('Destroying existing IdleTimeoutService before creating new one');
      serviceRef.current.destroy();
      serviceRef.current = null;
    }

    logger.debug('Creating new IdleTimeoutService');
    serviceRef.current = new IdleTimeoutService({
      timeoutMs,
      debug,
    });

    serviceRef.current.onTimeout(() => {
      logger.info('Idle timeout reached - closing agent connection');
      if (typeof window !== 'undefined') {
        (window as unknown as { __idleTimeoutFired__?: boolean }).__idleTimeoutFired__ = true;
      }
      agentManagerRef.current?.close();
    });

    prevTimeoutActiveRef.current = false;
    serviceRef.current.onStateChange(() => {
      const currentTimeoutActive = serviceRef.current?.isTimeoutActive() ?? false;
      if (currentTimeoutActive !== prevTimeoutActiveRef.current) {
        prevTimeoutActiveRef.current = currentTimeoutActive;
        callbackRef.current?.(currentTimeoutActive);
      }
    });

    return () => {
      logger.debug('Destroying IdleTimeoutService (cleanup)');
      if (serviceRef.current) {
        serviceRef.current.destroy();
        serviceRef.current = null;
      }
    };
  }, [debug, timeoutMs]);

  // After service exists; re-attach when service instance is recreated (timeoutMs / debug).
  useEffect(() => {
    if (!serviceRef.current) return;
    serviceRef.current.setStateGetter(() => ({
      agentState: currentStateRef.current.agentState,
      isPlaying: currentStateRef.current.isPlaying,
      isUserSpeaking: currentStateRef.current.isUserSpeaking,
    }));
  }, [debug, timeoutMs]);

  // Single post-commit path: after React applies state, push one snapshot into IdleTimeoutService
  // (merge + semantic transitions) before paint. Avoids useEffect ordering vs idle countdown.
  useLayoutEffect(() => {
    if (!serviceRef.current) return;

    currentStateRef.current = state;

    const prevSnapshot = interactionSnapshot(prevStateRef.current);
    const nextSnapshot = interactionSnapshot(state);

    logger.debug('Committed interaction snapshot → IdleTimeoutService', {
      prev: prevSnapshot,
      next: nextSnapshot,
    });

    serviceRef.current.applyCommittedInteractionState(prevSnapshot, nextSnapshot);

    prevStateRef.current = state;
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
    logger.debug('handleUtteranceEnd called');
    if (serviceRef.current) {
      logger.debug('Calling handleEvent with UTTERANCE_END');
      serviceRef.current.handleEvent({ type: 'UTTERANCE_END' });
      logger.debug('handleEvent call completed');
    } else {
      logger.debug('Service is null');
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

  /**
   * Issue #487: Notify idle timeout that an agent message was received.
   * Passed to WebSocketManager as onAgentMessageReceived; the manager calls it when it emits a message (single path).
   * Clears "waiting for agent after function result." See docs/issues/ISSUE-489/IDLE-TIMEOUT-AFTER-FUNCTION-RESULT-DESIGN.md.
   */
  const notifyAgentMessageReceived = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.handleEvent({ type: 'AGENT_MESSAGE_RECEIVED' });
    }
  }, []);

  /**
   * Issue #489: Push full idle state into the idle timeout service so it sees the same
   * state we just dispatched, before we call handleMeaningfulActivity. Use when the component has
   * just transitioned to idle (e.g. on AgentAudioDone) so the service can start the timeout in the
   * same tick. Includes isUserSpeaking: false so canStartTimeout() is not blocked by stale user-speaking state.
   */
  const pushIdleStateToIdleTimeoutService = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.updateStateDirectly(
        {
          agentState: 'idle',
          isPlaying: false,
          isUserSpeaking: false,
        },
        { source: 'react-commit' }
      );
    }
  }, []);

  return {
    handleMeaningfulActivity,
    handleUtteranceEnd,
    handleFunctionCallStarted,
    handleFunctionCallCompleted,
    notifyAgentMessageReceived,
    pushIdleStateToIdleTimeoutService,
  };
}