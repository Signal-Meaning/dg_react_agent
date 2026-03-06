/**
 * Instructions Loader Utility
 *
 * Resolves instructions: (1) env override if set, (2) in-code default.
 * Env: DEFAULT_INSTRUCTIONS (Node) / VITE_DEFAULT_INSTRUCTIONS (Vite) to override.
 */

/**
 * Default instructions fallback
 */
export const DEFAULT_INSTRUCTIONS = 'You are a helpful voice assistant. Keep your responses concise and informative.';

/**
 * Get the default instructions
 */
export function getDefaultInstructions(): string {
  return DEFAULT_INSTRUCTIONS;
}

/**
 * Get instructions from environment variables.
 * Node: DEFAULT_INSTRUCTIONS. Vite: VITE_DEFAULT_INSTRUCTIONS (prefix required for client exposure).
 */
function getEnvironmentInstructions(): string | null {
  if (typeof process !== 'undefined' && process.env?.DEFAULT_INSTRUCTIONS) {
    return process.env.DEFAULT_INSTRUCTIONS.trim();
  }

  const meta = import.meta as unknown as { env?: { VITE_DEFAULT_INSTRUCTIONS?: string } };
  if (typeof import.meta !== 'undefined' && meta.env?.VITE_DEFAULT_INSTRUCTIONS) {
    return meta.env.VITE_DEFAULT_INSTRUCTIONS.trim();
  }

  return null;
}

/**
 * Load instructions: env override (if set) or default constant.
 * Kept for API compatibility; no file loading.
 */
export async function loadInstructionsFromFile(): Promise<string> {
  const envInstructions = getEnvironmentInstructions();
  if (envInstructions) {
    return envInstructions;
  }
  return getDefaultInstructions();
}

/**
 * Synchronous version: env override (if set) or default constant.
 * Kept for API compatibility; no file loading.
 */
export function loadInstructionsFromFileSync(): string {
  const envInstructions = getEnvironmentInstructions();
  if (envInstructions) {
    return envInstructions;
  }
  return getDefaultInstructions();
}
