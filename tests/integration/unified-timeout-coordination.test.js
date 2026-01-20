/**
 * Integration test for unified timeout coordination
 * 
 * This test validates that the IdleTimeoutService properly coordinates
 * timeout behavior across both transcription and agent services, ensuring
 * they timeout together when truly idle.
 */

const { IdleTimeoutService } = require('../../src/utils/IdleTimeoutService');

describe('Unified Timeout Coordination Integration', () => {
  let idleTimeoutService;
  let mockOnTimeout;

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnTimeout = jest.fn();
    idleTimeoutService = new IdleTimeoutService({ 
      timeoutMs: 5000, 
      debug: true 
    });
    idleTimeoutService.onTimeout(mockOnTimeout);
  });

  afterEach(() => {
    jest.useRealTimers();
    idleTimeoutService.destroy();
  });

  describe('Centralized Timeout Management', () => {
    test('should timeout when both services are idle', () => {
      // Start timeout by enabling resets and setting idle state
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Wait for timeout period
      jest.advanceTimersByTime(5000);
      
      // Should timeout after idle period
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should reset timeout on meaningful activity', () => {
      // Initial activity
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'transcription' });
      
      // Wait 3 seconds (not enough to timeout)
      jest.advanceTimersByTime(3000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // More activity from agent service
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'agent' });
      
      // Wait another 3 seconds (should not timeout due to reset)
      jest.advanceTimersByTime(3000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Wait full timeout period after last activity
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('UtteranceEnd Coordination', () => {
    test('should disable timeout during user speaking', () => {
      // Simulate user started speaking
      idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
      
      // Wait for timeout period - should not timeout
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Even more time should not timeout
      jest.advanceTimersByTime(10000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    test('should re-enable timeout when user stops speaking', () => {
      // Disable timeout
      idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
      
      // Simulate user stopped speaking
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Should now timeout after idle period
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Issue #235: Timeout Reset on Speech Start', () => {
    test('should reset timeout when USER_STARTED_SPEAKING fires (prevents immediate timeout)', () => {
      // Scenario from Issue #235: User has been idle, timeout is about to fire
      // Line 24: User started speaking
      // Line 25: [IDLE_TIMEOUT] Idle timeout reached - closing agent connection (IMMEDIATELY AFTER!)
      // 
      // Root cause: Timeout fires immediately after USER_STARTED_SPEAKING because
      // it's not properly reset/cancelled when speech starts
      //
      // NOTE: This test validates IdleTimeoutService behavior at the unit level.
      // Currently passes, indicating the service itself works correctly.
      // The actual bug in issue #235 may be at the component integration level:
      // - Multiple IdleTimeoutService instances from component remounting
      // - Component not properly wiring onUserStartedSpeaking to the service
      // - Race conditions in component lifecycle
      // If the service-level bug existed, this test would fail.
      
      // Start with user stopped speaking and agent idle (timeout should be active)
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Advance time to 4999ms (99.98% through timeout period - milliseconds away from firing)
      // This simulates the exact scenario where timeout is about to fire
      jest.advanceTimersByTime(4999);
      expect(mockOnTimeout).not.toHaveBeenCalled(); // Should not have fired yet
      
      // USER_STARTED_SPEAKING fires - this should IMMEDIATELY cancel the pending timeout
      // Issue #235: Currently timeout fires immediately after this event (race condition)
      idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
      
      // CRITICAL: Advance even 1ms - the timeout that was about to fire should be cancelled
      // If the bug exists, timeout would fire here because it wasn't properly stopped
      jest.advanceTimersByTime(1);
      expect(mockOnTimeout).not.toHaveBeenCalled(); // Should NOT fire - timeout should be cancelled
      
      // Continue advancing time while user is speaking - should never fire
      jest.advanceTimersByTime(10000);
      expect(mockOnTimeout).not.toHaveBeenCalled(); // Still should not fire
      
      // User stops speaking
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Now timeout should start fresh from 0ms and fire after full idle period
      jest.advanceTimersByTime(4999);
      expect(mockOnTimeout).not.toHaveBeenCalled(); // Not quite time yet
      
      jest.advanceTimersByTime(1);
      // Should fire exactly once after user stops speaking, NOT immediately after starting
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should only fire timeout once, not multiple times (prevents duplicate handlers)', () => {
      // Issue #235: Multiple timeout messages observed (lines 25, 32, 38 in issue logs)
      // This test verifies only one timeout fires per idle period
      
      // Start idle state
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Wait for timeout period
      jest.advanceTimersByTime(5000);
      
      // Should fire exactly once, not multiple times
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      
      // Advance more time - should not fire again without a new idle period
      jest.advanceTimersByTime(10000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      
      // If we set up a new idle period, it should fire again (but only once)
      mockOnTimeout.mockClear();
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1); // Should fire once for this new period
    });

    test('should have only ONE timeout handler per session (prevents multiple service instances)', () => {
      // Issue #235: Concern that multiple timeout handlers may exist when only one is needed
      // This test simulates the scenario where component remounting or debug prop changes
      // cause multiple IdleTimeoutService instances to be created
      //
      // EXPECTED: Only ONE timeout should fire per session
      // The fix ensures old services are destroyed before creating new ones
      
      const mockOnTimeout = jest.fn();
      
      // Step 1: Create first service instance (original mount) and start timeout
      const service1 = new IdleTimeoutService({ 
        timeoutMs: 5000, 
        debug: false 
      });
      service1.onTimeout(mockOnTimeout);
      service1.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      service1.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      // service1 now has an active timeout running
      
      // Step 2: Simulate component remount or debug prop change
      // FIX: Destroy old service BEFORE creating new one (as useIdleTimeoutManager now does)
      service1.destroy(); // This cancels service1's timeout
      
      const service2 = new IdleTimeoutService({ 
        timeoutMs: 5000, 
        debug: true 
      });
      service2.onTimeout(mockOnTimeout);
      service2.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      service2.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      // service2 now has an active timeout running
      // service1's timeout was cancelled by destroy()
      
      // Step 3: Another remount - properly destroy old service first
      service2.destroy(); // This cancels service2's timeout
      
      const service3 = new IdleTimeoutService({ 
        timeoutMs: 5000, 
        debug: false 
      });
      service3.onTimeout(mockOnTimeout);
      service3.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      service3.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      // service3 now has an active timeout running
      // service1 and service2's timeouts were cancelled by destroy()
      
      // Wait for timeout period - only service3 should have an active timeout
      jest.advanceTimersByTime(5000);
      
      // EXPECTED: Only service3 should fire timeout (only one callback)
      // After the fix in useIdleTimeoutManager, old services are destroyed before creating new ones
      expect(mockOnTimeout).toHaveBeenCalledTimes(1); // Only one timeout should fire
      
      // Cleanup
      service3.destroy();
    });
  });

  describe('Service Coordination', () => {
    test('should coordinate between transcription and agent services', () => {
      // Activity from transcription service
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'transcription' });
      
      // Wait 2 seconds
      jest.advanceTimersByTime(2000);
      
      // Activity from agent service (should reset timeout)
      idleTimeoutService.handleEvent({ type: 'MEANINGFUL_USER_ACTIVITY', activity: 'agent' });
      
      // Wait 2 more seconds (should not timeout due to reset)
      jest.advanceTimersByTime(2000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Wait full timeout after last activity
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should handle agent speaking state', () => {
      // Agent starts speaking
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'speaking' });
      
      // Should not timeout during agent speaking
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Agent stops speaking
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Should now timeout after idle period
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Issue #373: Function Call Idle Timeout', () => {
    test('should NOT timeout during active function call execution', () => {
      // Set up idle state (timeout should be active)
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Wait 3 seconds (timeout is running)
      jest.advanceTimersByTime(3000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Function call starts - should disable timeout
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_STARTED', functionCallId: 'call-1' });
      
      // Wait full timeout period (5 seconds) - should NOT timeout because function call is active
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Wait even more - should still not timeout
      jest.advanceTimersByTime(10000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Function call completes - should re-enable timeout behavior
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_COMPLETED', functionCallId: 'call-1' });
      
      // Now timeout should start and fire after idle period
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple concurrent function calls', () => {
      // Set up idle state
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // First function call starts
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_STARTED', functionCallId: 'call-1' });
      
      // Wait 3 seconds - should not timeout
      jest.advanceTimersByTime(3000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Second function call starts (concurrent)
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_STARTED', functionCallId: 'call-2' });
      
      // Wait full timeout period - should still not timeout (both calls active)
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // First function call completes - timeout should still be disabled (call-2 still active)
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_COMPLETED', functionCallId: 'call-1' });
      
      // Wait timeout period - should still not timeout (call-2 still active)
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Second function call completes - now timeout should start
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_COMPLETED', functionCallId: 'call-2' });
      
      // Now timeout should fire after idle period
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should re-enable timeout after all function calls complete', () => {
      // Set up idle state
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Function call starts
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_STARTED', functionCallId: 'call-1' });
      
      // Wait - should not timeout
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Function call completes
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_COMPLETED', functionCallId: 'call-1' });
      
      // Timeout should now be active and fire after idle period
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should prevent timeout even if agent state changes during function call', () => {
      // Set up idle state
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Function call starts
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_STARTED', functionCallId: 'call-1' });
      
      // Agent state changes (e.g., to 'thinking' or 'speaking')
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'thinking' });
      
      // Wait full timeout period - should NOT timeout (function call is active)
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Agent state changes back to idle
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Should still not timeout (function call still active)
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Function call completes
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_COMPLETED', functionCallId: 'call-1' });
      
      // Now timeout should fire
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    test('should handle function call that starts before timeout begins', () => {
      // Function call starts immediately (before idle state is set)
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_STARTED', functionCallId: 'call-1' });
      
      // Set up idle state - timeout should not start because function call is active
      idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
      idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
      
      // Wait full timeout period - should NOT timeout
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Function call completes
      idleTimeoutService.handleEvent({ type: 'FUNCTION_CALL_COMPLETED', functionCallId: 'call-1' });
      
      // Now timeout should start and fire
      jest.advanceTimersByTime(5000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain existing API compatibility', () => {
      // Test that all existing methods still work
      expect(() => idleTimeoutService.onTimeout(() => {})).not.toThrow();
      expect(() => idleTimeoutService.onStateChange(() => {})).not.toThrow();
      expect(() => idleTimeoutService.getState()).not.toThrow();
      expect(() => idleTimeoutService.destroy()).not.toThrow();
    });

    test('should handle unknown events gracefully', () => {
      // Unknown event should not cause errors
      expect(() => {
        idleTimeoutService.handleEvent({ type: 'UNKNOWN_EVENT' });
      }).not.toThrow();
    });
  });
});