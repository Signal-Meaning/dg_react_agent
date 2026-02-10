/**
 * Instructions Loader Utility
 * 
 * This module provides functionality to load DEEPGRAM_INSTRUCTIONS from a file
 * with environment variable override support.
 */

import { getLogger } from './logger';

const log = getLogger();

// Only import Node.js modules in Node.js environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fs: any, path: any; // Node.js types not available in browser environment
if (typeof window === 'undefined') {
  // Node.js environment
  fs = require('fs');
  path = require('path');
}

/**
 * Default instructions fallback
 */
export const DEFAULT_INSTRUCTIONS = 'You are a helpful voice assistant. Keep your responses concise and informative.';

/**
 * Get the default instructions
 * @returns {string} Default instructions string
 */
export function getDefaultInstructions(): string {
  return DEFAULT_INSTRUCTIONS;
}

/**
 * Load instructions from file with environment variable override
 * 
 * Priority order:
 * 1. DEEPGRAM_INSTRUCTIONS environment variable (if set)
 * 2. File content from default instructions file
 * 3. Default fallback instructions
 * 
 * @param {string} filePath - Optional custom file path (defaults to instructions.txt)
 * @returns {Promise<string>} The instructions string
 */
export async function loadInstructionsFromFile(filePath?: string): Promise<string> {
  try {
    // Check for environment variable override first
    const envInstructions = getEnvironmentInstructions();
    if (envInstructions) {
      return envInstructions;
    }

    // Load from file
    const instructionsFilePath = filePath || getDefaultInstructionsFilePath();
    const fileContent = await readInstructionsFile(instructionsFilePath);
    
    if (fileContent && fileContent.trim()) {
      return fileContent.trim();
    }

    // Fallback to default instructions
    return getDefaultInstructions();
  } catch (error) {
    // Issue #410: browser gets calm message; sync loader (loadInstructionsFromFileSync) uses same pattern
    const isBrowser = typeof window !== 'undefined';
    const isFileReadError = error instanceof Error && error.message?.includes('File reading not supported');
    if (isBrowser && isFileReadError) {
      log.info('Using default instructions (file load not available in browser)');
    } else {
      log.warn('Failed to load instructions from file, using default', { error: error instanceof Error ? error.message : String(error) });
    }
    return getDefaultInstructions();
  }
}

/**
 * Get instructions from environment variables
 * Supports both Node.js process.env and Vite import.meta.env
 * @returns {string|null} Environment instructions or null if not set
 */
function getEnvironmentInstructions(): string | null {
  // Check Node.js environment
  if (typeof process !== 'undefined' && process.env?.DEEPGRAM_INSTRUCTIONS) {
    return process.env.DEEPGRAM_INSTRUCTIONS.trim();
  }

  // Check Vite environment (for frontend builds)
  if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEEPGRAM_INSTRUCTIONS?: string } }).env?.DEEPGRAM_INSTRUCTIONS) {
    return (import.meta as { env: { DEEPGRAM_INSTRUCTIONS: string } }).env.DEEPGRAM_INSTRUCTIONS.trim();
  }

  return null;
}

/**
 * Get the default instructions file path
 * @returns {string} Path to the default instructions file
 */
function getDefaultInstructionsFilePath(): string {
  // In a browser environment, we can't read files directly
  // This would typically be handled by bundlers or build processes
  if (typeof window !== 'undefined') {
    throw new Error('File reading not supported in browser environment');
  }

  // For Node.js environments, look for instructions.txt in the project root
  const projectRoot = process.cwd();
  return path.join(projectRoot, 'instructions.txt');
}

/**
 * Read instructions from file
 * @param {string} filePath - Path to the instructions file
 * @returns {Promise<string>} File content
 */
async function readInstructionsFile(filePath: string): Promise<string> {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    throw new Error('File reading not supported in browser environment');
  }
  
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fs.readFile(filePath, 'utf8', (err: any, data: string) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Synchronous version for environments that support it
 * @param {string} filePath - Optional custom file path
 * @returns {string} The instructions string
 */
export function loadInstructionsFromFileSync(filePath?: string): string {
  try {
    // Check for environment variable override first
    const envInstructions = getEnvironmentInstructions();
    if (envInstructions) {
      return envInstructions;
    }

    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      throw new Error('File reading not supported in browser environment');
    }

    // Load from file synchronously
    const instructionsFilePath = filePath || getDefaultInstructionsFilePath();
    const fileContent = fs.readFileSync(instructionsFilePath, 'utf8');
    
    if (fileContent && fileContent.trim()) {
      return fileContent.trim();
    }

    // Fallback to default instructions
    return getDefaultInstructions();
  } catch (error) {
    const isBrowser = typeof window !== 'undefined';
    const isFileReadError = error instanceof Error && error.message?.includes('File reading not supported');
    if (isBrowser && isFileReadError) {
      log.info('Using default instructions (file load not available in browser)');
    } else {
      log.warn('Failed to load instructions from file, using default', { error: error instanceof Error ? error.message : String(error) });
    }
    return getDefaultInstructions();
  }
}
