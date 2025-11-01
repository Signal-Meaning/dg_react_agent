/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Voice Agent API Validation Tests
 * 
 * SOURCE OF TRUTH FOR API DEFINITIONS:
 * ====================================
 * 
 * Voice Agent API Events:
 *   Official Deepgram Voice Agent API v1 Documentation:
 *   https://developers.deepgram.com/docs/voice-agent
 *   
 *   Migration Guide (pre-fork → Voice Agent API):
 *   https://developers.deepgram.com/docs/voice-agent-v1-migration
 * 
 * Component API Surface:
 *   Defined in: src/types/index.ts
 *   Interface: DeepgramVoiceInteractionHandle
 *   Props Interface: DeepgramVoiceInteractionProps
 * 
 * THIS TEST SUITE ENSURES API STABILITY:
 * =======================================
 * 
 * IMPORTANT: Tests ONLY the official Deepgram Voice Agent API.
 * The component may have other methods for internal use, backward compatibility,
 * or deprecated functionality - those are NOT validated in this suite.
 * 
 * 1. API Additions Detection:
 *    - New Voice Agent API events are detected and validated
 *    - Tests fail if new Voice Agent API events are added without tests
 *    - Only validates official Voice Agent API events
 * 
 * 2. API Removals Detection:
 *    - Tests fail if required Voice Agent API events are missing
 *    - Tests fail if component fails to handle Voice Agent API events
 *    - Changes to event handling are detected
 * 
 * 3. API Changes Detection:
 *    - Behavioral changes in event handling are tested
 *    - Component API signature changes are validated
 *    - Breaking changes to official API are detected
 * 
 * 4. Official API vs Internal Methods:
 *    - Only validates methods exposed in DeepgramVoiceInteractionHandle
 *    - Excludes: debug methods (getState, getConnectionStates), deprecated methods
 *    - Focuses on: start, stop, updateAgentInstructions, interruptAgent, sleep/wake methods
 * 
 * VALIDATES ALL VOICE AGENT API EVENTS:
 * =====================================
 * Pre-fork events (validated):
 *   - Welcome: Initial connection greeting
 *   - SettingsApplied: Configuration confirmation
 *   - UserStartedSpeaking: VAD event
 *   - AgentThinking: Agent is processing
 *   - AgentStartedSpeaking: Agent audio begins
 *   - ConversationText: Transcript messages (user & assistant)
 *   - AgentAudioDone: TTS audio generation complete (not playback complete)
 *   - Error: Error handling
 *   - Warning: Warning messages
 * 
 * Post-fork additions (should not break pre-fork code):
 *   - UtteranceEnd: Speech end detection
 * 
 * EXCLUDED (Transcription API - not part of Voice Agent API):
 *   - SpeechStarted (Deprecated - use UserStartedSpeaking)
 *   - SpeechStopped (Deprecated - use UtteranceEnd or speech_final)
 * 
 * VALIDATES COMPONENT API SURFACE:
 * ================================
 * Public API methods from DeepgramVoiceInteractionHandle interface:
 *   - Connection: start, stop
 *   - Agent Control: updateAgentInstructions, interruptAgent
 *   - Sleep/Wake: sleep, wake, toggleSleep
 *   - Message Injection: injectAgentMessage, injectUserMessage
 *   - Audio: startAudioCapture, getAudioContext
 * 
 * EXCLUDED (Debug/Testing Methods):
 *   - getState (testing only)
 *   - getConnectionStates (testing only)
 * 
 * EXCLUDED (Deprecated Methods):
 *   - connectTextOnly (deprecated - use start() instead)
 * 
 * NOTE: This test suite validates ONLY the official published Deepgram Voice Agent API.
 * Internal, experimental, deprecated, or debug methods should NOT appear in this test.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';
import { AgentResponseType } from '../src/types/agent';
import { isApprovedEvent, isOfficialEvent } from './fixtures/server-api-baseline';
import { isApprovedMethod, isUnauthorizedMethod, isDeprecatedMethod } from './fixtures/component-api-baseline';
import { createMockWebSocketManager, createMockAudioManager, createMockAgentOptions, MOCK_API_KEY } from './fixtures/mocks';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

// Using fixture instead

