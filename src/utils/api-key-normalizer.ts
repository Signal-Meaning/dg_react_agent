/**
 * API Key Normalization Utilities
 * 
 * Centralized logic for normalizing Deepgram API keys for WebSocket authentication.
 * 
 * Deepgram API keys are provided without any prefix and should be used as-is.
 * This utility handles legacy keys that may have a 'dgkey_' prefix by stripping it.
 * 
 * @module api-key-normalizer
 */

/**
 * Normalizes a Deepgram API key for WebSocket authentication.
 * 
 * Deepgram WebSocket API expects raw keys (without 'dgkey_' prefix).
 * This function:
 * - Returns undefined for empty/invalid keys
 * - Preserves test keys as-is
 * - Strips 'dgkey_' prefix if present (legacy support)
 * - Returns raw key otherwise
 * 
 * @param apiKey - The API key to normalize (may have 'dgkey_' prefix)
 * @returns The normalized API key ready for WebSocket authentication, or undefined if invalid
 * 
 * @example
 * ```typescript
 * normalizeApiKeyForWebSocket('dg_abc123...') // Returns 'dg_abc123...'
 * normalizeApiKeyForWebSocket('dgkey_dg_abc123...') // Returns 'dg_abc123...' (prefix stripped)
 * normalizeApiKeyForWebSocket('test_key') // Returns 'test_key' (preserved)
 * normalizeApiKeyForWebSocket('') // Returns undefined
 * ```
 */
export function normalizeApiKeyForWebSocket(apiKey: string | undefined): string | undefined {
  if (!apiKey || apiKey.trim() === '') {
    return undefined;
  }
  
  const trimmed = apiKey.trim();
  
  // Test keys are used as-is (for testing/mocking scenarios)
  if (trimmed.startsWith('test')) {
    return trimmed;
  }
  
  // Deepgram WebSocket API expects raw keys (without 'dgkey_' prefix)
  // If key accidentally has 'dgkey_' prefix (legacy support), strip it
  // Keys should be stored in .env without prefix (as provided by Deepgram)
  if (trimmed.startsWith('dgkey_')) {
    return trimmed.substring(6); // Remove 'dgkey_' prefix (6 characters)
  }
  
  // Return raw key as-is (correct format)
  return trimmed;
}

