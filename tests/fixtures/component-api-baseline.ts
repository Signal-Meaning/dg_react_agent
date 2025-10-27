/**
 * Component API Baseline Fixtures
 * 
 * Stable fixtures for testing component API surface.
 * Source: commit 7191eb4a062f35344896e873f02eba69c9c46a2d
 */

import { PRE_FORK_COMPONENT_METHODS } from '../api-baseline/pre-fork-baseline';
import { APPROVED_COMPONENT_METHOD_ADDITIONS, METHODS_TO_REMOVE } from '../api-baseline/approved-additions';

/**
 * Complete list of approved component methods
 */
export const APPROVED_COMPONENT_METHODS = [
  ...PRE_FORK_COMPONENT_METHODS,
  ...Object.keys(APPROVED_COMPONENT_METHOD_ADDITIONS),
] as const;

/**
 * Methods that must be removed
 */
export const DEPRECATED_METHODS = Object.keys(METHODS_TO_REMOVE);

/**
 * Check if a method is approved
 */
export function isApprovedMethod(methodName: string): boolean {
  return APPROVED_COMPONENT_METHODS.includes(methodName as any);
}

/**
 * Check if a method is deprecated
 */
export function isDeprecatedMethod(methodName: string): boolean {
  return DEPRECATED_METHODS.includes(methodName);
}

/**
 * Check if a method is unauthorized
 */
export function isUnauthorizedMethod(methodName: string): boolean {
  return !isApprovedMethod(methodName) && !isDeprecatedMethod(methodName);
}

