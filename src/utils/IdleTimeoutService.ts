/**
 * IdleTimeoutService - Centralized idle timeout management
 * 
 * This service handles all idle timeout logic in a clean, event-driven way.
 * It separates concerns between speech detection and idle timeout management.
 */

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
  | { type: 'MEANINGFUL_USER_ACTIVITY'; activity: string };

export class IdleTimeoutService {
  private config: IdleTimeoutConfig;
  private timeoutId: number | null = null;
  private isDisabled = false;
  private currentState: IdleTimeoutState;
  private onTimeoutCallback?: () => void;
  private onStateChangeCallback?: (state: IdleTimeoutState) => void;
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private stateGetter?: () => IdleTimeoutState | null; // Callback to get current state from component

  constructor(config: IdleTimeoutConfig) {
    this.config = config;
    if (this.config.debug) {
      console.log('🎯 [DEBUG] IdleTimeoutService constructor - debug:', this.config.debug);
    }
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
    this.log(`🎯 [DEBUG] handleEvent called with event type: ${event.type}`);
    if (this.config.debug) {
      console.log(`🎯 [DEBUG] handleEvent called with event type: ${event.type}`);
    }
    const prevState = { ...this.currentState };
    
    // Start polling if we're not already polling and timeout isn't active
    // This ensures we catch state changes even if events don't arrive in expected order
    if (this.pollingIntervalId === null && this.timeoutId === null) {
      // Start polling when we receive any event (indicates service is active)
      this.startPolling();
    }
    
    switch (event.type) {
      case 'USER_STARTED_SPEAKING':
        this.currentState.isUserSpeaking = true;
        this.disableResets();
        break;
        
      case 'USER_STOPPED_SPEAKING':
      case 'UTTERANCE_END':
        // Both events indicate user has finished speaking
        // Enable resets and let updateTimeoutBehavior decide if timeout should start
        // based on agent state (timeout should start if agent is idle/listening, not if speaking/thinking)
        this.currentState.isUserSpeaking = false;
        this.enableResetsAndUpdateBehavior();
        break;
        
      case 'AGENT_STATE_CHANGED':
        this.currentState.agentState = event.state;
        // Log state to debug timeout not starting
        this.log(`AGENT_STATE_CHANGED: state=${event.state}, isPlaying=${this.currentState.isPlaying}, isUserSpeaking=${this.currentState.isUserSpeaking}`);
        // CRITICAL: If agent becomes idle and playback has stopped, ensure timeout starts
        // This handles the case where AGENT_STATE_CHANGED with 'idle' arrives
        // after PLAYBACK_STATE_CHANGED with isPlaying=false
        if ((event.state === 'idle' || event.state === 'listening') && 
            !this.currentState.isPlaying && 
            !this.currentState.isUserSpeaking) {
          // Agent is idle and playback stopped, so enable resets and start timeout
          this.enableResetsAndUpdateBehavior();
        } else {
          // Normal update behavior
          this.updateTimeoutBehavior();
        }
        break;
        
      case 'PLAYBACK_STATE_CHANGED':
        this.currentState.isPlaying = event.isPlaying;
        // Log state before updating behavior to debug timeout not starting
        this.log(`PLAYBACK_STATE_CHANGED: isPlaying=${event.isPlaying}, agentState=${this.currentState.agentState}, isUserSpeaking=${this.currentState.isUserSpeaking}`);
        // CRITICAL: If playback stops and agent is idle, ensure timeout starts
        // This handles the case where PLAYBACK_STATE_CHANGED with isPlaying=false arrives
        // after agent becomes idle
        if (!event.isPlaying && (this.currentState.agentState === 'idle' || this.currentState.agentState === 'listening') && !this.currentState.isUserSpeaking) {
          // Agent is idle and playback stopped, so enable resets and start timeout
          this.enableResetsAndUpdateBehavior();
        } else {
          // Normal update behavior
          this.updateTimeoutBehavior();
        }
        break;
        
      case 'MEANINGFUL_USER_ACTIVITY':
        // MEANINGFUL_USER_ACTIVITY events (like AgentAudioDone) can arrive after agent becomes idle
        // Log state to debug why timeout isn't starting
        this.log(`MEANINGFUL_USER_ACTIVITY: activity=${event.activity}, agentState=${this.currentState.agentState}, isPlaying=${this.currentState.isPlaying}, isUserSpeaking=${this.currentState.isUserSpeaking}, isDisabled=${this.isDisabled}`);
        // CRITICAL FIX: If agent is idle and not playing, enable resets and start timeout
        // This handles the case where MEANINGFUL_USER_ACTIVITY arrives after agent becomes idle
        // but before PLAYBACK_STATE_CHANGED with isPlaying=false
        if ((this.currentState.agentState === 'idle' || this.currentState.agentState === 'listening') && 
            !this.currentState.isUserSpeaking && 
            !this.currentState.isPlaying) {
          // Agent is idle, so enable resets and start timeout
          this.enableResetsAndUpdateBehavior();
        } else {
          // Agent is still active, so just update behavior (may disable resets if needed)
          this.updateTimeoutBehavior();
        }
        break;
    }

    // Notify listeners of state change
    if (this.onStateChangeCallback && this.hasStateChanged(prevState, this.currentState)) {
      this.onStateChangeCallback(this.currentState);
    }
  }

