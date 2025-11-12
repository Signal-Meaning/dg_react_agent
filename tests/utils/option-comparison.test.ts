/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Unit Tests for option-comparison utilities
 * 
 * Issue: #276 - Component Remounting Bug
 * 
 * Tests the option comparison utilities that prevent unnecessary
 * re-initialization when object references change but content is the same.
 */

import { compareAgentOptionsIgnoringContext, hasDependencyChanged } from '../../src/utils/option-comparison';
import { deepEqual } from '../../src/utils/deep-equal';

describe('compareAgentOptionsIgnoringContext', () => {
  describe('Basic equality', () => {
    it('should return true for same reference', () => {
      const options = { language: 'en', voice: 'aura-asteria-en' };
      expect(compareAgentOptionsIgnoringContext(options, options)).toBe(true);
    });

    it('should return true for objects with same content', () => {
      const a = { language: 'en', voice: 'aura-asteria-en' };
      const b = { language: 'en', voice: 'aura-asteria-en' };
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(true);
    });

    it('should return false for objects with different content', () => {
      const a = { language: 'en', voice: 'aura-asteria-en' };
      const b = { language: 'en', voice: 'aura-luna-en' };
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(false);
    });

    it('should return true for undefined values', () => {
      expect(compareAgentOptionsIgnoringContext(undefined, undefined)).toBe(true);
    });

    it('should return false for undefined vs defined', () => {
      const a = { language: 'en' };
      expect(compareAgentOptionsIgnoringContext(undefined, a)).toBe(false);
      expect(compareAgentOptionsIgnoringContext(a, undefined)).toBe(false);
    });
  });

  describe('Context property handling', () => {
    it('should ignore context changes', () => {
      const a = {
        language: 'en',
        voice: 'aura-asteria-en',
        context: { messages: [{ role: 'user', content: 'hello' }] }
      };
      const b = {
        language: 'en',
        voice: 'aura-asteria-en',
        context: { messages: [{ role: 'user', content: 'world' }] }
      };
      // Should be equal because context is ignored
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(true);
    });

    it('should compare other properties even when context differs', () => {
      const a = {
        language: 'en',
        voice: 'aura-asteria-en',
        context: { messages: [] }
      };
      const b = {
        language: 'es', // Different language
        voice: 'aura-asteria-en',
        context: { messages: [{ role: 'user', content: 'hola' }] }
      };
      // Should be false because language differs (context is ignored)
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(false);
    });

    it('should handle missing context in one object', () => {
      const a = {
        language: 'en',
        voice: 'aura-asteria-en'
      };
      const b = {
        language: 'en',
        voice: 'aura-asteria-en',
        context: { messages: [] }
      };
      // Should be equal because context is ignored
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(true);
    });
  });

  describe('Nested structures', () => {
    it('should handle nested objects', () => {
      const a = {
        language: 'en',
        functions: [{ name: 'test', description: 'test' }]
      };
      const b = {
        language: 'en',
        functions: [{ name: 'test', description: 'test' }]
      };
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(true);
    });

    it('should detect changes in nested structures', () => {
      const a = {
        language: 'en',
        functions: [{ name: 'test', description: 'test' }]
      };
      const b = {
        language: 'en',
        functions: [{ name: 'test2', description: 'test' }]
      };
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle agent options with conversation history updates', () => {
      const baseOptions = {
        language: 'en',
        listenModel: 'nova-3',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en'
      };
      
      const a = {
        ...baseOptions,
        context: {
          messages: [
            { type: 'History', role: 'user', content: 'Hello' }
          ]
        }
      };
      
      const b = {
        ...baseOptions,
        context: {
          messages: [
            { type: 'History', role: 'user', content: 'Hello' },
            { type: 'History', role: 'assistant', content: 'Hi there!' }
          ]
        }
      };
      
      // Should be equal because context is ignored
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(true);
    });

    it('should detect changes in non-context properties', () => {
      const a = {
        language: 'en',
        voice: 'aura-asteria-en',
        context: { messages: [] }
      };
      
      const b = {
        language: 'en',
        voice: 'aura-luna-en', // Different voice
        context: { messages: [] }
      };
      
      expect(compareAgentOptionsIgnoringContext(a, b)).toBe(false);
    });
  });
});

describe('hasDependencyChanged', () => {
  describe('Basic functionality', () => {
    it('should return true when needsInit is true', () => {
      expect(hasDependencyChanged(1, 2, true)).toBe(true);
      expect(hasDependencyChanged('a', 'b', true)).toBe(true);
      expect(hasDependencyChanged({ a: 1 }, { a: 2 }, true)).toBe(true);
    });

    it('should return false when needsInit is false and values are equal', () => {
      expect(hasDependencyChanged(1, 1, false)).toBe(false);
      expect(hasDependencyChanged('a', 'a', false)).toBe(false);
      expect(hasDependencyChanged({ a: 1 }, { a: 1 }, false)).toBe(false);
    });

    it('should return true when needsInit is false but values differ', () => {
      expect(hasDependencyChanged(1, 2, false)).toBe(true);
      expect(hasDependencyChanged('a', 'b', false)).toBe(true);
      expect(hasDependencyChanged({ a: 1 }, { a: 2 }, false)).toBe(true);
    });
  });

  describe('With default deepEqual comparison', () => {
    it('should use deepEqual for object comparison', () => {
      const a = { a: 1, b: { c: 2 } };
      const b = { a: 1, b: { c: 2 } };
      expect(hasDependencyChanged(a, b, false)).toBe(false);
    });

    it('should detect deep changes', () => {
      const a = { a: 1, b: { c: 2 } };
      const b = { a: 1, b: { c: 3 } };
      expect(hasDependencyChanged(a, b, false)).toBe(true);
    });
  });

  describe('With custom comparison function', () => {
    it('should use custom comparison when provided', () => {
      const customCompare = (a: number, b: number) => Math.abs(a - b) < 2;
      expect(hasDependencyChanged(1, 2, false, customCompare)).toBe(false);
      expect(hasDependencyChanged(1, 3, false, customCompare)).toBe(true);
    });

    it('should work with compareAgentOptionsIgnoringContext', () => {
      const a = {
        language: 'en',
        context: { messages: [{ role: 'user', content: 'hello' }] }
      };
      const b = {
        language: 'en',
        context: { messages: [{ role: 'user', content: 'world' }] }
      };
      // Should be false because context is ignored
      expect(hasDependencyChanged(a, b, false, compareAgentOptionsIgnoringContext)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined previous value', () => {
      expect(hasDependencyChanged(undefined, { a: 1 }, false)).toBe(true);
    });

    it('should handle undefined current value', () => {
      expect(hasDependencyChanged({ a: 1 }, undefined as any, false)).toBe(true);
    });

    it('should handle both undefined', () => {
      expect(hasDependencyChanged(undefined, undefined, false)).toBe(false);
    });
  });
});

