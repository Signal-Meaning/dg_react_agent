/**
 * Closure Issue Test Page - Issue #311
 * 
 * This test page reproduces the customer's scenario:
 * 1. Component renders without functions
 * 2. Connection is established
 * 3. agentOptions is updated with functions (new reference)
 * 4. Component should re-send Settings with functions
 * 
 * This page is used by E2E tests to verify the re-send behavior.
 */

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import DeepgramVoiceInteraction from '../../src/components/DeepgramVoiceInteraction';
import { 
  DeepgramVoiceInteractionHandle,
  AgentOptions,
  AgentFunction
} from '../../src/types';

// Expose update function to window for E2E tests
declare global {
  interface Window {
    updateAgentOptions?: (options: { functions?: AgentFunction[] }) => void;
    closureTestRef?: React.RefObject<DeepgramVoiceInteractionHandle>;
  }
}

export function ClosureIssueTestPage() {
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
  const ref = useRef<DeepgramVoiceInteractionHandle>(null);
  
  // State to control whether functions are included
  const [hasFunctions, setHasFunctions] = useState(false);
  
  // Memoized agentOptions that updates when hasFunctions changes
  const agentOptions = useMemo<AgentOptions>(() => {
    const baseOptions: AgentOptions = {
      language: 'en',
      listenModel: 'nova-3',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.',
      greeting: 'Hello! How can I help you?',
    };
    
    // Add functions only if hasFunctions is true
    if (hasFunctions) {
      baseOptions.functions = [{
        name: 'test_function',
        description: 'Test function to verify re-send',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Test query' }
          },
          required: ['query']
        }
      }];
    }
    
    return baseOptions;
  }, [hasFunctions]);
  
  // Expose update function to window for E2E tests
  const updateAgentOptions = useCallback((options: { functions?: AgentFunction[] }) => {
    console.log('[TEST PAGE] updateAgentOptions called:', options);
    // Update state to trigger new agentOptions reference
    setHasFunctions(options.functions !== undefined && options.functions.length > 0);
  }, []);
  
  useEffect(() => {
    (window as any).updateAgentOptions = updateAgentOptions;
    (window as any).closureTestRef = ref;
    
    return () => {
      delete (window as any).updateAgentOptions;
      delete (window as any).closureTestRef;
    };
  }, [updateAgentOptions]);
  
  // Track connection state for E2E tests
  const [connectionState, setConnectionState] = useState<string>('closed');
  
  return (
    <div data-testid="closure-issue-test-page">
      <h1>Closure Issue Test - Issue #311</h1>
      <div>
        <p>Functions enabled: {hasFunctions ? 'Yes' : 'No'}</p>
        <p data-testid="connection-status">{connectionState}</p>
        <button 
          onClick={() => setHasFunctions(!hasFunctions)}
          data-testid="toggle-functions-button"
        >
          Toggle Functions
        </button>
      </div>
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={apiKey}
        agentOptions={agentOptions}
        debug={true}
        onConnectionStateChange={(states) => {
          setConnectionState(states.agent || 'closed');
        }}
      />
    </div>
  );
}