  /**
   * Update timeout behavior based on current state
   */
  private updateTimeoutBehavior(): void {
    if (this.config.debug) {
      console.log('🎯 [DEBUG] updateTimeoutBehavior() called with state:', {
        isUserSpeaking: this.currentState.isUserSpeaking,
        agentState: this.currentState.agentState,
        isPlaying: this.currentState.isPlaying,
        isDisabled: this.isDisabled
      });
    }
    const shouldDisableResets = 
      this.currentState.isUserSpeaking || 
      this.currentState.agentState === 'thinking' || 
      this.currentState.agentState === 'speaking' || 
      this.currentState.isPlaying;

    if (shouldDisableResets) {
      this.disableResets();
    } else {
      this.enableResets();
      // Start timeout when all conditions are idle
      // CRITICAL: Check conditions again after enabling resets to ensure state is consistent
      const canStartTimeout = (this.currentState.agentState === 'idle' || this.currentState.agentState === 'listening') && 
          !this.currentState.isUserSpeaking && 
          !this.currentState.isPlaying;
      
      if (canStartTimeout) {
        if (this.config.debug) {
          console.log('🎯 [DEBUG] updateTimeoutBehavior() - conditions met, starting timeout');
        }
        this.startTimeout();
      } else {
        // Log why timeout isn't starting (even if debug is off, log this important case)
        this.log(`updateTimeoutBehavior() - conditions not met for starting timeout: agentState=${this.currentState.agentState}, isUserSpeaking=${this.currentState.isUserSpeaking}, isPlaying=${this.currentState.isPlaying}`);
        if (this.config.debug) {
          console.log('🎯 [DEBUG] updateTimeoutBehavior() - conditions not met for starting timeout:', {
            agentState: this.currentState.agentState,
            isUserSpeaking: this.currentState.isUserSpeaking,
            isPlaying: this.currentState.isPlaying
          });
        }
      }
    }
    
    // CRITICAL FIX: After any state update, check if we should start timeout
    // This handles cases where events arrive in wrong order or React batches updates
    // Use setTimeout to ensure this check happens after all state updates are processed
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
    
    const shouldStartTimeout = (stateToCheck.agentState === 'idle' || stateToCheck.agentState === 'listening') && 
        !stateToCheck.isUserSpeaking && 
        !stateToCheck.isPlaying &&
        !this.isDisabled;
    
    if (shouldStartTimeout && this.timeoutId === null) {
      this.log('checkAndStartTimeoutIfNeeded() - conditions met, starting timeout');
      this.enableResets();
      this.startTimeout();
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
    }, 500); // Check every 500ms
    
    if (this.config.debug) {
      console.log('🎯 [DEBUG] Started polling for idle timeout conditions');
    }
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingIntervalId !== null) {
      window.clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      if (this.config.debug) {
        console.log('🎯 [DEBUG] Stopped polling for idle timeout conditions');
      }
    }
  }

  /**
   * Disable idle timeout resets (during activity)
   */
  private disableResets(): void {
    if (this.config.debug) {
      console.log('🎯 [DEBUG] disableResets() called');
    }
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
    this.stopTimeout(); // Clear any existing timeout
    
    if (this.config.debug) {
      console.log('🎯 [DEBUG] Starting timeout with timeoutId:', this.timeoutId);
    }
    this.timeoutId = window.setTimeout(() => {
      this.log(`Idle timeout reached (${this.config.timeoutMs}ms) - firing callback`);
      this.onTimeoutCallback?.();
    }, this.config.timeoutMs);
    if (this.config.debug) {
      console.log('🎯 [DEBUG] Timeout started with timeoutId:', this.timeoutId);
    }
    this.log(`Started idle timeout (${this.config.timeoutMs}ms)`);
    // Stop polling once timeout is started (we're now actively monitoring)
    this.stopPolling();
  }

  /**
   * Stop the idle timeout
   */
  private stopTimeout(): void {
    if (this.config.debug) {
      console.log('🎯 [DEBUG] stopTimeout() called - timeoutId:', this.timeoutId);
    }
    this.log(`stopTimeout() called - timeoutId: ${this.timeoutId}`);
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
      this.log('Stopped idle timeout');
      if (this.config.debug) {
        console.log('🎯 [DEBUG] Timeout cleared successfully');
      }
    } else {
      this.log('No timeout to stop (timeoutId is null)');
      if (this.config.debug) {
        console.log('🎯 [DEBUG] No timeout to stop (timeoutId is null)');
      }
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
   * Logging helper
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`🎯 [IDLE_TIMEOUT_SERVICE] ${message}`);
    }
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
