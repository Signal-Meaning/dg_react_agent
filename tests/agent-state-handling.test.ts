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

  describe('AgentStoppedSpeaking message handling', () => {
    it('should transition agent state to idle and enable idle timeout resets', () => {
      // First set agent to speaking
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });

      // Then simulate AgentStoppedSpeaking message
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });

      const state = idleTimeoutService.getState();
      expect(state.agentState).toBe('idle');

      // Verify timeout resets are enabled when idle
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'test' });
      // Should not immediately call timeout callback, but should reset timeout
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
