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
   * Handle events that affect idle timeout behavior
   */
  public handleEvent(event: IdleTimeoutEvent): void {
    this.log(`🎯 [DEBUG] handleEvent called with event type: ${event.type}`);
    if (this.config.debug) {
      console.log(`🎯 [DEBUG] handleEvent called with event type: ${event.type}`);
    }
    const prevState = { ...this.currentState };
    
    switch (event.type) {
      case 'USER_STARTED_SPEAKING':
        this.currentState.isUserSpeaking = true;
        this.disableResets();
        break;
        
      case 'USER_STOPPED_SPEAKING':
        this.currentState.isUserSpeaking = false;
        this.enableResets();
        break;
        
      case 'UTTERANCE_END':
        // UtteranceEnd indicates user has finished speaking
        // Enable resets and let updateTimeoutBehavior decide if timeout should start
        // based on agent state (timeout should start if agent is idle/listening, not if speaking/thinking)
        if (this.config.debug) {
          console.log('🎯 [DEBUG] UTTERANCE_END case reached - processing event');
        }
        this.log('🎯 [DEBUG] UTTERANCE_END case reached - processing event');
        this.currentState.isUserSpeaking = false;
        // Enable resets so timeout can work - updateTimeoutBehavior will determine
        // if timeout should start based on agent state
        this.enableResets();
        // Update timeout behavior - this will start timeout if agent is idle/listening
        // and not playing, or keep it disabled if agent is speaking/thinking/playing
        this.updateTimeoutBehavior();
        this.log('UtteranceEnd received - enabled resets, timeout behavior updated based on agent state');
        break;
        
      case 'AGENT_STATE_CHANGED':
        this.currentState.agentState = event.state;
        this.updateTimeoutBehavior();
        break;
        
      case 'PLAYBACK_STATE_CHANGED':
        this.currentState.isPlaying = event.isPlaying;
        this.updateTimeoutBehavior();
        break;
        
      case 'MEANINGFUL_USER_ACTIVITY':
        this.resetTimeout(event.activity);
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
      if ((this.currentState.agentState === 'idle' || this.currentState.agentState === 'listening') && 
          !this.currentState.isUserSpeaking && 
          !this.currentState.isPlaying) {
        this.startTimeout();
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
   * Cleanup
   */
  public destroy(): void {
    this.stopTimeout();
    this.onTimeoutCallback = undefined;
    this.onStateChangeCallback = undefined;
  }
}
