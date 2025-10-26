/**
 * Deepgram Voice Interaction
 * 
 * A React component library for integrating with Deepgram's voice agent and transcription services
 */

// Export the main component
export { default as DeepgramVoiceInteraction } from './components/DeepgramVoiceInteraction';

// Export utilities for testing
export { WebSocketManager } from './utils/websocket/WebSocketManager';
export { AudioManager } from './utils/audio/AudioManager';

// Export services
export { AgentStateService } from './services/AgentStateService';

// Export test utilities
export * from './test-utils';

// Export types
export * from './types';

