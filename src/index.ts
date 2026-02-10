/**
 * Deepgram Voice Interaction
 * 
 * A React component library for integrating with Deepgram's voice agent and transcription services
 */

// Export the main component
export { default as DeepgramVoiceInteraction } from './components/DeepgramVoiceInteraction';

// Export types
export * from './types';

// Export shared logger (Issue #412 — partner apps can use for correlation)
export {
  getLogger,
  type Logger,
  type LogLevel,
  type LogEntry,
  type LogSink,
  type LoggerOptions,
} from './utils/logger';

// Export test utilities (for testing the component, not for public API)
export * from './test-utils';

