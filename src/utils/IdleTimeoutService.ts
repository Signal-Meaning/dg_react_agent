/**
 * IdleTimeoutService - Centralized idle timeout management
 * 
 * This service handles all idle timeout logic in a clean, event-driven way.
 * It separates concerns between speech detection and idle timeout management.
 */

import { getLogger, type Logger } from './logger';

export interface IdleTimeoutConfig {
  timeoutMs: number;
  debug?: boolean;
  /**
   * Max ms to wait for a signal that the agent is working (or the next message) after the app
   * sends a function result. When not set, defaults to 500. Capped at timeoutMs. Set to 0 to disable (wait indefinitely).
   */
  maxWaitForAgentReplyMs?: number;
}

export interface IdleTimeoutState {
  isUserSpeaking: boolean;
  agentState: string;
  isPlaying: boolean;
}

/** Subset of {@link IdleTimeoutState} synced from React after commit (`applyCommittedInteractionState`). */
export type IdleTimeoutInteractionSnapshot = Pick<
  IdleTimeoutState,
  'agentState' | 'isPlaying' | 'isUserSpeaking'
>;

/** Options for {@link IdleTimeoutService.updateStateDirectly}. */
export type UpdateStateDirectlyOptions = {
  /**
   * `react-commit`: state comes from `useLayoutEffect` after React applied the tree — merge immediately
   * (do not defer "busy" merges). Used by {@link IdleTimeoutService.applyCommittedInteractionState}.
   */
  source?: 'default' | 'react-commit';
};

export type IdleTimeoutEvent = 
  | { type: 'USER_STARTED_SPEAKING' }
  | { type: 'USER_STOPPED_SPEAKING' }
  | { type: 'UTTERANCE_END' }
  | { type: 'AGENT_STATE_CHANGED'; state: string }
  | { type: 'PLAYBACK_STATE_CHANGED'; isPlaying: boolean }
  | { type: 'MEANINGFUL_USER_ACTIVITY'; activity: string }
  | { type: 'FUNCTION_CALL_STARTED'; functionCallId: string }
  | { type: 'FUNCTION_CALL_COMPLETED'; functionCallId: string }
  /** Issue #487: Clears "waiting for next agent message after function result" so timeout may start again. */
  | { type: 'AGENT_MESSAGE_RECEIVED' };

export class IdleTimeoutService {
  private static readonly POLLING_INTERVAL_MS = 200;
  
  private config: IdleTimeoutConfig;
  private timeoutId: number | null = null;
  private isDisabled = false;
  private currentState: IdleTimeoutState;
  private onTimeoutCallback?: () => void;
  private onStateChangeCallback?: (state: IdleTimeoutState) => void;
  private pollingIntervalId: number | null = null;
  private stateGetter?: () => IdleTimeoutState | null; // Callback to get current state from component
  // Issue #373: Track active function calls to prevent idle timeout during execution
  private activeFunctionCalls: Set<string> = new Set();
  /**
   * After the app sends a **tool/function result** to the model, there is often a **silent window** where
   * the UI still looks idle but the assistant is actually working on the follow-up. We must not start the
   * "disconnect if inactive" timer in that window, or we would hang up before the user hears the answer.
   *
   * This flag is **not** the product rule by itself — it is a latch for that window. We clear it when we
   * see **real assistant activity** (same idea as "thinking / forming a result"), via:
   * - `AGENT_STATE_CHANGED` → `thinking` or `speaking`
   * - `AGENT_MESSAGE_RECEIVED` (WebSocketManager: any agent→client message on the wire)
   * - `MEANINGFUL_USER_ACTIVITY` with `AgentAudioDone` / `AgentDone` (turn complete after tool follow-up)
   * - `FUNCTION_CALL_STARTED` (chained tool call = assistant continued)
   * - max-wait timer (bounded fallback if the provider sends nothing)
   */
  private waitingForNextAgentMessageAfterFunctionResult = false;
  /**
   * If the provider never sends any of the signals above, we would block idle disconnect forever; this
   * timer clears the latch after `maxWaitForAgentReplyMs` (capped by `timeoutMs`). Normal clears cancel it.
   */
  private maxWaitForAgentReplyTimeoutId: number | null = null;
  private logger: Logger;
  /** Pause timeout until first user activity (speaking, typing/sending text, etc.). After any such event, timeout is allowed to run when conditions are idle. */
  private hasSeenUserActivityThisSession = false;

