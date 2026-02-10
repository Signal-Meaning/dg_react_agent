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
}

export interface IdleTimeoutState {
  isUserSpeaking: boolean;
  agentState: string;
  isPlaying: boolean;
}

export type IdleTimeoutEvent = 
  | { type: 'USER_STARTED_SPEAKING' }
  | { type: 'USER_STOPPED_SPEAKING' }
  | { type: 'UTTERANCE_END' }
  | { type: 'AGENT_STATE_CHANGED'; state: string }
  | { type: 'PLAYBACK_STATE_CHANGED'; isPlaying: boolean }
  | { type: 'MEANINGFUL_USER_ACTIVITY'; activity: string }
  | { type: 'FUNCTION_CALL_STARTED'; functionCallId: string }
  | { type: 'FUNCTION_CALL_COMPLETED'; functionCallId: string };

export class IdleTimeoutService {
  private static readonly POLLING_INTERVAL_MS = 200;
  
  private config: IdleTimeoutConfig;
  private timeoutId: number | null = null;
  private isDisabled = false;
  private currentState: IdleTimeoutState;
  private onTimeoutCallback?: () => void;
  private onStateChangeCallback?: (state: IdleTimeoutState) => void;
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private stateGetter?: () => IdleTimeoutState | null; // Callback to get current state from component
  // Issue #373: Track active function calls to prevent idle timeout during execution
  private activeFunctionCalls: Set<string> = new Set();
  private logger: Logger;
  /** Pause timeout until first user activity (speaking, sending text, etc.). After any such event, timeout is allowed to run when conditions are idle. */
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
   * Directly update state (bypasses event system)
   * This is used when events aren't arriving but we know the state has changed
   * (e.g., DOM shows state has changed but useEffect didn't fire)
   */
  public updateStateDirectly(state: Partial<IdleTimeoutState>): void {
    const prevState = { ...this.currentState };
    
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
        this.disableResets();
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
        
        // Issue #373: CRITICAL FIX - If agent enters thinking state, immediately stop any running timeout
        // This prevents timeout from firing during agent thinking phase (before function calls)
        if (event.state === 'thinking') {
          this.log('Agent entered thinking state - immediately stopping any running timeout');
          this.stopTimeout(); // Stop timeout immediately, don't wait for updateTimeoutBehavior
          this.disableResets(); // Disable resets to prevent timeout from restarting
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
        } else if (event.state !== 'thinking') {
          // Normal update behavior (skip if we already handled thinking state above)
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
        // Disable idle timeout resets when any function call is active
        // This prevents timeout from firing during function execution
        this.disableResets();
        break;
        
      case 'FUNCTION_CALL_COMPLETED':
        // Issue #373: Function call completed - remove from active set
        this.activeFunctionCalls.delete(event.functionCallId);
        this.log(`FUNCTION_CALL_COMPLETED: ${event.functionCallId} (active calls: ${this.activeFunctionCalls.size})`);
        // If no more active function calls, re-enable timeout based on current state
        if (this.activeFunctionCalls.size === 0) {
          // No active function calls - update timeout behavior based on current state
          this.updateTimeoutBehavior();
        }
        // If there are still active calls, keep timeout disabled
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
   * Timeout is paused until first user activity (speaking, sending text, etc.);
   * after that, it can start when conditions are idle.
   */
  private canStartTimeout(state: IdleTimeoutState = this.currentState): boolean {
    return this.hasSeenUserActivityThisSession &&
           this.isAgentIdle(state) &&
           !state.isUserSpeaking &&
           !state.isPlaying &&
           !this.isDisabled &&
           !this.hasActiveFunctionCalls();
  }

  /**
   * Check if timeout resets should be disabled based on current state
   */
  private shouldDisableTimeoutResets(): boolean {
    return this.currentState.isUserSpeaking ||
           this.currentState.agentState === 'thinking' ||
           this.currentState.agentState === 'speaking' ||
           this.currentState.isPlaying ||
           this.hasActiveFunctionCalls();
  }

  /**
   * Update timeout behavior based on current state
   */
  private updateTimeoutBehavior(): void {
    this.log(`updateTimeoutBehavior() called with state: isUserSpeaking=${this.currentState.isUserSpeaking}, agentState=${this.currentState.agentState}, isPlaying=${this.currentState.isPlaying}, isDisabled=${this.isDisabled}`);
    // Issue #373: Also disable timeout if there are active function calls
    if (this.shouldDisableTimeoutResets()) {
      this.disableResets();
    } else {
      this.enableResets();
      // Start timeout when all conditions are idle
      // CRITICAL: Check conditions again after enabling resets to ensure state is consistent
      // Issue #373: Also check that there are no active function calls
      if (this.canStartTimeout()) {
        this.log('updateTimeoutBehavior() - conditions met, starting timeout');
        this.startTimeout();
      } else {
        this.log(`updateTimeoutBehavior() - conditions not met for starting timeout: agentState=${this.currentState.agentState}, isUserSpeaking=${this.currentState.isUserSpeaking}, isPlaying=${this.currentState.isPlaying}, hasActiveFunctionCalls=${this.hasActiveFunctionCalls()}`);
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
        // Update our state from component state
        this.currentState = componentState;
        stateToCheck = componentState;
        this.log(`checkAndStartTimeoutIfNeeded() - synced state from component: agentState=${componentState.agentState}, isPlaying=${componentState.isPlaying}, isUserSpeaking=${componentState.isUserSpeaking}`);
      }
    }
    
    // Issue #373: Also check that there are no active function calls
    const shouldStartTimeout = this.canStartTimeout(stateToCheck);
    
    // CRITICAL: If user is speaking, stop timeout immediately (don't wait for events)
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
   * Disable idle timeout resets (during activity)
   */
  private disableResets(): void {
    this.log('disableResets() called');
    if (!this.isDisabled) {
      this.isDisabled = true;
      this.stopTimeout();
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
      this.log('startTimeout() skipped - canStartTimeout() false (e.g. no user activity this session yet)');
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
    this.log(`Started idle timeout (${this.config.timeoutMs}ms)`);
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
    this.onTimeoutCallback = undefined;
    this.onStateChangeCallback = undefined;
  }
}
