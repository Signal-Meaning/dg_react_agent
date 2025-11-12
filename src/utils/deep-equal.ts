/**
 * Deep equality comparison utility
 * 
 * Compares two values for deep equality, handling:
 * - Primitives (string, number, boolean, null, undefined)
 * - Objects (plain objects, arrays)
 * - Nested structures
 * 
 * This is used to prevent unnecessary re-renders when object references
 * change but the actual content remains the same.
 */

/**
 * Deep equality check for two values
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference or both null/undefined
  if (a === b) {
    return true;
  }

  // Handle null/undefined cases
  if (a == null || b == null) {
    return a === b;
  }

  // Type check
  if (typeof a !== typeof b) {
    return false;
  }

  // Primitive types (string, number, boolean, symbol, bigint)
  if (typeof a !== 'object') {
    return a === b;
  }

  // Both are objects - check if they're arrays
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  
  if (aIsArray !== bIsArray) {
    return false;
  }

  // Handle arrays
  if (aIsArray && bIsArray) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  // Handle plain objects
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!(key in (b as Record<string, unknown>))) {
      return false;
    }
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Shallow equality check for two values
 * Useful for quick checks when deep comparison isn't needed
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are shallowly equal, false otherwise
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a == null || b == null) {
    return a === b;
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
      return false;
    }
  }

  return true;
}

