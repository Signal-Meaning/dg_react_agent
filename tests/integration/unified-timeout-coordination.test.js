/**
 * Integration test for unified timeout coordination
 * 
 * This test validates that the IdleTimeoutService properly coordinates
 * timeout behavior across both transcription and agent services, ensuring
 * they timeout together when truly idle.
 */

const { IdleTimeoutService } = require('../../dist/utils/IdleTimeoutService');

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