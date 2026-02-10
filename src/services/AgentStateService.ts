/**
 * Agent State Service
 * 
 * Centralized service for handling agent state transitions and related logic.
 * This service provides a clean interface for managing agent states and ensures
 * consistent behavior across the application.
 */

import { AgentState } from '../types';
import { getLogger } from '../utils/logger';

export interface AgentStateTransition {
  from: AgentState;
  to: AgentState;
  timestamp: number;
  reason: string;
}

export interface AgentStateCallbacks {
  onAgentSpeaking?: () => void;
  onStateChange?: (state: AgentState) => void;
}

export class AgentStateService {
  private currentState: AgentState = 'idle';
  private stateHistory: AgentStateTransition[] = [];
  private callbacks: AgentStateCallbacks = {};
  private debug: boolean = false;
  private logger = getLogger({ debug: false });

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.logger = getLogger({ debug: this.debug });
  }

  /**
   * Set callbacks for agent state events
   */
  public setCallbacks(callbacks: AgentStateCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get the current agent state
   */
  public getCurrentState(): AgentState {
    return this.currentState;
  }

  /**
   * Get the state transition history
   */
  public getStateHistory(): AgentStateTransition[] {
    return [...this.stateHistory];
  }

  /**
   * Handle AgentThinking message
   */
  public handleAgentThinking(): void {
    this.transitionTo('thinking', 'AgentThinking message received');
  }

  /**
   * Handle AgentStartedSpeaking message
   */
  public handleAgentStartedSpeaking(greetingInProgress: boolean, greetingStarted: boolean): void {
    this.transitionTo('speaking', 'AgentStartedSpeaking message received');
    
    // Handle greeting state if applicable
    if (greetingInProgress && !greetingStarted) {
      this.log('Greeting started - agent began speaking');
    }
    
    // Call agent speaking callback
    this.callbacks.onAgentSpeaking?.();
  }

  /**
   * Handle AgentAudioDone message
   */
  public handleAgentAudioDone(greetingInProgress: boolean): void {
    this.log('AgentAudioDone received - audio generation complete, but playback may continue');
    
    // Handle greeting state if applicable
    if (greetingInProgress) {
      this.log('Greeting progress ended - audio generation complete');
    }
    
    // Note: We don't transition to idle here because audio playback may still be ongoing
    // The actual transition to idle happens when audio playback finishes
  }

  /**
   * Handle user started speaking
   */
  public handleUserStartedSpeaking(): void {
    if (this.currentState === 'idle' || this.currentState === 'sleeping') {
      this.transitionTo('listening', 'User started speaking');
    }
  }

  /**
   * Handle user stopped speaking
   */
  public handleUserStoppedSpeaking(): void {
    if (this.currentState === 'listening') {
      this.transitionTo('thinking', 'User stopped speaking');
    }
  }

  /**
   * Handle audio playback state changes
   */
  public handleAudioPlaybackChange(isPlaying: boolean): void {
    if (!isPlaying && this.currentState === 'speaking') {
      this.transitionTo('idle', 'Audio playback finished');
    }
  }

  /**
   * Handle sleep state changes
   */
  public handleSleepStateChange(isSleeping: boolean): void {
    if (isSleeping) {
      this.transitionTo('sleeping', 'Agent put to sleep');
    } else if (this.currentState === 'sleeping') {
      this.transitionTo('listening', 'Agent woken from sleep');
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: AgentState, reason: string): void {
    const previousState = this.currentState;
    
    if (previousState === newState) {
      this.log(`State transition skipped - already in ${newState} state`);
      return;
    }

    // Validate state transition
    if (!this.isValidTransition(previousState, newState)) {
      this.log(`⚠️ Invalid state transition: ${previousState} → ${newState}`);
      return;
    }

    // Record the transition
    const transition: AgentStateTransition = {
      from: previousState,
      to: newState,
      timestamp: Date.now(),
      reason
    };

    this.stateHistory.push(transition);
    this.currentState = newState;

    // Log the transition
    this.log(`State transition: ${previousState} → ${newState} (${reason})`);

    // Call state change callback
    this.callbacks.onStateChange?.(newState);
  }

  /**
   * Validate if a state transition is allowed
   */
  private isValidTransition(from: AgentState, to: AgentState): boolean {
    const validTransitions: Record<AgentState, AgentState[]> = {
      'idle': ['listening', 'sleeping', 'thinking', 'speaking'],
      'listening': ['thinking', 'idle', 'sleeping'],
      'thinking': ['speaking', 'idle', 'sleeping'],
      'speaking': ['idle', 'sleeping'],
      'sleeping': ['listening', 'idle'],
      'entering_sleep': ['sleeping', 'idle']
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Get a summary of recent state transitions
   */
  public getRecentTransitions(count: number = 5): AgentStateTransition[] {
    return this.stateHistory.slice(-count);
  }

  /**
   * Check if the agent is currently active (not idle or sleeping)
   */
  public isActive(): boolean {
    return !['idle', 'sleeping', 'entering_sleep'].includes(this.currentState);
  }

  /**
   * Check if the agent is currently responding (thinking or speaking)
   */
  public isResponding(): boolean {
    return ['thinking', 'speaking'].includes(this.currentState);
  }

  /**
   * Check if the agent is currently listening
   */
  public isListening(): boolean {
    return this.currentState === 'listening';
  }

  /**
   * Reset the service to initial state
   */
  public reset(): void {
    this.currentState = 'idle';
    this.stateHistory = [];
    this.log('Agent state service reset');
  }

  /**
   * Logging helper
   */
  private log(message: string): void {
    this.logger.debug(`[AgentStateService] ${message}`);
  }
}
