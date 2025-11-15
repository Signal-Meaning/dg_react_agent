import { AgentFunction } from '../types/agent';

/**
 * Filter out properties that should not be included in Settings message
 * 
 * According to Deepgram API specification:
 * - client_side is NOT part of the Settings message
 * - client_side only appears in FunctionCallRequest responses from Deepgram
 * - Functions without endpoint are client-side by default (no flag needed)
 * 
 * This function filters out client_side and any other non-Settings properties
 * from functions before they are included in the Settings message.
 * 
 * @param functions - Array of functions that may contain client_side or other non-Settings properties
 * @returns Array of functions with client_side filtered out
 */
export function filterFunctionsForSettings(functions: AgentFunction[]): AgentFunction[] {
  return functions.map(func => {
    // Filter out client_side property (not part of Settings message per Deepgram API spec)
    // Preserve all other properties (Deepgram may ignore unknown properties, but we don't filter them)
    const { client_side, ...filteredFunction } = func as any;
    
    // Return the function without client_side
    return filteredFunction as AgentFunction;
  });
}

