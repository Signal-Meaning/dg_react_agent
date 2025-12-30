import type { AgentFunction } from '../../../src/types/agent';

/**
 * Factory function for generating function definitions for Deepgram Voice Agent.
 * 
 * This function extracts function definition logic from the component to allow
 * for test overrides while keeping production code clean.
 * 
 * @param enableFunctionCalling - Whether function calling is enabled (from URL param)
 * @param functionType - Type of function definition to use ('standard', 'minimal', 'minimal-with-required')
 * @param testOverride - Optional test override functions (from window.testFunctions in E2E tests)
 * @returns Array of function definitions or undefined if function calling is disabled
 * 
 * @example
 * ```typescript
 * // Production usage
 * const functions = getFunctionDefinitions(true, 'standard');
 * 
 * // Test usage with override
 * const testFunctions = [{ name: 'test', ... }];
 * const functions = getFunctionDefinitions(true, 'standard', testFunctions);
 * ```
 */
export function getFunctionDefinitions(
  enableFunctionCalling: boolean,
  functionType: string,
  testOverride?: AgentFunction[]
): AgentFunction[] | undefined {
  // Test override takes precedence (Issue #336)
  if (testOverride && Array.isArray(testOverride) && testOverride.length > 0) {
    console.log(`[FUNCTION-DEFS] Using test override (${testOverride.length} functions)`);
    return testOverride;
  }
  
  // If function calling is not enabled, return undefined
  if (!enableFunctionCalling) {
    return undefined;
  }
  
  // Production function definitions based on functionType
  if (functionType === 'minimal') {
    // Absolute minimal function definition
    return [
      {
        name: 'test',
        description: 'test',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];
  } else if (functionType === 'minimal-with-required') {
    // Minimal function with explicit required array
    return [
      {
        name: 'test',
        description: 'test',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  } else {
    // Standard function (default)
    // Per Deepgram docs: if endpoint is not provided, function is called client-side
    // client_side property is NOT part of Settings message - it only appears in FunctionCallRequest responses
    return [
      {
        name: 'get_current_time',
        description: 'Get the current time in a specific timezone. Use this when users ask about the time, what time it is, or current time.',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.'
            }
          }
        }
        // No endpoint = client-side function (per Deepgram API spec)
      }
    ];
  }
}

