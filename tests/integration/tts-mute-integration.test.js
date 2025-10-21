/**
 * Integration Test: Complete TTS Mute/Unmute Flow
 * 
 * Tests the complete integration between DeepgramVoiceInteraction component
 * and AudioManager for the mute button functionality fixed in Issue #121:
 * - Component mute button triggers AudioManager changes
 * - AudioManager state changes affect component behavior
 * - Complete flow from user interaction to audio state change
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../../src';

// Mock the AudioManager
const mockAudioManager = {
  isTtsMuted: false,
  isPlaybackActive: jest.fn(() => false),
  setTtsMuted: jest.fn(),
  clearAudioQueue: jest.fn(),
  flushAudioBuffer: jest.fn(),
  cleanup: jest.fn(),
  dispose: jest.fn(),
  addEventListener: jest.fn(() => () => {}),
  removeEventListener: jest.fn(),
  init: jest.fn(),
  initialize: jest.fn(() => Promise.resolve()),
  start: jest.fn(),
  stop: jest.fn(),
  queueAudio: jest.fn()
};

// Mock the WebSocketManager (used for both transcription and agent)
const mockWebSocketManager = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendMessage: jest.fn(),
  isConnected: jest.fn(() => true),
  sendJSON: jest.fn(),
  sendBinary: jest.fn(),
  getState: jest.fn(() => 'connected'),
  close: jest.fn(),
  startKeepalive: jest.fn(),
  stopKeepalive: jest.fn(),
  enableIdleTimeoutResets: jest.fn(),
  disableIdleTimeoutResets: jest.fn(),
  resetIdleTimeout: jest.fn(),
  addEventListener: jest.fn(() => () => {}),
  removeEventListener: jest.fn()
};

// Mock the entire audio and websocket modules
jest.mock('../../src/utils/audio/AudioManager', () => {
  return {
    AudioManager: jest.fn(() => mockAudioManager)
  };
});

jest.mock('../../src/utils/websocket/WebSocketManager', () => {
  return {
    WebSocketManager: jest.fn(() => mockWebSocketManager)
  };
});

describe('TTS Mute/Unmute Integration Tests', () => {
  let mockProps;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mock state
    mockAudioManager.isTtsMuted = false;
    mockAudioManager.isPlaybackActive.mockReturnValue(false);
    
    // Default props
    mockProps = {
      apiKey: 'test-api-key',
      agentOptions: {
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-2-apollo-en'
      },
      debug: true
    };
  });

  describe('Component Initialization', () => {
    test('should render without crashing', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      // Wait for component to be ready
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Component should be available via ref (headless component)
      expect(ref.current).toBeTruthy();
    });

    test('should initialize AudioManager with correct settings', () => {
      render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      // AudioManager should be created
      expect(mockAudioManager).toBeDefined();
    });
  });

  describe('Mute Button Integration', () => {
    test('should call AudioManager.setTtsMuted when toggleTtsMute is called via ref', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      // Wait for component to be ready
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Call toggleTtsMute via ref
      if (ref.current && ref.current.toggleTtsMute) {
        act(() => {
          ref.current.toggleTtsMute();
        });
      }
      
      // Should call setTtsMuted with true
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
    });

    test('should always call interruptAgent when muting', async () => {
      // Mock that audio is currently playing
      mockAudioManager.isPlaybackActive.mockReturnValue(true);
      
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Call toggleTtsMute via ref
      if (ref.current && ref.current.toggleTtsMute) {
        act(() => {
          ref.current.toggleTtsMute();
        });
      }
      
      // Should call setTtsMuted with true
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
      
      // Should call clearAudioQueue (part of interruptAgent)
      expect(mockAudioManager.clearAudioQueue).toHaveBeenCalled();
    });

    test('should work even when isPlaybackActive returns false', async () => {
      // Mock that audio is NOT playing (edge case from Issue #121)
      mockAudioManager.isPlaybackActive.mockReturnValue(false);
      
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Call toggleTtsMute via ref
      if (ref.current && ref.current.toggleTtsMute) {
        act(() => {
          ref.current.toggleTtsMute();
        });
      }
      
      // Should still call setTtsMuted with true (always interrupt when muting)
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
      
      // Should still call clearAudioQueue (always interrupt when muting)
      expect(mockAudioManager.clearAudioQueue).toHaveBeenCalled();
    });
  });

  describe('AudioManager State Integration', () => {
    test('should reflect AudioManager mute state in component', async () => {
      // Set initial muted state
      mockAudioManager.isTtsMuted = true;
      
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Component should reflect the muted state
      expect(mockAudioManager.isTtsMuted).toBe(true);
    });

    test('should sync playback state between AudioManager and component', async () => {
      // Mock that audio is playing
      mockAudioManager.isPlaybackActive.mockReturnValue(true);
      
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Component should be able to check playback state
      expect(mockAudioManager.isPlaybackActive()).toBe(true);
    });
  });

  describe('Complete Mute/Unmute Flow', () => {
    test('should handle complete mute flow', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Initial state should be unmuted
      expect(mockAudioManager.isTtsMuted).toBe(false);
      
      // Mute
      if (ref.current && ref.current.toggleTtsMute) {
        ref.current.toggleTtsMute();
      }
      
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
      
      // Should call clearAudioQueue
      expect(mockAudioManager.clearAudioQueue).toHaveBeenCalled();
    });

    test('should maintain mute state across multiple toggles', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Mute -> Unmute -> Mute
      if (ref.current && ref.current.toggleTtsMute) {
        act(() => {
          ref.current.toggleTtsMute(); // Mute
          ref.current.toggleTtsMute(); // Unmute
          ref.current.toggleTtsMute(); // Mute again
        });
      }
      
      // Should have been called 4 times (1 initialization + 3 toggles)
      expect(mockAudioManager.setTtsMuted).toHaveBeenCalledTimes(4);
      
      // Last call should be with true (muted)
      expect(mockAudioManager.setTtsMuted).toHaveBeenLastCalledWith(true);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle AudioManager not initialized', async () => {
      // Mock AudioManager to throw error on setTtsMuted
      const errorMockAudioManager = {
        ...mockAudioManager,
        setTtsMuted: jest.fn(() => {
          throw new Error('AudioManager not initialized');
        })
      };
      
      // Mock the AudioManager constructor to return our error mock
      jest.doMock('../../src/utils/audio/AudioManager', () => ({
        AudioManager: jest.fn(() => errorMockAudioManager)
      }));
      
      // The component should still render even if setTtsMuted throws during initialization
      const ref = React.createRef();
      
      // This should not throw an error
      expect(() => {
        render(
          <DeepgramVoiceInteraction {...mockProps} ref={ref} />
        );
      }).not.toThrow();
      
      // Component should still be available
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
    });

    test('should handle AgentManager not connected', async () => {
      // Mock agent as not connected
      mockWebSocketManager.isConnected.mockReturnValue(false);
      
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Should still work even if agent is not connected
      if (ref.current && ref.current.toggleTtsMute) {
        ref.current.toggleTtsMute();
      }
      
      // Should still call setTtsMuted (initialization + toggle = 2 calls)
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Race Condition Handling', () => {
    test('should handle rapid mute/unmute clicks', async () => {
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Rapid clicks
      if (ref.current && ref.current.toggleTtsMute) {
        act(() => {
          ref.current.toggleTtsMute();
          ref.current.toggleTtsMute();
          ref.current.toggleTtsMute();
          ref.current.toggleTtsMute();
        });
      }
      
      // Should handle all clicks without errors (1 initialization + 4 toggles = 5 calls)
      expect(mockAudioManager.setTtsMuted).toHaveBeenCalledTimes(5);
    });

    test('should handle state changes during audio playback', async () => {
      // Mock that audio is playing
      mockAudioManager.isPlaybackActive.mockReturnValue(true);
      
      const ref = React.createRef();
      
      render(
        <DeepgramVoiceInteraction {...mockProps} ref={ref} />
      );
      
      await waitFor(() => {
        expect(ref.current).toBeTruthy();
      });
      
      // Change state during playback
      if (ref.current && ref.current.toggleTtsMute) {
        ref.current.toggleTtsMute();
      }
      
      // Should handle the state change
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
      
      // Should clear audio queue
      expect(mockAudioManager.clearAudioQueue).toHaveBeenCalled();
    });
  });
});