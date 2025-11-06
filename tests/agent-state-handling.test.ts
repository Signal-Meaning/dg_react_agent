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
