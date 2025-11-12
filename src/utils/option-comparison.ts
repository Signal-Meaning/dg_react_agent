/**
 * Option comparison utilities
 * 
 * Utilities for comparing component options to prevent unnecessary re-initialization
 * when object references change but content remains the same.
 * 
 * Issue: #276 - Component Remounting Bug
 */

import { deepEqual } from './deep-equal';

/**
 * Compare agent options while ignoring 'context' changes
 * 
 * Context is meant to be updated dynamically (e.g., conversation history)
 * and shouldn't trigger component re-initialization.
 * 
 * @param a - First agent options object
 * @param b - Second agent options object
 * @returns true if options are equal (ignoring context), false otherwise
 */
export function compareAgentOptionsIgnoringContext(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  
  // Compare all properties except 'context'
  const aKeys = Object.keys(a).filter(k => k !== 'context');
  const bKeys = Object.keys(b).filter(k => k !== 'context');
  
  if (aKeys.length !== bKeys.length) return false;
  
  for (const key of aKeys) {
    if (!(key in b)) return false;
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a dependency has changed using deep comparison
 * 
 * @param prev - Previous value
 * @param current - Current value
 * @param needsInit - Whether initialization is needed regardless of change
 * @param compare - Optional custom comparison function (defaults to deepEqual)
 * @returns true if dependency changed or initialization is needed
 */
export function hasDependencyChanged<T>(
  prev: T | undefined,
  current: T,
  needsInit: boolean,
  compare?: (a: T, b: T) => boolean
): boolean {
  if (needsInit) return true;
  if (compare) {
    return !compare(prev as T, current);
  }
  return !deepEqual(prev, current);
}

