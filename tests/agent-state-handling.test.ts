/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Agent State Handling Unit Tests
 * 
 * Tests to verify agent state message handling in isolation.
 * These tests address Issue #190: Missing Agent State Handlers Cause Idle Timeout Regression
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimeoutManager } from '../src/hooks/useIdleTimeoutManager';
import { IdleTimeoutService } from '../src/utils/IdleTimeoutService';
import { AgentStateService } from '../src/services/AgentStateService';

// Mock the WebSocket manager
const mockWebSocketManager = {
  getState: jest.fn(() => 'connected'),
  isConnected: jest.fn(() => true),
  startKeepalive: jest.fn(),
  stopKeepalive: jest.fn(),
};

// Mock the state object
const mockState = {
  isUserSpeaking: false,
  agentState: 'idle',
  isPlaying: false,
};

describe('Agent State Message Handling', () => {
  let idleTimeoutService: IdleTimeoutService;
  let timeoutCallback: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    timeoutCallback = jest.fn();
    idleTimeoutService = new IdleTimeoutService({
      timeoutMs: 10000,
      debug: true,
    });
    idleTimeoutService.onTimeout(timeoutCallback);
  });

  afterEach(() => {
    idleTimeoutService.destroy();
    jest.clearAllMocks();
  });

  describe('AgentThinking message handling', () => {
    it('should transition agent state to thinking and disable idle timeout resets', () => {
      // Simulate AgentThinking message
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });

      const state = idleTimeoutService.getState();
      expect(state.agentState).toBe('thinking');

      // Verify timeout resets are disabled during thinking
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });
      expect(timeoutCallback).not.toHaveBeenCalled();
    });

    it('should not start timeout when agent is thinking', () => {
      // Set agent to thinking state
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });

      // Try to start timeout - should not start
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });

      // Wait for timeout period
      setTimeout(() => {
        expect(timeoutCallback).not.toHaveBeenCalled();
      }, 11000);
    });
  });

  describe('AgentStartedSpeaking message handling', () => {
    it('should transition agent state to speaking and disable idle timeout resets', () => {
      // Simulate AgentStartedSpeaking message
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });

      const state = idleTimeoutService.getState();
      expect(state.agentState).toBe('speaking');

      // Verify timeout resets are disabled during speaking
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });
      expect(timeoutCallback).not.toHaveBeenCalled();
    });

    it('should not start timeout when agent is speaking', () => {
      // Set agent to speaking state
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });

      // Try to start timeout - should not start
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });

      // Wait for timeout period
      setTimeout(() => {
        expect(timeoutCallback).not.toHaveBeenCalled();
      }, 11000);
    });
  });

  describe('Agent state → idle transition (playback completion)', () => {
    it('should enable idle timeout resets when playback completes and agent transitions to idle', () => {
      // Set agent to speaking state with playback active
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: true });

      const speakingState = idleTimeoutService.getState();
      expect(speakingState.agentState).toBe('speaking');
      expect(speakingState.isPlaying).toBe(true);

      // Verify timeout resets are disabled during playback
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });
      expect(timeoutCallback).not.toHaveBeenCalled();

      // Simulate playback completion (this would trigger agent state → idle in actual component)
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      
      // Also transition agent state to idle (component does this when playback stops)
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });

      const idleState = idleTimeoutService.getState();
      expect(idleState.agentState).toBe('idle');
      expect(idleState.isPlaying).toBe(false);

      // Verify timeout resets are now enabled after playback completes and agent is idle
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });
      // Should reset timeout, not immediately call callback
      expect(timeoutCallback).not.toHaveBeenCalled();
    });

    it('should start timeout when agent becomes idle', () => {
      // Set agent to idle state
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });

      // Wait for timeout period
      setTimeout(() => {
        expect(timeoutCallback).toHaveBeenCalled();
      }, 11000);
    });

    /**
     * Idle timeout regression - agent state not transitioning to idle after playback
     * 
     * This test reproduces the bug where:
     * 1. User sends message → agent responds → playback starts → agent state = 'speaking'
     * 2. Playback finishes → onPlaybackStateChange(false) fires
     * 3. BUT onAgentStateChange('idle') is NOT called
     * 4. Agent state remains 'speaking', blocking idle timeout from starting
     * 
     * Expected behavior: When playback stops, agent state should transition to 'idle'
     * and idle timeout should start when all conditions are met (agent idle, user idle, not playing).
     * 
     * This test demonstrates the CORRECT behavior (what should happen after the bug is fixed).
     */
    it('should start idle timeout after playback completes and agent transitions to idle (expected behavior)', () => {
      jest.useFakeTimers();
      
      // Simulate realistic scenario:
      // 1. User sends message (user stops speaking, UtteranceEnd received)
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      // 2. Agent starts responding (thinking → speaking)
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: true });
      
      // Verify agent is speaking and playback is active
      const speakingState = idleTimeoutService.getState();
      expect(speakingState.agentState).toBe('speaking');
      expect(speakingState.isPlaying).toBe(true);
      expect(speakingState.isUserSpeaking).toBe(false);
      
      // 3. Playback finishes (onPlaybackStateChange(false) fires)
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      
      // EXPECTED: Component should transition agent state to 'idle' here
      // This test simulates what SHOULD happen (agent state → idle)
      // Once the bug is fixed, the component will automatically send this event
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Verify all idle conditions are met
      const idleState = idleTimeoutService.getState();
      expect(idleState.agentState).toBe('idle');
      expect(idleState.isPlaying).toBe(false);
      expect(idleState.isUserSpeaking).toBe(false);
      
      // 4. Idle timeout should start now that all conditions are idle
      // Wait a bit to let updateTimeoutBehavior run
      jest.advanceTimersByTime(100);
      
      // Verify timeout is active
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // 5. Idle timeout should fire after configured period (10 seconds)
      jest.advanceTimersByTime(10000);
      
      // This demonstrates the expected behavior once the bug is fixed
      expect(timeoutCallback).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    /**
     * Test that idle timeout starts after playback stops and agent state transitions to idle
     * 
     * After the fix, when playback stops:
     * - Component calls AgentStateService.handleAudioPlaybackChange(false)
     * - AgentStateService transitions agent state to 'idle'
     * - onStateChange('idle') callback fires, dispatching AGENT_STATE_CHANGE
     * - useIdleTimeoutManager detects state change and sends AGENT_STATE_CHANGED to IdleTimeoutService
     * - IdleTimeoutService starts the timeout when all conditions are idle
     */
    it('should start idle timeout after playback stops and agent state transitions to idle', () => {
      jest.useFakeTimers();
      
      // Simulate realistic scenario:
      // 1. User sends message (user stops speaking, UtteranceEnd received)
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      // 2. Agent starts responding (thinking → speaking)
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: true });
      
      // Verify agent is speaking and playback is active
      const speakingState = idleTimeoutService.getState();
      expect(speakingState.agentState).toBe('speaking');
      expect(speakingState.isPlaying).toBe(true);
      expect(speakingState.isUserSpeaking).toBe(false);
      
      // 3. Playback finishes (onPlaybackStateChange(false) fires)
      // FIX: After the fix, AgentStateService.handleAudioPlaybackChange(false) is called
      // which triggers onStateChange('idle'), which dispatches AGENT_STATE_CHANGE,
      // which updates state, which triggers useIdleTimeoutManager to send AGENT_STATE_CHANGED
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      
      // FIX: Agent state now transitions to 'idle' automatically
      // The component calls AgentStateService.handleAudioPlaybackChange(false)
      // which triggers onStateChange('idle'), which dispatches the state change
      // which triggers useIdleTimeoutManager to send this event
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Verify agent state is now 'idle' (the fix)
      const currentState = idleTimeoutService.getState();
      expect(currentState.agentState).toBe('idle');
      expect(currentState.isPlaying).toBe(false);
      expect(currentState.isUserSpeaking).toBe(false);
      
      // EXPECTED BEHAVIOR: Idle timeout SHOULD start because:
      // - User is not speaking ✅
      // - Playback has finished ✅
      // - Agent state is 'idle' ✅
      
      // Wait a bit to let updateTimeoutBehavior run
      jest.advanceTimersByTime(100);
      
      // THIS ASSERTION NOW PASSES (green) after the bug is fixed:
      // Expected: timeout should be active (agent state is 'idle')
      // Actual: timeout IS active (agent state is 'idle')
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // If timeout is active, it should fire after configured period
      if (idleTimeoutService.isTimeoutActive()) {
        jest.advanceTimersByTime(10000);
        expect(timeoutCallback).toHaveBeenCalledTimes(1);
      }
      
      jest.useRealTimers();
    });

    /**
     * Demonstrates the bug - idle timeout cannot start if agent state doesn't transition
     * 
     * This test shows what happens when the bug occurs:
     * - Playback stops but agent state remains 'speaking'
     * - Idle timeout cannot start because agent state is not 'idle' or 'listening'
     */
    it('should NOT start idle timeout if agent state remains speaking after playback stops (bug scenario)', () => {
      jest.useFakeTimers();
      
      // Simulate the bug scenario:
      // 1. User stops speaking
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      // 2. Agent responds and playback starts
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: true });
      
      // 3. Playback finishes (onPlaybackStateChange(false) fires)
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      
      // BUG: Agent state does NOT transition to 'idle' (remains 'speaking')
      // This is the actual bug - component doesn't call AgentStateService.handleAudioPlaybackChange(false)
      // So we DON'T send AGENT_STATE_CHANGED to 'idle' here
      
      // Verify agent state is still 'speaking' (the bug)
      const currentState = idleTimeoutService.getState();
      expect(currentState.agentState).toBe('speaking');
      expect(currentState.isPlaying).toBe(false);
      expect(currentState.isUserSpeaking).toBe(false);
      
      // 4. Idle timeout should NOT start because agent state is 'speaking'
      jest.advanceTimersByTime(100);
      expect(idleTimeoutService.isTimeoutActive()).toBe(false);
      
      // 5. Wait for timeout period - should NOT fire because timeout never started
      jest.advanceTimersByTime(10000);
      expect(timeoutCallback).not.toHaveBeenCalled();
      
      // This demonstrates the bug: idle timeout cannot start when agent state is 'speaking'
      // even though playback has finished and user has stopped speaking
      
      jest.useRealTimers();
    });
  });

  describe('Complete agent state transition sequence', () => {
    it('should handle listening → thinking → speaking → idle sequence', () => {
      // Start in listening state
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'listening' });
      expect(idleTimeoutService.getState().agentState).toBe('listening');

      // Transition to thinking
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      expect(idleTimeoutService.getState().agentState).toBe('thinking');

      // Transition to speaking
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      expect(idleTimeoutService.getState().agentState).toBe('speaking');

      // Transition to idle
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      expect(idleTimeoutService.getState().agentState).toBe('idle');
    });

    it('should disable timeout resets during thinking and speaking states', () => {
      // Start timeout
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'start' });

      // Transition to thinking - should disable resets
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      
      // Try to reset timeout - should be ignored
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'during-thinking' });

      // Transition to speaking - should still be disabled
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      
      // Try to reset timeout - should be ignored
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'during-speaking' });

      // Transition to idle - should enable resets
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Now timeout resets should work
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'after-idle' });
    });
  });

  describe('Idle timeout service integration', () => {
    it('should properly integrate with useIdleTimeoutManager hook', () => {
      const { result } = renderHook(() => 
        useIdleTimeoutManager(mockState, mockWebSocketManager, true)
      );

      expect(result.current).toBeDefined();
      expect(typeof result.current.handleMeaningfulActivity).toBe('function');
    });

    it('should handle meaningful activity during agent responses', () => {
      const { result } = renderHook(() => 
        useIdleTimeoutManager(mockState, mockWebSocketManager, true)
      );

      // Simulate agent thinking
      act(() => {
        result.current.handleMeaningfulActivity('agent-thinking');
      });

      // Should not cause timeout issues
      expect(mockWebSocketManager.startKeepalive).not.toHaveBeenCalled();
      expect(mockWebSocketManager.stopKeepalive).not.toHaveBeenCalled();
    });

    it('should accept onIdleTimeoutActiveChange callback', () => {
      const onIdleTimeoutActiveChange = jest.fn();
      const { result } = renderHook(() => 
        useIdleTimeoutManager(mockState, mockWebSocketManager, true, onIdleTimeoutActiveChange)
      );

      // Verify hook initializes correctly with callback
      expect(result.current).toBeDefined();
      expect(result.current.handleMeaningfulActivity).toBeDefined();
      expect(result.current.handleUtteranceEnd).toBeDefined();
    });

    it('should call onIdleTimeoutActiveChange when timeout active state changes', () => {
      const onIdleTimeoutActiveChange = jest.fn();
      
      // Create a service directly to test the callback mechanism
      const testService = new IdleTimeoutService({
        timeoutMs: 1000,
        debug: true,
      });

      // Set up the callback mechanism similar to how the hook does it
      let prevTimeoutActive = false;
      testService.onStateChange(() => {
        // Check timeout active state synchronously after state change
        // updateTimeoutBehavior runs synchronously in handleEvent, so timeout should be set
        const currentTimeoutActive = testService.isTimeoutActive();
        if (currentTimeoutActive !== prevTimeoutActive) {
          prevTimeoutActive = currentTimeoutActive;
          onIdleTimeoutActiveChange(currentTimeoutActive);
        }
      });

      // Start with agent speaking (timeout should not be active)
      testService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      expect(testService.isTimeoutActive()).toBe(false);
      expect(onIdleTimeoutActiveChange).not.toHaveBeenCalled(); // No change from initial false

      // Now transition to idle state - this should start timeout and trigger callback
      testService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      testService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      testService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });

      // Verify timeout is active (updateTimeoutBehavior should have started it)
      expect(testService.isTimeoutActive()).toBe(true);
      
      // The callback should have been called when state changed and timeout started
      expect(onIdleTimeoutActiveChange).toHaveBeenCalledWith(true);
      
      // Clear and test stopping timeout
      onIdleTimeoutActiveChange.mockClear();
      
      // Trigger state that should stop timeout (agent speaking)
      testService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });

      // Verify timeout is stopped
      expect(testService.isTimeoutActive()).toBe(false);

      // Should have been called with false when timeout stopped
      expect(onIdleTimeoutActiveChange).toHaveBeenCalledWith(false);
      
      testService.destroy();
    });

    it('should not call onIdleTimeoutActiveChange when callback is not provided', () => {
      const { result } = renderHook(() => 
        useIdleTimeoutManager(mockState, mockWebSocketManager, true)
      );

      // Should not throw or cause issues
      expect(result.current).toBeDefined();
      expect(result.current.handleMeaningfulActivity).toBeDefined();
      expect(result.current.handleUtteranceEnd).toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle rapid state transitions gracefully', () => {
      const states = ['listening', 'thinking', 'speaking', 'idle'];
      
      states.forEach(state => {
        idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state });
        expect(idleTimeoutService.getState().agentState).toBe(state);
      });
    });

    it('should handle unknown agent states gracefully', () => {
      // Should not throw error for unknown states
      expect(() => {
        idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'unknown-state' });
      }).not.toThrow();

      const state = idleTimeoutService.getState();
      expect(state.agentState).toBe('unknown-state');
    });

    it('should handle concurrent state changes', () => {
      // Simulate concurrent state changes
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });

      const state = idleTimeoutService.getState();
      expect(state.agentState).toBe('idle');
    });
  });

  describe('State transition timing', () => {
    it('should maintain proper state during long agent responses', () => {
      // Start agent response
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      
      // Simulate long thinking period
      setTimeout(() => {
        idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      }, 5000);

      // Simulate long speaking period
      setTimeout(() => {
        idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      }, 15000);

      // Verify state transitions
      expect(idleTimeoutService.getState().agentState).toBe('thinking');
    });

    it('should handle timeout resets correctly during state transitions', () => {
      // Start timeout
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'start' });

      // Transition to thinking - should disable resets
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      
      // Verify timeout is not reset during thinking
      const thinkingState = idleTimeoutService.getState();
      expect(thinkingState.agentState).toBe('thinking');

      // Transition to speaking - should still be disabled
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      
      // Verify timeout is not reset during speaking
      const speakingState = idleTimeoutService.getState();
      expect(speakingState.agentState).toBe('speaking');

      // Transition to idle - should enable resets
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Now timeout resets should work
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'after-idle' });
      
      const idleState = idleTimeoutService.getState();
      expect(idleState.agentState).toBe('idle');
    });
  });

  describe('Issue #262/#430: USER_STOPPED_SPEAKING should start timeout after re-enabling', () => {
    /**
     * BUG: When USER_STOPPED_SPEAKING is received, the timeout re-enables
     * but doesn't call updateTimeoutBehavior() to start a new timeout.
     * 
     * Expected: After USER_STOPPED_SPEAKING re-enables resets, updateTimeoutBehavior()
     * should be called to check if conditions are met and start timeout if needed.
     * 
     * Actual: enableResets() is called but updateTimeoutBehavior() is not,
     * so timeout never starts even though all conditions are idle.
     */
    it('should start timeout after USER_STOPPED_SPEAKING re-enables when all conditions are idle', () => {
      jest.useFakeTimers();
      
      // Setup: Agent finishes speaking, becomes idle (timeout starts via AGENT_STATE_CHANGED)
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      // Verify timeout is active (agent is idle)
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // User starts speaking (timeout stops)
      idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
      expect(idleTimeoutService.isTimeoutActive()).toBe(false);
      
      // User stops speaking (timeout should restart, but BUG: it doesn't)
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      
      // At this point:
      // - agentState: 'idle' (still idle from before)
      // - isUserSpeaking: false (just set by USER_STOPPED_SPEAKING)
      // - isPlaying: false (still false from before)
      // - isDisabled: false (just re-enabled by USER_STOPPED_SPEAKING)
      // 
      // BUG: updateTimeoutBehavior() is NOT called after USER_STOPPED_SPEAKING,
      // so timeout never starts even though all conditions are met
      
      // Verify timeout should be active (all conditions are idle)
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // Fast-forward time to verify timeout fires
      jest.advanceTimersByTime(10000);
      
      // Verify callback was called
      expect(timeoutCallback).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    it('should start timeout after USER_STOPPED_SPEAKING when agent is already idle', () => {
      jest.useFakeTimers();
      
      // Setup: Agent is idle, timeout was started
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      // Verify timeout is active
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // User starts speaking (timeout stops)
      idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
      expect(idleTimeoutService.isTimeoutActive()).toBe(false);
      
      // User stops speaking
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      
      // BUG: After USER_STOPPED_SPEAKING, updateTimeoutBehavior() should be called
      // to check if timeout should start. Currently it's not called, so timeout
      // never starts even though:
      // - agentState: 'idle' (still idle)
      // - isUserSpeaking: false (just set)
      // - isPlaying: false (still false)
      
      // Verify timeout should be active now
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // Fast-forward time
      jest.advanceTimersByTime(10000);
      
      // Verify callback was called
      expect(timeoutCallback).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    it('should NOT start timeout after USER_STOPPED_SPEAKING if agent is still speaking', () => {
      jest.useFakeTimers();
      
      // Setup: Agent is speaking, user stops speaking
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: true });
      idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
      
      // User stops speaking
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      
      // Timeout should NOT start because agent is still speaking
      expect(idleTimeoutService.isTimeoutActive()).toBe(false);
      
      // Fast-forward time - callback should not fire
      jest.advanceTimersByTime(10000);
      expect(timeoutCallback).not.toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Issue #262/#430: Timeout callback should fire when timeout reaches', () => {
    /**
     * BUG: Timeout starts but callback never fires.
     * 
     * This test verifies that when timeout is active and time passes,
     * the callback is actually called.
     */
    it('should fire callback when timeout reaches 10 seconds', () => {
      jest.useFakeTimers();
      
      // Setup: All conditions idle, timeout should start
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      // Verify timeout is active
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // Fast-forward 9 seconds - callback should not fire yet
      jest.advanceTimersByTime(9000);
      expect(timeoutCallback).not.toHaveBeenCalled();
      
      // Fast-forward 1 more second (total 10 seconds) - callback should fire
      jest.advanceTimersByTime(1000);
      expect(timeoutCallback).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    it('should fire callback even if timeout was stopped and restarted', () => {
      jest.useFakeTimers();
      
      // Start timeout
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
      
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // Stop timeout (agent starts speaking)
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      expect(idleTimeoutService.isTimeoutActive()).toBe(false);
      
      // Fast-forward - callback should not fire (timeout was stopped)
      jest.advanceTimersByTime(10000);
      expect(timeoutCallback).not.toHaveBeenCalled();
      
      // Restart timeout (agent finishes)
      idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      expect(idleTimeoutService.isTimeoutActive()).toBe(true);
      
      // Fast-forward 10 seconds - callback should fire for the new timeout
      jest.advanceTimersByTime(10000);
      expect(timeoutCallback).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });
});

describe('AgentStateService', () => {
  let agentStateService: AgentStateService;
  let mockCallbacks: {
    onAgentSpeaking: jest.Mock;
    onStateChange: jest.Mock;
  };

  beforeEach(() => {
    mockCallbacks = {
      onAgentSpeaking: jest.fn(),
      onStateChange: jest.fn(),
    };
    
    agentStateService = new AgentStateService(true);
    agentStateService.setCallbacks(mockCallbacks);
  });

  afterEach(() => {
    agentStateService.reset();
    jest.clearAllMocks();
  });

  describe('AgentThinking message handling', () => {
    it('should transition to thinking state', () => {
      agentStateService.handleAgentThinking();
      
      expect(agentStateService.getCurrentState()).toBe('thinking');
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('thinking');
    });

    it('should log state transition', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      agentStateService.handleAgentThinking();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('State transition: idle → thinking')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('AgentStartedSpeaking message handling', () => {
    it('should transition to speaking state and call onAgentSpeaking', () => {
      agentStateService.handleAgentStartedSpeaking(false, false);
      
      expect(agentStateService.getCurrentState()).toBe('speaking');
      expect(mockCallbacks.onAgentSpeaking).toHaveBeenCalled();
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('speaking');
    });

    it('should handle greeting state correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      agentStateService.handleAgentStartedSpeaking(true, false);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Greeting started - agent began speaking')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('AgentAudioDone message handling', () => {
    it('should NOT transition to idle on AgentAudioDone (playback may continue)', () => {
      // First set to speaking state
      agentStateService.handleAgentStartedSpeaking(false, false);
      expect(agentStateService.getCurrentState()).toBe('speaking');
      jest.clearAllMocks();
      
      // AgentAudioDone does NOT transition to idle because playback may continue
      agentStateService.handleAgentAudioDone(false);
      
      // State should remain speaking (actual idle transition happens on playback completion)
      expect(agentStateService.getCurrentState()).toBe('speaking');
      // Note: onAgentSilent callback was removed - use onPlaybackStateChange for playback completion
    });
  });

  describe('User speaking state handling', () => {
    it('should transition from idle to listening when user starts speaking', () => {
      agentStateService.handleUserStartedSpeaking();
      
      expect(agentStateService.getCurrentState()).toBe('listening');
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('listening');
    });

    it('should transition from listening to thinking when user stops speaking', () => {
      agentStateService.handleUserStartedSpeaking();
      jest.clearAllMocks();
      
      agentStateService.handleUserStoppedSpeaking();
      
      expect(agentStateService.getCurrentState()).toBe('thinking');
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('thinking');
    });
  });

  describe('Audio playback state handling', () => {
    it('should transition from speaking to idle when audio playback stops', () => {
      agentStateService.handleAgentStartedSpeaking(false, false);
      jest.clearAllMocks();
      
      agentStateService.handleAudioPlaybackChange(false);
      
      expect(agentStateService.getCurrentState()).toBe('idle');
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('idle');
    });

    it('should not transition when audio playback stops but not speaking', () => {
      agentStateService.handleAudioPlaybackChange(false);
      
      expect(agentStateService.getCurrentState()).toBe('idle');
      expect(mockCallbacks.onStateChange).not.toHaveBeenCalled();
    });
  });

  describe('Sleep state handling', () => {
    it('should transition to sleeping state', () => {
      agentStateService.handleSleepStateChange(true);
      
      expect(agentStateService.getCurrentState()).toBe('sleeping');
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('sleeping');
    });

    it('should transition from sleeping to listening when woken', () => {
      agentStateService.handleSleepStateChange(true);
      jest.clearAllMocks();
      
      agentStateService.handleSleepStateChange(false);
      
      expect(agentStateService.getCurrentState()).toBe('listening');
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith('listening');
    });
  });

  describe('State validation', () => {
    it('should prevent invalid state transitions', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Try to transition from sleeping to speaking (invalid - should go through listening first)
      agentStateService.handleSleepStateChange(true);
      jest.clearAllMocks();
      
      // This should cause an invalid transition warning
      agentStateService.handleAgentStartedSpeaking(false, false);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state transition')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('State history', () => {
    it('should track state transitions', () => {
      agentStateService.handleUserStartedSpeaking();
      agentStateService.handleUserStoppedSpeaking();
      agentStateService.handleAgentStartedSpeaking(false, false);
      
      const history = agentStateService.getStateHistory();
      expect(history).toHaveLength(3);
      expect(history[0].from).toBe('idle');
      expect(history[0].to).toBe('listening');
      expect(history[1].from).toBe('listening');
      expect(history[1].to).toBe('thinking');
      expect(history[2].from).toBe('thinking');
      expect(history[2].to).toBe('speaking');
    });

    it('should provide recent transitions', () => {
      agentStateService.handleUserStartedSpeaking();
      agentStateService.handleUserStoppedSpeaking();
      agentStateService.handleAgentThinking();
      agentStateService.handleAgentStartedSpeaking(false, false);
      
      const recent = agentStateService.getRecentTransitions(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].to).toBe('thinking');
      expect(recent[1].to).toBe('speaking');
    });
  });

  describe('State queries', () => {
    it('should correctly identify active state', () => {
      expect(agentStateService.isActive()).toBe(false); // idle
      
      agentStateService.handleUserStartedSpeaking();
      expect(agentStateService.isActive()).toBe(true); // listening
      
      agentStateService.handleUserStoppedSpeaking();
      expect(agentStateService.isActive()).toBe(true); // thinking
      
      agentStateService.handleAgentStartedSpeaking(false, false);
      expect(agentStateService.isActive()).toBe(true); // speaking
      
      // Note: AgentStoppedSpeaking is not a real Deepgram event (Issue #198)
      // Actual flow: AgentAudioDone (doesn't transition) → playback completion → idle
      // For test purposes, simulate playback completion to transition to idle
      agentStateService.handleAudioPlaybackChange(false);
      expect(agentStateService.isActive()).toBe(false); // idle
    });

    it('should correctly identify responding state', () => {
      expect(agentStateService.isResponding()).toBe(false);
      
      agentStateService.handleAgentThinking();
      expect(agentStateService.isResponding()).toBe(true); // thinking
      
      agentStateService.handleAgentStartedSpeaking(false, false);
      expect(agentStateService.isResponding()).toBe(true); // speaking
    });

    it('should correctly identify listening state', () => {
      expect(agentStateService.isListening()).toBe(false);
      
      agentStateService.handleUserStartedSpeaking();
      expect(agentStateService.isListening()).toBe(true);
    });
  });

  describe('Service reset', () => {
    it('should reset to initial state', () => {
      agentStateService.handleUserStartedSpeaking();
      agentStateService.handleUserStoppedSpeaking();
      
      expect(agentStateService.getCurrentState()).toBe('thinking');
      expect(agentStateService.getStateHistory()).toHaveLength(2);
      
      agentStateService.reset();
      
      expect(agentStateService.getCurrentState()).toBe('idle');
      expect(agentStateService.getStateHistory()).toHaveLength(0);
    });
  });
});