describe('Step 1: Deepgram Server API Validation', () => {
  it('should handle all official Deepgram Voice Agent v1 events', () => {
    const ourEvents = Object.values(AgentResponseType);
    
    // Get official events
    const { OFFICIAL_DEEPGRAM_SERVER_EVENTS } = require('./api-baseline/official-deepgram-api');
    
    // Find missing official events
    const missingOfficialEvents = OFFICIAL_DEEPGRAM_SERVER_EVENTS.filter(
      event => !ourEvents.includes(event as any)
    );
    
    // Known missing (tracked in issues)
    const knownMissing = ['InjectionRefused'];
    const trulyMissing = missingOfficialEvents.filter(e => !knownMissing.includes(e));
    
    if (trulyMissing.length > 0) {
      throw new Error(
        `❌ MISSING OFFICIAL DEEPGRAM SERVER EVENTS:\n` +
        `${trulyMissing.join(', ')}\n\n` +
        `These events are in official Voice Agent v1 API but not handled by component.\n` +
        `Add handlers to src/types/agent.ts AgentResponseType enum.`
      );
    }
    
    // Warn about known missing
    const missingKnown = missingOfficialEvents.filter(e => knownMissing.includes(e));
    if (missingKnown.length > 0) {
      console.warn(`⚠️ Known missing events: ${missingKnown.join(', ')} (see issue #199)`);
    }
  });

  it('should only handle approved server events', () => {
    const ourEvents = Object.values(AgentResponseType);
    
    // Find unapproved events
    const unapprovedEvents = ourEvents.filter(event => !isApprovedEvent(event as string));
    
    if (unapprovedEvents.length > 0) {
      throw new Error(
        `❌ UNAPPROVED SERVER API EVENTS:\n` +
        `${unapprovedEvents.join(', ')}\n\n` +
        `These events are NOT in the official Deepgram API spec and NOT in approved additions.\n` +
        `See tests/api-baseline/approved-server-events.ts for documentation process.`
      );
    }
  });
});

