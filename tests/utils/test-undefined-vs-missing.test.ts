/**
 * Test for undefined vs missing property handling - Issue #311
 * 
 * This test verifies how the comparison handles:
 * - functions: undefined (explicitly set to undefined)
 * - functions: missing (property not present)
 * 
 * These should be treated differently in some contexts.
 */

import { compareAgentOptionsIgnoringContext } from '../../src/utils/option-comparison';
import { deepEqual } from '../../src/utils/deep-equal';

describe('Undefined vs Missing Property Handling - Issue #311', () => {
  it('should detect difference between undefined and missing property', () => {
    const withUndefined = {
      language: 'en',
      functions: undefined // Explicitly undefined
    };
    
    const withMissing = {
      language: 'en'
      // functions property NOT present
    };
    
    // deepEqual should treat these as different
    const areDeepEqual = deepEqual(withUndefined, withMissing);
    expect(areDeepEqual).toBe(false);
    
    // compareAgentOptionsIgnoringContext should also treat them as different
    const areEqual = compareAgentOptionsIgnoringContext(withUndefined, withMissing);
    expect(areEqual).toBe(false);
  });
  
  it('should detect difference between missing and array', () => {
    const withMissing = {
      language: 'en'
      // functions property NOT present
    };
    
    const withArray = {
      language: 'en',
      functions: [{
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    };
    
    const areEqual = compareAgentOptionsIgnoringContext(withMissing, withArray);
    expect(areEqual).toBe(false);
  });
  
  it('should treat undefined and undefined as equal', () => {
    const obj1 = {
      language: 'en',
      functions: undefined
    };
    
    const obj2 = {
      language: 'en',
      functions: undefined
    };
    
    const areEqual = compareAgentOptionsIgnoringContext(obj1, obj2);
    expect(areEqual).toBe(true);
  });
  
  it('should detect when functions changes from undefined to array', () => {
    const withUndefined = {
      language: 'en',
      functions: undefined
    };
    
    const withArray = {
      language: 'en',
      functions: [{
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: {} }
      }]
    };
    
    const areEqual = compareAgentOptionsIgnoringContext(withUndefined, withArray);
    expect(areEqual).toBe(false);
  });
});

