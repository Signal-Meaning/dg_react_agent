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

  const v = getClientViteDefaultInstructionsOverride();
  if (v) return v;

  return null;
}

/** Exposed for test-app UI (provenance) — same source as `getEnvironmentInstructions` in Vite. */
export function getClientViteDefaultInstructionsOverride(): string | null {
  const meta = import.meta as unknown as { env?: { VITE_DEFAULT_INSTRUCTIONS?: string } };
  if (typeof import.meta !== 'undefined' && meta.env?.VITE_DEFAULT_INSTRUCTIONS) {
    const t = meta.env.VITE_DEFAULT_INSTRUCTIONS.trim();
    return t || null;
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
