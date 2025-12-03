/**
 * Test for comparison bug - Issue #311
 * 
 * This test verifies a potential bug in compareAgentOptionsIgnoringContext:
 * It only iterates over aKeys, so if b has a key that a doesn't have,
 * the key count check should catch it, but let's verify edge cases.
 */

import { compareAgentOptionsIgnoringContext } from '../../src/utils/option-comparison';

describe('Comparison Bug Test - Issue #311', () => {
  it('should detect when b has extra key not in a', () => {
    const a = {
      language: 'en',
      listenModel: 'nova-3'
      // No functions
    };
    
    const b = {
      language: 'en',
      listenModel: 'nova-3',
      functions: [{ name: 'test', description: 'Test', parameters: { type: 'object', properties: {} } }]
    };
    
    // Key count check should catch this: a has 2 keys, b has 3 keys
    const aKeys = Object.keys(a).filter(k => k !== 'context');
    const bKeys = Object.keys(b).filter(k => k !== 'context');
    
    expect(aKeys.length).toBe(2);
    expect(bKeys.length).toBe(3);
    expect(aKeys.length !== bKeys.length).toBe(true);
    
    // Comparison should return false (not equal)
    const areEqual = compareAgentOptionsIgnoringContext(a, b);
    expect(areEqual).toBe(false);
  });
  
  it('should detect when a has extra key not in b', () => {
    const a = {
      language: 'en',
      listenModel: 'nova-3',
      functions: [{ name: 'test', description: 'Test', parameters: { type: 'object', properties: {} } }]
    };
    
    const b = {
      language: 'en',
      listenModel: 'nova-3'
      // No functions
    };
    
    // Key count check should catch this: a has 3 keys, b has 2 keys
    const aKeys = Object.keys(a).filter(k => k !== 'context');
    const bKeys = Object.keys(b).filter(k => k !== 'context');
    
    expect(aKeys.length).toBe(3);
    expect(bKeys.length).toBe(2);
    expect(aKeys.length !== bKeys.length).toBe(true);
    
    // Comparison should return false (not equal)
    const areEqual = compareAgentOptionsIgnoringContext(a, b);
    expect(areEqual).toBe(false);
  });
  
  it('should handle case where both have same keys but different values', () => {
    const a = {
      language: 'en',
      functions: undefined
    };
    
    const b = {
      language: 'en',
      functions: [{ name: 'test', description: 'Test', parameters: { type: 'object', properties: {} } }]
    };
    
    // Same key count, but different values
    const aKeys = Object.keys(a).filter(k => k !== 'context');
    const bKeys = Object.keys(b).filter(k => k !== 'context');
    
    expect(aKeys.length).toBe(bKeys.length);
    
    // Comparison should detect different values
    const areEqual = compareAgentOptionsIgnoringContext(a, b);
    expect(areEqual).toBe(false);
  });
  
  it('should verify the exact scenario from test page', () => {
    // This matches the exact scenario from closure-issue-test-page.tsx
    const prev = {
      language: 'en',
      listenModel: 'nova-3',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.',
      greeting: 'Hello! How can I help you?',
      // No functions property
    };
    
    const current = {
      language: 'en',
      listenModel: 'nova-3',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.',
      greeting: 'Hello! How can I help you?',
      functions: [{
        name: 'test_function',
        description: 'Test function to verify re-send',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Test query' }
          },
          required: ['query']
        }
      }]
    };
    
    const aKeys = Object.keys(prev).filter(k => k !== 'context');
    const bKeys = Object.keys(current).filter(k => k !== 'context');
    
    console.log('Prev keys:', aKeys);
    console.log('Current keys:', bKeys);
    console.log('Key count difference:', bKeys.length - aKeys.length);
    
    // Key counts should be different
    expect(aKeys.length).toBe(7);
    expect(bKeys.length).toBe(8);
    
    // Comparison should return false (not equal)
    const areEqual = compareAgentOptionsIgnoringContext(prev, current);
    console.log('Are equal?', areEqual);
    expect(areEqual).toBe(false);
  });
});

