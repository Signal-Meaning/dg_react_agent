/**
 * Shared documentation constants to promote DRY principles
 * and ensure consistency across README, JSDoc, and other docs
 */

export const MEMOIZATION_WARNING = {
  TITLE: '⚠️ Critical: Options Props Must Be Memoized',
  DESCRIPTION: 'The `agentOptions` and `transcriptionOptions` props MUST be memoized using `useMemo` to prevent infinite re-initialization and poor performance.',
  
  CORRECT_USAGE: `\`\`\`tsx
const agentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-3',
  // ... other options
}), []); // Empty dependency array for static config

const transcriptionOptions = useMemo(() => ({
  model: 'nova-2',
  language: 'en-US',
  // ... other options
}), []);

<DeepgramVoiceInteraction 
  agentOptions={agentOptions}
  transcriptionOptions={transcriptionOptions}
/>
\`\`\``,

  INCORRECT_USAGE: `\`\`\`tsx
// DON'T DO THIS - causes infinite re-initialization
<DeepgramVoiceInteraction 
  agentOptions={{
    language: 'en',
    listenModel: 'nova-3',
  }}
  transcriptionOptions={{
    model: 'nova-2',
    language: 'en-US',
  }}
/>
\`\`\``,

  CONSEQUENCES: `**Why?** The component's main useEffect depends on these props. Inline objects create new references on every render, causing the component to tear down and recreate WebSocket connections constantly, leading to:
- Infinite re-initialization loops
- Console spam with repeated logs
- Poor performance and unnecessary network traffic
- Potential connection rate limiting`,

  DEV_WARNING: '**Development Warning:** In development mode, the component will warn you if it detects non-memoized options props.'
};

// Component requires explicit start() call with service flags
