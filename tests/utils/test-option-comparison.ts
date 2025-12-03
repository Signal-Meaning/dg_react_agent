/**
 * Test for option comparison bug - Issue #311
 * 
 * This test verifies that compareAgentOptionsIgnoringContext correctly
 * detects when functions are added/removed from agentOptions.
 */

import { compareAgentOptionsIgnoringContext } from '../../src/utils/option-comparison';

describe('compareAgentOptionsIgnoringContext - Issue #311', () => {
  it('should detect change when functions are added', () => {
    const prev = {
      language: 'en',
      listenModel: 'nova-3',
      // functions property NOT present
    };
    
    const current = {
      language: 'en',
      listenModel: 'nova-3',
      functions: [{
        name: 'test_function',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    };
    
    // Should return false (not equal) because functions were added
    const areEqual = compareAgentOptionsIgnoringContext(prev, current);
    expect(areEqual).toBe(false);
  });
  
  it('should detect change when functions are removed', () => {
    const prev = {
      language: 'en',
      listenModel: 'nova-3',
      functions: [{
        name: 'test_function',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    };
    
    const current = {
      language: 'en',
      listenModel: 'nova-3',
      // functions property NOT present
    };
    
    // Should return false (not equal) because functions were removed
    const areEqual = compareAgentOptionsIgnoringContext(prev, current);
    expect(areEqual).toBe(false);
  });
  
  it('should detect change when functions array changes', () => {
    const prev = {
      language: 'en',
      functions: [{
        name: 'function1',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    };
    
    const current = {
      language: 'en',
      functions: [{
        name: 'function2', // Different function
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    };
    
    // Should return false (not equal) because functions changed
    const areEqual = compareAgentOptionsIgnoringContext(prev, current);
    expect(areEqual).toBe(false);
  });
  
  it('should return true when only context changes', () => {
    const prev = {
      language: 'en',
      context: { messages: [] }
    };
    
    const current = {
      language: 'en',
      context: { messages: [{ type: 'History', role: 'user', content: 'test' }] }
    };
    
    // Should return true (equal) because context is ignored
    const areEqual = compareAgentOptionsIgnoringContext(prev, current);
    expect(areEqual).toBe(true);
  });
});