  constructor(config: IdleTimeoutConfig) {
    this.config = config;
    this.logger = getLogger({ debug: !!this.config.debug });
    this.log('IdleTimeoutService constructor - debug: ' + String(this.config.debug));
    this.currentState = {
      isUserSpeaking: false,
      agentState: 'idle',
      isPlaying: false,
    };
  }

  /**
   * Set callback for when idle timeout fires
   */
  public onTimeout(callback: () => void): void {
    this.onTimeoutCallback = callback;
  }

  /**
   * Set callback for when state changes
   */
  public onStateChange(callback: (state: IdleTimeoutState) => void): void {
    this.onStateChangeCallback = callback;
  }

  /**
   * Set callback to get current state from component
   * This allows polling to read state directly even if events don't arrive
   */
  public setStateGetter(getter: () => IdleTimeoutState | null): void {
    this.stateGetter = getter;
  }

  /**
   * Apply the latest React-committed interaction snapshot (user speaking, agent phase, playback) in one call.
   * The hook runs this from `useLayoutEffect` so DOM and state match before the idle-timeout service runs.
   */
  public applyCommittedInteractionState(
    prev: Readonly<IdleTimeoutInteractionSnapshot>,
    next: Readonly<IdleTimeoutInteractionSnapshot>
  ): void {
    const changed =
      prev.agentState !== next.agentState ||
      prev.isPlaying !== next.isPlaying ||
      prev.isUserSpeaking !== next.isUserSpeaking;
    if (!changed) {
      return;
    }

    this.updateStateDirectly(
      {
        agentState: next.agentState,
        isPlaying: next.isPlaying,
        isUserSpeaking: next.isUserSpeaking,
      },
      { source: 'react-commit' }
    );

    if (prev.isUserSpeaking !== next.isUserSpeaking) {
      this.handleEvent(
        next.isUserSpeaking ? { type: 'USER_STARTED_SPEAKING' } : { type: 'USER_STOPPED_SPEAKING' }
      );
    }
    if (prev.agentState !== next.agentState) {
      this.handleEvent({ type: 'AGENT_STATE_CHANGED', state: next.agentState });
    }
    if (prev.isPlaying !== next.isPlaying) {
      this.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: next.isPlaying });
    }
  }

  /**
   * Directly update state (bypasses event system)
   * This is used when events aren't arriving but we know the state has changed
   * (e.g., DOM shows state has changed but useEffect didn't fire)
   */
  public updateStateDirectly(state: Partial<IdleTimeoutState>, options?: UpdateStateDirectlyOptions): void {
    const prevState = { ...this.currentState };
    const skipDefer = options?.source === 'react-commit';

    // Disconnect countdown is running and a direct state update would look "busy" and cancel it — but that
    // update may predate what React has committed. Defer one tick and re-read live UI via stateGetter;
    // only then decide whether to cancel the countdown.
    const wouldDisable =
      (state.agentState !== undefined && state.agentState !== 'idle' && state.agentState !== 'listening') ||
      (state.isPlaying !== undefined && state.isPlaying) ||
      (state.isUserSpeaking !== undefined && state.isUserSpeaking);
    if (!skipDefer && this.timeoutId !== null && wouldDisable) {
      this.log('updateStateDirectly() would disable resets while timeout active; deferring to next tick and re-reading state');
      window.setTimeout(() => {
        if (this.stateGetter) {
          const s = this.stateGetter();
          if (s) {
            const deferredWouldDisable =
              (s.agentState !== 'idle' && s.agentState !== 'listening') || s.isPlaying || s.isUserSpeaking;
            if (deferredWouldDisable) {
              this.log('updateStateDirectly() deferred: stateGetter still blocking, skip merge to avoid stopping timeout on stale state');
              return;
            }
            this.currentState = s;
            this.log(`updateStateDirectly() deferred: synced from stateGetter agentState=${s.agentState}, isPlaying=${s.isPlaying}, isUserSpeaking=${s.isUserSpeaking}`);
          }
        }
        this.updateTimeoutBehavior();
      }, 0);
      return;
    }
    
    if (state.agentState !== undefined) {
      this.currentState.agentState = state.agentState;
    }
    if (state.isPlaying !== undefined) {
      this.currentState.isPlaying = state.isPlaying;
    }
    if (state.isUserSpeaking !== undefined) {
      this.currentState.isUserSpeaking = state.isUserSpeaking;
    }
    
    this.log(`updateStateDirectly() called: agentState=${this.currentState.agentState}, isPlaying=${this.currentState.isPlaying}, isUserSpeaking=${this.currentState.isUserSpeaking}`);
    
    // Update behavior based on new state
    this.updateTimeoutBehavior();
    
    // Always start polling when state is updated directly (ensures we catch future changes)
    // Polling will check conditions every 500ms and start timeout if conditions are met
    if (this.pollingIntervalId === null && this.timeoutId === null) {
      this.startPolling();
      this.log('Started polling for idle timeout conditions (fallback mechanism)');
    }
    
    // Notify listeners of state change
    if (this.onStateChangeCallback && this.hasStateChanged(prevState, this.currentState)) {
      this.onStateChangeCallback(this.currentState);
    }
  }

  /**
   * Handle events that affect idle timeout behavior
   */
  public handleEvent(event: IdleTimeoutEvent): void {
    this.log(`handleEvent called with event type: ${event.type}`);
    const prevState = { ...this.currentState };
    
    // Start polling if we're not already polling and timeout isn't active
    // This ensures we catch state changes even if events don't arrive in expected order
    if (this.pollingIntervalId === null && this.timeoutId === null) {
      // Start polling when we receive any event (indicates service is active)
      this.startPolling();
    }
    
    switch (event.type) {
      case 'USER_STARTED_SPEAKING':
        this.hasSeenUserActivityThisSession = true;
        this.currentState.isUserSpeaking = true;
        this.disableResets(false); // Always stop when user speaks
        break;
        
      case 'USER_STOPPED_SPEAKING':
      case 'UTTERANCE_END':
        // Both events indicate user has finished speaking (or utterance ended) — counts as user activity
        this.hasSeenUserActivityThisSession = true;
        this.currentState.isUserSpeaking = false;
        this.enableResetsAndUpdateBehavior();
        break;
        
      case 'AGENT_STATE_CHANGED': {
        this.currentState.agentState = event.state;
        // Log state to debug timeout not starting
        this.log(`AGENT_STATE_CHANGED: state=${event.state}, isPlaying=${this.currentState.isPlaying}, isUserSpeaking=${this.currentState.isUserSpeaking}`);

        // Issue #487: Agent became active (thinking/speaking) — clear "waiting after function result". Timeout is already disabled by shouldDisableTimeoutResets for thinking/speaking.
        if (event.state === 'thinking' || event.state === 'speaking') {
          this.stopMaxWaitForAgentReplyTimer();
          if (this.waitingForNextAgentMessageAfterFunctionResult) {
            this.waitingForNextAgentMessageAfterFunctionResult = false;
            this.log('AGENT_STATE_CHANGED to ' + event.state + ' - agent became active, no longer waiting');
          }
        }

        // CRITICAL: If agent becomes idle and playback has stopped, ensure timeout starts
        // This handles the case where AGENT_STATE_CHANGED with 'idle' arrives
        // after PLAYBACK_STATE_CHANGED with isPlaying=false
        const tempState = { ...this.currentState, agentState: event.state };
        if (this.isAgentIdle(tempState) && 
            !this.currentState.isPlaying && 
            !this.currentState.isUserSpeaking) {
          // Agent is idle and playback stopped, so enable resets and start timeout
          this.enableResetsAndUpdateBehavior();
        } else {
          // Assistant is mid-turn (thinking/speaking/etc.): normally cancel a running "disconnect if idle" countdown
          // so we do not hang up while the user is still getting a response (see updateTimeoutBehavior).
          this.updateTimeoutBehavior();
        }
        break;
      }
        
      case 'PLAYBACK_STATE_CHANGED':
        this.currentState.isPlaying = event.isPlaying;
        // Log state before updating behavior to debug timeout not starting
        this.log(`PLAYBACK_STATE_CHANGED: isPlaying=${event.isPlaying}, agentState=${this.currentState.agentState}, isUserSpeaking=${this.currentState.isUserSpeaking}`);
        // CRITICAL: If playback stops and agent is idle, ensure timeout starts
        // This handles the case where PLAYBACK_STATE_CHANGED with isPlaying=false arrives
        // after agent becomes idle
        if (!event.isPlaying && this.isAgentIdle(this.currentState) && !this.currentState.isUserSpeaking) {
          // Agent is idle and playback stopped, so enable resets and start timeout
          this.enableResetsAndUpdateBehavior();
        } else {
          // Normal update behavior
          this.updateTimeoutBehavior();
        }
        break;
        
      case 'MEANINGFUL_USER_ACTIVITY':
        // User activity (e.g. sending text, conversation activity) — unpause timeout for this session
        this.hasSeenUserActivityThisSession = true;
        this.log(`MEANINGFUL_USER_ACTIVITY: activity=${event.activity}, agentState=${this.currentState.agentState}, isPlaying=${this.currentState.isPlaying}, isUserSpeaking=${this.currentState.isUserSpeaking}, isDisabled=${this.isDisabled}`);
        // Issue #373/#489: AgentAudioDone/AgentDone means the turn is complete; clear "waiting after function result"
        // so idle timeout can start. Real API may send only AgentAudioDone (no second ConversationText).
        if (event.activity === 'AgentAudioDone' || event.activity === 'AgentDone') {
          this.stopMaxWaitForAgentReplyTimer();
          if (this.waitingForNextAgentMessageAfterFunctionResult) {
            this.waitingForNextAgentMessageAfterFunctionResult = false;
            this.log(
              'MEANINGFUL_USER_ACTIVITY(' + event.activity + ') — assistant turn complete; clearing post-tool idle block if set'
            );
          }
        }
        // CRITICAL FIX: If agent is idle and not playing, enable resets and RESET timeout
        // This handles the case where MEANINGFUL_USER_ACTIVITY arrives after agent becomes idle
        // but before PLAYBACK_STATE_CHANGED with isPlaying=false
        if (this.isAgentIdle(this.currentState) && 
            !this.currentState.isUserSpeaking && 
            !this.currentState.isPlaying) {
          // Agent is idle, so enable resets and RESET the timeout (user activity should reset it)
          this.enableResets();
          this.resetTimeout(event.activity);
        } else {
          // Agent is still active, so just update behavior (may disable resets if needed)
          this.updateTimeoutBehavior();
        }
        break;
        
      case 'FUNCTION_CALL_STARTED':
        // Issue #373: Function calls are active operations - disable idle timeout during execution
        this.activeFunctionCalls.add(event.functionCallId);
        this.log(`FUNCTION_CALL_STARTED: ${event.functionCallId} (active calls: ${this.activeFunctionCalls.size})`);
        // Issue #508: Next agent message can be a function call (chained). Clear waiting and cancel max-wait
        // so we do not start the idle timeout when max-wait fires; treat "next message received" here.
        this.waitingForNextAgentMessageAfterFunctionResult = false;
        this.stopMaxWaitForAgentReplyTimer();
        // Disable idle timeout resets when any function call is active
        // This prevents timeout from firing during function execution
        this.disableResets();
        break;
        
      case 'FUNCTION_CALL_COMPLETED':
        // Issue #373: Function call completed - remove from active set
        this.activeFunctionCalls.delete(event.functionCallId);
        this.log(`FUNCTION_CALL_COMPLETED: ${event.functionCallId} (active calls: ${this.activeFunctionCalls.size})`);
        // Issue #487 (voice-commerce #1058): App sent function result; agent is still busy until next agent message.
        if (this.activeFunctionCalls.size === 0) {
          this.waitingForNextAgentMessageAfterFunctionResult = true;
          this.log(
            'Tool output sent — blocking idle disconnect until assistant activity (thinking/speaking, WS message, AgentAudioDone, or max-wait)'
          );
          this.startMaxWaitForAgentReplyTimer();
        }
        // If no more active function calls, update behavior (timeout still must not start until AGENT_MESSAGE_RECEIVED or max-wait fires)
        if (this.activeFunctionCalls.size === 0) {
          this.updateTimeoutBehavior();
        }
        break;

      case 'AGENT_MESSAGE_RECEIVED':
        // Issue #487: Next agent message received; no longer waiting. Timeout may start if otherwise idle.
        this.stopMaxWaitForAgentReplyTimer();
        if (this.waitingForNextAgentMessageAfterFunctionResult) {
          this.waitingForNextAgentMessageAfterFunctionResult = false;
          this.log('AGENT_MESSAGE_RECEIVED — assistant traffic seen; clearing post-tool idle block if set');
        }
        this.updateTimeoutBehavior();
        break;
    }

    // Notify listeners of state change
    if (this.onStateChangeCallback && this.hasStateChanged(prevState, this.currentState)) {
      this.onStateChangeCallback(this.currentState);
    }
  }

  /**
   * Check if agent is in an idle state (idle or listening)
   */
  private isAgentIdle(state: IdleTimeoutState): boolean {
    return state.agentState === 'idle' || state.agentState === 'listening';
  }

  /**
   * Check if there are active function calls
   */
  private hasActiveFunctionCalls(): boolean {
    return this.activeFunctionCalls.size > 0;
  }

  /**
   * Check if timeout can start based on current state.
   * Timeout is paused until first user activity; after that it can start when conditions are idle.
   * Tool-output latch (see `waitingForNextAgentMessageAfterFunctionResult`): block idle disconnect until
   * assistant activity or max-wait, as documented on that field.
   */
  private canStartTimeout(state: IdleTimeoutState = this.currentState): boolean {
    return this.hasSeenUserActivityThisSession &&
           this.isAgentIdle(state) &&
           !state.isUserSpeaking &&
           !state.isPlaying &&
           !this.isDisabled &&
           !this.hasActiveFunctionCalls() &&
           !this.waitingForNextAgentMessageAfterFunctionResult;
  }

  /**
   * Check if timeout resets should be disabled based on current state
   */
  private shouldDisableTimeoutResets(): boolean {
    return this.currentState.isUserSpeaking ||
           this.currentState.agentState === 'thinking' ||
           this.currentState.agentState === 'speaking' ||
           this.currentState.isPlaying ||
           this.hasActiveFunctionCalls() ||
           this.waitingForNextAgentMessageAfterFunctionResult;
  }

  /**
   * User- or tool-driven reasons to cancel a running idle disconnect countdown immediately.
   * These are never treated as "late" signals: the user is talking, a tool call is in flight, or we are waiting
   * for the assistant's next message after the app sent a function result.
   */
  private isUserOrToolSessionBlockingIdleClose(): boolean {
    return (
      this.currentState.isUserSpeaking ||
      this.hasActiveFunctionCalls() ||
      this.waitingForNextAgentMessageAfterFunctionResult
    );
  }

  /**
   * **Why two opinions can disagree:** The service updates from **effect-driven events** (same tick as React
   * state, but not always the same ordering as "what the user already sees"). The `stateGetter` reads the
   * component's **current** React snapshot. Right after a turn completes, it is common for one more
   * `AGENT_STATE_CHANGED` / `PLAYBACK_STATE_CHANGED` from the **previous** render to arrive — so the service
   * briefly thinks "assistant busy" while the UI already shows "done". That is a **pipeline defect** in the
   * strict sense; the robust fix is to emit idle-timeout inputs from a **single post-commit path** (e.g. one
   * `useLayoutEffect`, or only from the reducer after dispatches settle) so event order matches UI. Until then,
   * when a disconnect countdown is already running, we use the **live UI** (`stateGetter`) as tie-breaker:
   * if it says idle-capable and the only mismatch is assistant/playback fields, treat the event as stale.
   *
   * **Why not user/tool flags here:** Those come from different sources (mic, function-call lifecycle, tool
   * latch). They were not the source of the "late busy after real idle" bug; applying the same deferral to
   * them would risk keeping a countdown when the user is actually talking or a tool is in flight.
   */
  private shouldIgnoreLateAssistantBusySignal(): boolean {
    if (this.timeoutId === null || !this.stateGetter) {
      return false;
    }
    if (this.hasActiveFunctionCalls() || this.waitingForNextAgentMessageAfterFunctionResult) {
      return false;
    }
    const s = this.stateGetter();
    if (!s || s.isUserSpeaking) {
      return false;
    }
    const componentIdleReady =
      this.isAgentIdle(s) && !s.isPlaying;
    if (!componentIdleReady) {
      return false;
    }
    const serviceClaimsAgentOrPlaybackBusy =
      !this.isAgentIdle(this.currentState) ||
      this.currentState.isPlaying ||
      this.currentState.isUserSpeaking;
    return serviceClaimsAgentOrPlaybackBusy;
  }

  /**
   * Drive the "disconnect if everyone is idle" timer from the service's picture of the session.
   *
   * **User behavior**
   * - When something real is going on (user speaking, tool call, assistant responding or audio playing), we
   *   must not count down to disconnect — or we must **cancel** an already-running countdown so we do not hang
   *   up mid-response.
   * - When the session is truly idle (user quiet, assistant done, not playing), we allow the countdown to run
   *   or start so the app can eventually close the connection after inactivity.
   * - **Exception:** Assistant/playback can be **wrongly busy** in the event stream while the live UI is already
   *   idle (`shouldIgnoreLateAssistantBusySignal`) — keep the countdown; see that method for why we cannot
   *   rely on event order alone until a single post-commit source exists.
   */
  private updateTimeoutBehavior(): void {
    this.log(`updateTimeoutBehavior() called with state: isUserSpeaking=${this.currentState.isUserSpeaking}, agentState=${this.currentState.agentState}, isPlaying=${this.currentState.isPlaying}, isDisabled=${this.isDisabled}`);
    if (this.shouldDisableTimeoutResets()) {
      if (this.isUserOrToolSessionBlockingIdleClose()) {
        this.disableResets(false);
      } else if (this.shouldIgnoreLateAssistantBusySignal()) {
        this.log(
          'updateTimeoutBehavior() - keep idle disconnect countdown: live UI already idle; ignoring late assistant/playback signal'
        );
        this.disableResets(true);
      } else {
        this.disableResets(false);
      }
    } else {
      this.enableResets();
      // Start timeout when all conditions are idle
      // CRITICAL: Check conditions again after enabling resets to ensure state is consistent
      // Issue #373: Also check that there are no active function calls
      if (this.canStartTimeout()) {
        this.log('updateTimeoutBehavior() - conditions met, starting timeout');
        this.startTimeout();
      } else {
        this.log(`updateTimeoutBehavior() - conditions not met for starting timeout: hasSeenUserActivity=${this.hasSeenUserActivityThisSession}, agentState=${this.currentState.agentState}, isUserSpeaking=${this.currentState.isUserSpeaking}, isPlaying=${this.currentState.isPlaying}, hasActiveFunctionCalls=${this.hasActiveFunctionCalls()}, waitingForNextAgentMessage=${this.waitingForNextAgentMessageAfterFunctionResult}, isDisabled=${this.isDisabled}`);
      }
    }
    
    // Run check synchronously so timeout starts this tick and onStateChange sees it
    this.checkAndStartTimeoutIfNeeded();
    // Also defer once so we catch any state updates that are batched or arrive out of order
    setTimeout(() => {
      this.checkAndStartTimeoutIfNeeded();
    }, 0);
  }

  /**
   * Check if conditions are met to start timeout and start it if needed
   * This is called after state updates to handle cases where events arrive in wrong order
   */
  private checkAndStartTimeoutIfNeeded(): void {
    // CRITICAL: If stateGetter is available, use it to get current state from component
    // This ensures we have the latest state even if events didn't arrive
    let stateToCheck = this.currentState;
    if (this.stateGetter) {
      const componentState = this.stateGetter();
      if (componentState) {
        // When a disconnect countdown just started, the live UI may still briefly report "user speaking"
        // before React applies "user stopped". Do not trust that snapshot to cancel the countdown.
        if (this.timeoutId !== null && componentState.isUserSpeaking) {
          this.log(
            'checkAndStartTimeoutIfNeeded() - idle countdown active; skipping state sync that would treat user as still speaking (prevents false cancel)'
          );
        } else {
          this.currentState = componentState;
          stateToCheck = componentState;
          this.log(`checkAndStartTimeoutIfNeeded() - synced state from component: agentState=${componentState.agentState}, isPlaying=${componentState.isPlaying}, isUserSpeaking=${componentState.isUserSpeaking}`);
        }
      }
    }
    
    // Issue #373: Also check that there are no active function calls
    const shouldStartTimeout = this.canStartTimeout(stateToCheck);
    
    // CRITICAL: If user is speaking, stop timeout immediately (don't wait for events).
    // Only stop when we've actually synced state that says user speaking (not when we skipped overwrite above).
    if (stateToCheck.isUserSpeaking && this.timeoutId !== null) {
      this.log('checkAndStartTimeoutIfNeeded() - user is speaking, stopping timeout');
      this.stopTimeout(); // Stop the timeout
      this.disableResets(); // Disable resets
      return; // Don't start timeout if user is speaking
    }
    
    if (shouldStartTimeout) {
      if (this.timeoutId === null) {
        // Timeout not running, start it
        this.log('checkAndStartTimeoutIfNeeded() - conditions met, starting timeout');
        this.enableResets();
        this.startTimeout();
      } else {
        this.log('checkAndStartTimeoutIfNeeded() - conditions met but timeout already running, skipping restart');
      }
    }
  }

  /**
   * Start polling to check if timeout should start
   * This is a fallback mechanism in case events don't arrive
   */
  private startPolling(): void {
    if (this.pollingIntervalId !== null) return; // Already polling
    
    this.pollingIntervalId = window.setInterval(() => {
      this.checkAndStartTimeoutIfNeeded();
    }, IdleTimeoutService.POLLING_INTERVAL_MS);
    this.log('Started polling for idle timeout conditions');
  }

  /** Default max-wait for agent reply after function result (ms). Short fallback so we don't block idle timeout long if backend never sends. */
  private static readonly DEFAULT_MAX_WAIT_FOR_AGENT_REPLY_MS = 500;

  /**
   * Start max-wait timer: if no "agent working" signal or message arrives within the window,
   * clear the "waiting" flag so idle timeout can start. Capped at timeoutMs.
   */
  private startMaxWaitForAgentReplyTimer(): void {
    this.stopMaxWaitForAgentReplyTimer();
    const configured = this.config.maxWaitForAgentReplyMs ?? IdleTimeoutService.DEFAULT_MAX_WAIT_FOR_AGENT_REPLY_MS;
    const ms = Math.min(configured, this.config.timeoutMs);
    if (ms <= 0) return;
    this.maxWaitForAgentReplyTimeoutId = window.setTimeout(() => {
      this.maxWaitForAgentReplyTimeoutId = null;
      if (this.waitingForNextAgentMessageAfterFunctionResult) {
        this.waitingForNextAgentMessageAfterFunctionResult = false;
        this.log('Max wait for agent reply reached - allowing idle timeout to start (backend did not send reply in time)');
        this.updateTimeoutBehavior();
      }
    }, ms);
  }

  private stopMaxWaitForAgentReplyTimer(): void {
    if (this.maxWaitForAgentReplyTimeoutId !== null) {
      window.clearTimeout(this.maxWaitForAgentReplyTimeoutId);
      this.maxWaitForAgentReplyTimeoutId = null;
    }
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingIntervalId !== null) {
      window.clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      this.log('Stopped polling for idle timeout conditions');
    }
  }

  /**
   * Mark the session as "not idle" for reset purposes (user or assistant activity).
   *
   * @param skipStopIfTimeoutActive - If true and a disconnect countdown is already running, keep it running
   * (only used when {@link shouldIgnoreLateAssistantBusySignal} is true — live UI idle, late busy event).
   * Otherwise pass false so we cancel any in-flight countdown whenever we know work is really happening.
   */
  private disableResets(skipStopIfTimeoutActive: boolean = false): void {
    this.log('disableResets() called');
    if (!this.isDisabled) {
      this.isDisabled = true;
      if (!skipStopIfTimeoutActive || this.timeoutId === null) {
        this.stopTimeout();
      }
      this.log('Disabled idle timeout resets - activity detected');
    }
  }

  /**
   * Enable idle timeout resets (when idle)
   */
  private enableResets(): void {
    if (this.isDisabled) {
      this.isDisabled = false;
      this.log('Enabled idle timeout resets - returning to idle');
    }
  }

  /**
   * Enables resets and updates timeout behavior based on current state.
   * This will start timeout if agent is idle/listening and not playing,
   * or keep it disabled if agent is speaking/thinking/playing.
   */
  private enableResetsAndUpdateBehavior(): void {
    this.enableResets();
    this.updateTimeoutBehavior();
  }

  /**
   * Start the idle timeout
   */
  private startTimeout(): void {
    // Only start if conditions allow (e.g. user has spoken at least once)
    if (!this.canStartTimeout()) {
      this.log(
        `startTimeout() skipped - canStartTimeout() false (hasSeenUserActivity=${this.hasSeenUserActivityThisSession}, agentIdle=${this.isAgentIdle(this.currentState)}, isUserSpeaking=${this.currentState.isUserSpeaking}, isPlaying=${this.currentState.isPlaying}, isDisabled=${this.isDisabled}, hasActiveFunctionCalls=${this.hasActiveFunctionCalls()}, waitingForNextAgentMessage=${this.waitingForNextAgentMessageAfterFunctionResult})`
      );
      return;
    }
    // Only start if timeout is not already running (prevents unnecessary restarts)
    if (this.timeoutId !== null) {
      this.log('startTimeout() called but timeout already running, skipping');
      return;
    }
    this.log('Starting timeout with timeoutId: ' + this.timeoutId);
    this.timeoutId = window.setTimeout(() => {
      this.log(`Idle timeout reached (${this.config.timeoutMs}ms) - firing callback`);
      // Clear timeoutId before calling callback so a new timeout can be started if needed
      this.timeoutId = null;
      // Stop polling when timeout fires - polling should only restart if new events come in
      this.stopPolling();
      this.onTimeoutCallback?.();
    }, this.config.timeoutMs);
    // Info so browser E2E (Playwright console) reliably observes timeout start; other service lines stay debug.
    this.logger.info(`[IDLE_TIMEOUT_SERVICE] Started idle timeout (${this.config.timeoutMs}ms)`);
    // E2E diagnostic (Issue #489): expose so tests can assert timeout was started
    if (typeof window !== 'undefined') {
      (window as unknown as { __idleTimeoutStarted__?: boolean }).__idleTimeoutStarted__ = true;
    }
    // Keep polling active even after timeout starts - we need it to detect when user starts speaking
    // and stop the timeout. Polling will be stopped when timeout fires or is manually stopped.
    // Don't call stopPolling() here - let it continue to monitor state changes
  }

  /**
   * Stop the idle timeout
   */
  private stopTimeout(): void {
    this.log(`stopTimeout() called - timeoutId: ${this.timeoutId}`);
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
      this.log('Stopped idle timeout');
      // E2E diagnostic (Issue #489): timeout was running and got cleared (so it will not fire)
      if (typeof window !== 'undefined') {
        (window as unknown as { __idleTimeoutStopped__?: boolean }).__idleTimeoutStopped__ = true;
      }
    } else {
      this.log('No timeout to stop (timeoutId is null)');
    }
  }

  /**
   * Reset the idle timeout (on meaningful activity)
   */
  private resetTimeout(activity: string): void {
    if (!this.isDisabled && this.config.timeoutMs > 0) {
      this.log(`Resetting idle timeout (triggered by: ${activity})`);
      this.stopTimeout();
      this.startTimeout();
    } else if (this.isDisabled) {
      this.log(`NOT resetting idle timeout - disabled after activity (triggered by: ${activity})`);
    }
  }

  /**
   * Check if state has changed
   */
  private hasStateChanged(prev: IdleTimeoutState, current: IdleTimeoutState): boolean {
    return prev.isUserSpeaking !== current.isUserSpeaking ||
           prev.agentState !== current.agentState ||
           prev.isPlaying !== current.isPlaying;
  }

  /**
   * Logging helper (Issue #412: use shared logger, gated by config.debug)
   */
  private log(message: string): void {
    this.logger.debug(`[IDLE_TIMEOUT_SERVICE] ${message}`);
  }

  /**
   * Get current state
   */
  public getState(): IdleTimeoutState {
    return { ...this.currentState };
  }

  /**
   * Check if timeout is currently active (running)
   */
  public isTimeoutActive(): boolean {
    return this.timeoutId !== null;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopTimeout();
    this.stopMaxWaitForAgentReplyTimer();
    this.onTimeoutCallback = undefined;
    this.onStateChangeCallback = undefined;
  }
}