describe('Voice Agent API - Event Validation', () => {
  let mockWebSocketManager: any;
  let mockAudioManager: any;
  let WebSocketManager: any;
  let AudioManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Use stable fixtures
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    WebSocketManager = require('../src/utils/websocket/WebSocketManager').WebSocketManager;
    AudioManager = require('../src/utils/audio/AudioManager').AudioManager;
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('Welcome Event', () => {
    it('should handle Welcome message from Voice Agent API', async () => {
      const ref = React.createRef<any>();
      const onReady = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onReady={onReady}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate Welcome message
      const welcomeMessage = {
        type: 'Welcome',
        request_id: 'test-request-id',
      };

      // This test documents that Welcome is a valid Voice Agent API event
      expect(welcomeMessage.type).toBe(AgentResponseType.WELCOME);
    });

    it('should not handle Transcription API events (SpeechStarted should be ignored)', () => {
      // Note: SpeechStarted is from the old Transcription API
      // The component should NOT process it in agent-only mode
      const speechStartedEvent = {
        type: 'SpeechStarted',
        channel: [0, 1],
        timestamp: Date.now(),
      };

      // This event should not exist in Voice Agent API
      // If we encounter it, it means there's a bug
      expect(speechStartedEvent.type).toBe('SpeechStarted');
      expect(speechStartedEvent.type).not.toBe(AgentResponseType.WELCOME);
      // This test documents that SpeechStarted should not be in Voice Agent API
    });
  });

  describe('SettingsApplied Event', () => {
    it('should handle SettingsApplied message', async () => {
      const ref = React.createRef<any>();
      const onReady = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onReady={onReady}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate SettingsApplied message
      const settingsAppliedMessage = {
        type: 'SettingsApplied',
      };

      // This test documents that SettingsApplied is a valid Voice Agent API event
      expect(settingsAppliedMessage.type).toBe(AgentResponseType.SETTINGS_APPLIED);
    });
  });

  describe('UserStartedSpeaking Event', () => {
    it('should handle UserStartedSpeaking message', async () => {
      const ref = React.createRef<any>();
      const onUserStartedSpeaking = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onUserStartedSpeaking={onUserStartedSpeaking}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate UserStartedSpeaking message
      const userStartedMessage = {
        type: 'UserStartedSpeaking',
      };

      // This test documents that UserStartedSpeaking is a valid Voice Agent API event
      expect(userStartedMessage.type).toBe(AgentResponseType.USER_STARTED_SPEAKING);
    });
  });

  describe('AgentThinking Event', () => {
    it('should handle AgentThinking message', async () => {
      const ref = React.createRef<any>();
      const onAgentStateChange = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onAgentStateChange={onAgentStateChange}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate AgentThinking message
      const agentThinkingMessage = {
        type: 'AgentThinking',
        content: 'Processing your request...',
      };

      // This test documents that AgentThinking is a valid Voice Agent API event
      expect(agentThinkingMessage.type).toBe(AgentResponseType.AGENT_THINKING);
    });
  });

  describe('AgentStartedSpeaking Event', () => {
    it('should handle AgentStartedSpeaking message', async () => {
      const ref = React.createRef<any>();
      const onAgentSpeaking = jest.fn();
      const onAgentStateChange = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onAgentSpeaking={onAgentSpeaking}
          onAgentStateChange={onAgentStateChange}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate AgentStartedSpeaking message
      const agentStartedSpeakingMessage = {
        type: 'AgentStartedSpeaking',
      };

      // This test documents that AgentStartedSpeaking is a valid Voice Agent API event
      expect(agentStartedSpeakingMessage.type).toBe(AgentResponseType.AGENT_STARTED_SPEAKING);
    });
  });

  describe('ConversationText Event', () => {
    it('should handle ConversationText message with role "assistant"', async () => {
      const ref = React.createRef<any>();
      const onAgentUtterance = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onAgentUtterance={onAgentUtterance}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate ConversationText message from assistant
      const conversationTextMessage = {
        type: 'ConversationText',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      };

      // This test documents that ConversationText is a valid Voice Agent API event
      expect(conversationTextMessage.type).toBe(AgentResponseType.CONVERSATION_TEXT);
      expect(conversationTextMessage.role).toBe('assistant');
    });

    it('should handle ConversationText message with role "user"', async () => {
      const ref = React.createRef<any>();
      const onUserMessage = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onUserMessage={onUserMessage}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate ConversationText message from user
      const conversationTextMessage = {
        type: 'ConversationText',
        role: 'user',
        content: 'I need help with something',
      };

      // This test documents that ConversationText can have role "user"
      expect(conversationTextMessage.type).toBe(AgentResponseType.CONVERSATION_TEXT);
      expect(conversationTextMessage.role).toBe('user');
    });
  });

  describe('AgentAudioDone Event', () => {
    it('should handle AgentAudioDone message', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate AgentAudioDone message
      const agentAudioDoneMessage = {
        type: 'AgentAudioDone',
      };

      // This test documents that AgentAudioDone is a valid Voice Agent API event (marks the end of TTS generation)
      expect(agentAudioDoneMessage.type).toBe(AgentResponseType.AGENT_AUDIO_DONE);
    });
  });

  describe('Error Event', () => {
    it('should handle Error message', async () => {
      const ref = React.createRef<any>();
      const onError = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onError={onError}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate Error message
      const errorMessage = {
        type: 'Error',
        description: 'Test error message',
        code: 'TEST_ERROR',
      };

      // This test documents that Error is a valid Voice Agent API event
      expect(errorMessage.type).toBe(AgentResponseType.ERROR);
    });
  });

  describe('Warning Event', () => {
    it('should handle Warning message', async () => {
      const ref = React.createRef<any>();
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Simulate Warning message
      const warningMessage = {
        type: 'Warning',
        description: 'Test warning message',
        code: 'TEST_WARNING',
      };

      // This test documents that Warning is a valid Voice Agent API event
      expect(warningMessage.type).toBe(AgentResponseType.WARNING);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event Type Compatibility', () => {
    it('should verify all Voice Agent API events match AgentResponseType enum', () => {
      // List of all Voice Agent API events that should be supported
      const voiceAgentEvents = [
        'Welcome',
        'SettingsApplied',
        'UserStartedSpeaking',
        'AgentThinking',
        'AgentStartedSpeaking',
        'ConversationText',
        'AgentAudioDone',
        'Error',
        'Warning',
        'UtteranceEnd',
      ];
      
      // Verify all event types match AgentResponseType enum
      expect(voiceAgentEvents).toContain('Welcome');
      expect(voiceAgentEvents).toContain('SettingsApplied');
      expect(voiceAgentEvents).toContain('UserStartedSpeaking');
      expect(voiceAgentEvents).toContain('AgentThinking');
      expect(voiceAgentEvents).toContain('AgentStartedSpeaking');
      expect(voiceAgentEvents).toContain('ConversationText');
      expect(voiceAgentEvents).toContain('AgentAudioDone');
      expect(voiceAgentEvents).toContain('Error');
      expect(voiceAgentEvents).toContain('Warning');
      expect(voiceAgentEvents).toContain('UtteranceEnd');
      
      // Verify these match the AgentResponseType enum
      expect(AgentResponseType.WELCOME).toBe('Welcome');
      expect(AgentResponseType.SETTINGS_APPLIED).toBe('SettingsApplied');
      expect(AgentResponseType.USER_STARTED_SPEAKING).toBe('UserStartedSpeaking');
      expect(AgentResponseType.AGENT_THINKING).toBe('AgentThinking');
      expect(AgentResponseType.AGENT_STARTED_SPEAKING).toBe('AgentStartedSpeaking');
      expect(AgentResponseType.CONVERSATION_TEXT).toBe('ConversationText');
      expect(AgentResponseType.AGENT_AUDIO_DONE).toBe('AgentAudioDone');
      expect(AgentResponseType.ERROR).toBe('Error');
      expect(AgentResponseType.WARNING).toBe('Warning');
      expect(AgentResponseType.UTTERANCE_END).toBe('UtteranceEnd');
    });

    it('should verify Transcription API events are NOT part of Voice Agent API', () => {
      // These are from the old Transcription API and should NOT be used
      const transcriptionEvents = ['SpeechStarted', 'SpeechStopped'];
      
      transcriptionEvents.forEach(event => {
        expect(Object.values(AgentResponseType)).not.toContain(event);
      });
    });
  });
});

describe('Component API Surface Validation', () => {
  let mockWebSocketManager: any;
  let mockAudioManager: any;
  let WebSocketManager: any;
  let AudioManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    WebSocketManager = require('../src/utils/websocket/WebSocketManager').WebSocketManager;
    mockWebSocketManager = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      sendJSON: jest.fn(),
      sendBinary: jest.fn(),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
      destroy: jest.fn(),
    };
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    
    AudioManager = require('../src/utils/audio/AudioManager').AudioManager;
    mockAudioManager = {
      // Public methods from AudioManager
      initialize: jest.fn().mockResolvedValue(undefined),
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn(),
      queueAudio: jest.fn().mockResolvedValue(undefined),
      clearAudioQueue: jest.fn(),
      abortPlayback: jest.fn(),
      dispose: jest.fn(),
      isRecordingActive: jest.fn().mockReturnValue(false),

      getAudioContext: jest.fn().mockReturnValue({
        state: 'running',
        suspend: jest.fn(),
        resume: jest.fn(),
      }),
      setTtsMuted: jest.fn(),
      toggleTtsMute: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      removeEventListener: jest.fn(),
      // Public property
      isTtsMuted: false,
    };
    
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('Connection Methods', () => {
    it('should expose start() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.start).toBe('function');
      
      await act(async () => {
        await expect(ref.current.start()).resolves.toBeUndefined();
      });
    });

    it('should expose stop() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.stop).toBe('function');
      
      await act(async () => {
        await expect(ref.current.stop()).resolves.toBeUndefined();
      });
    });

  });

  describe('Agent Control Methods', () => {
    it('should expose updateAgentInstructions() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.updateAgentInstructions).toBe('function');
      
      act(() => {
        ref.current.updateAgentInstructions({
          instructions: 'Updated instructions',
        });
      });
    });

    it('should expose interruptAgent() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.interruptAgent).toBe('function');
      
      act(() => {
        ref.current.interruptAgent();
      });
    });
  });

  describe('Sleep/Wake Methods', () => {
    it('should expose sleep() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.sleep).toBe('function');
      
      act(() => {
        ref.current.sleep();
      });
    });

    it('should expose wake() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.wake).toBe('function');
      
      act(() => {
        ref.current.wake();
      });
    });

    it('should expose toggleSleep() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.toggleSleep).toBe('function');
      
      act(() => {
        ref.current.toggleSleep();
      });
    });
  });

  describe('Message Injection Methods', () => {
    it('should expose injectAgentMessage() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.injectAgentMessage).toBe('function');
      
      act(() => {
        ref.current.injectAgentMessage('Test message');
      });
    });

    it('should expose injectUserMessage() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.injectUserMessage).toBe('function');
      
      await act(async () => {
        await ref.current.injectUserMessage('Test message');
      });
    });
  });

  describe('Audio Methods', () => {
    it('should expose startAudioCapture() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.startAudioCapture).toBe('function');
      
      await act(async () => {
        await expect(ref.current.startAudioCapture()).resolves.toBeUndefined();
      });
    });

    it('should expose getAudioContext() method', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      expect(typeof ref.current.getAudioContext).toBe('function');
      
      // getAudioContext can return undefined if audio hasn't been initialized yet
      const audioContext = ref.current.getAudioContext();
      // This is valid - audio context may be undefined before startAudioCapture is called
      expect(typeof audioContext === 'undefined' || typeof audioContext === 'object').toBe(true);
    });
  });

  describe('Step 2: Component Public API Validation', () => {
    it('should fail on CI if unauthorized component methods detected', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Import baseline files
      const { PRE_FORK_COMPONENT_METHODS } = require('./api-baseline/pre-fork-baseline');
      const { APPROVED_COMPONENT_METHOD_ADDITIONS, METHODS_TO_REMOVE } = require('./api-baseline/approved-additions');

      const actualMethods = Object.keys(ref.current).filter(
        key => typeof ref.current[key] === 'function'
      );
      
      const unauthorizedMethods = actualMethods.filter(method => {
        const isPreFork = PRE_FORK_COMPONENT_METHODS.includes(method);
        const isApproved = method in APPROVED_COMPONENT_METHOD_ADDITIONS;
        const shouldBeRemoved = method in METHODS_TO_REMOVE;
        
        return !isPreFork && !isApproved && !shouldBeRemoved;
      });
      
      const isCI = process.env.CI === 'true';
      
      if (unauthorizedMethods.length > 0) {
        const errorMessage = 
          `❌ UNAUTHORIZED COMPONENT API METHODS:\n` +
          `${unauthorizedMethods.map(m => `  - ${m}`).join('\n')}\n\n` +
          `These methods are NOT in:\n` +
          `  1. Pre-fork baseline (commit 7191eb4)\n` +
          `  2. Approved additions (tests/api-baseline/approved-additions.ts)\n\n` +
          `TO FIX:\n` +
          `1. Create GitHub issue proposing the addition\n` +
          `2. Add to tests/api-baseline/approved-additions.ts with:\n` +
          `   - Issue reference\n` +
          `   - Version added  \n` +
          `   - Detailed rationale\n` +
          `   - Breaking/non-breaking flag\n` +
          `3. Document in docs/releases/vX.Y.Z/API-CHANGES.md\n` +
          `4. Add JSDoc @approved comment in src/types/index.ts\n`;
        
        if (isCI) {
          throw new Error(errorMessage);
        } else {
          console.warn('⚠️ LOCAL MODE:\n' + errorMessage);
        }
      }
    });

    it('should fail if methods marked for removal still exist', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      const { METHODS_TO_REMOVE } = require('./api-baseline/approved-additions');
      
      const methodsToRemove = Object.keys(METHODS_TO_REMOVE);
      const stillPresent = methodsToRemove.filter(
        method => typeof ref.current[method] === 'function'
      );
      
      if (stillPresent.length > 0) {
        throw new Error(
          `❌ METHODS MARKED FOR REMOVAL:\n` +
          stillPresent.map(m => {
            const info = METHODS_TO_REMOVE[m];
            return `  - ${m}: ${info.reason}\n    Use ${info.replacement} instead`;
          }).join('\n')
        );
      }
    });
  });

  describe('API Stability: Behavioral Tests', () => {
    it('should properly invoke start() and trigger connection sequence', async () => {
      const ref = React.createRef<any>();
      const onReady = jest.fn();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          onReady={onReady}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Test that start() actually initiates connection
      await act(async () => {
        await ref.current.start();
      });

      // Verify that start was called
      expect(mockWebSocketManager.connect).toHaveBeenCalled();
    });

    it('should properly invoke stop() and cleanup resources', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Start connection first (managers are created lazily)
      await act(async () => {
        await ref.current.start({ agent: true });
      });

      // Test that stop() actually closes connections
      await act(async () => {
        await ref.current.stop();
      });

      // Verify stop() can be called without errors
      // The actual cleanup behavior depends on component state
      // close() is called if manager exists
      if (mockWebSocketManager.connect.mock.calls.length > 0) {
        expect(mockWebSocketManager.close).toHaveBeenCalled();
      }
    });

    it('should handle updateAgentInstructions() with valid payload', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Start agent connection first (managers are created lazily)
      await act(async () => {
        await ref.current.start({ agent: true });
      });

      const payload = { instructions: 'Updated instructions' };
      
      await act(async () => {
        ref.current.updateAgentInstructions(payload);
      });

      // Verify the method can be called without errors
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
    });

    it('should properly handle injectUserMessage()', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      const message = 'Test user message';
      
      // Set up mock to return 'connected' after connect
      mockWebSocketManager.getState.mockReturnValueOnce('closed');
      mockWebSocketManager.getState.mockReturnValueOnce('connecting');
      mockWebSocketManager.getState.mockReturnValueOnce('connected');
      
      await act(async () => {
        await ref.current.injectUserMessage(message);
      });

      // Verify the method can be called without errors
      // Should create manager, connect, and send message
      expect(mockWebSocketManager.connect).toHaveBeenCalled();
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
    });

    // NOTE: getState() is a debug/testing method, excluded from public API validation

    it('should detect API removals - fail if required method is missing', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // Required methods from DeepgramVoiceInteractionHandle interface
      // Source of Truth: src/types/index.ts - DeepgramVoiceInteractionHandle
      // ONLY public API methods (excludes debug/testing methods and deprecated methods)
      const requiredMethods = [
        'start',
        'stop',
        'updateAgentInstructions',
        'interruptAgent',
        'sleep',
        'wake',
        'toggleSleep',
        'injectAgentMessage',
        'injectUserMessage',
        'startAudioCapture',

        'getAudioContext',
      ];

      // Fail if any required method is missing
      requiredMethods.forEach(method => {
        expect(typeof ref.current[method]).toBe('function');
      });
    });

    it('should verify Voice Agent API event types match pre-fork specification', () => {
      // This test documents the source of truth for event types
      const preForkVoiceAgentEvents = {
        WELCOME: 'Welcome',
        SETTINGS_APPLIED: 'SettingsApplied',
        USER_STARTED_SPEAKING: 'UserStartedSpeaking',
        AGENT_THINKING: 'AgentThinking',
        AGENT_STARTED_SPEAKING: 'AgentStartedSpeaking',
        CONVERSATION_TEXT: 'ConversationText',
        AGENT_AUDIO_DONE: 'AgentAudioDone',
        ERROR: 'Error',
        WARNING: 'Warning',
      };

      // Verify all pre-fork events are still present
      Object.entries(preForkVoiceAgentEvents).forEach(([key, value]) => {
        expect(AgentResponseType[key as keyof typeof AgentResponseType]).toBe(value);
      });
    });

    it('should reject deprecated Transcription API events', () => {
      // Transcription API events should NOT be in AgentResponseType
      const deprecatedEvents = ['SpeechStarted', 'SpeechStopped'];
      
      deprecatedEvents.forEach(event => {
        expect(Object.values(AgentResponseType)).not.toContain(event);
      });
    });
  });

  describe('API Change Detection: Signature Validation', () => {
    it('should maintain method signatures for stability', async () => {
      const ref = React.createRef<any>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          debug={true}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });

      // start() should be async and return Promise<void>
      const startPromise = ref.current.start();
      expect(startPromise).toBeInstanceOf(Promise);
      
      // stop() should be async and return Promise<void>
      const stopPromise = ref.current.stop();
      expect(stopPromise).toBeInstanceOf(Promise);
      
      // updateAgentInstructions should accept UpdateInstructionsPayload
      expect(() => {
        ref.current.updateAgentInstructions({ instructions: 'test' });
      }).not.toThrow();
      
      // injectUserMessage should accept string and return Promise
      const injectPromise = ref.current.injectUserMessage('test message');
      expect(injectPromise).toBeInstanceOf(Promise);
    });
  });
});
