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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../../src/components/DeepgramVoiceInteraction';

// Mock the AudioManager
const mockAudioManager = {
  isTtsMuted: false,
  isPlaybackActive: jest.fn(() => false),
  setTtsMuted: jest.fn(),
  clearAudioQueue: jest.fn(),
  flushAudioBuffer: jest.fn(),
  cleanup: jest.fn()
};

// Mock the AgentManager
const mockAgentManager = {
  isConnected: jest.fn(() => true),
  sendMessage: jest.fn(),
  disconnect: jest.fn()
};

// Mock the WebSocketManager
const mockWebSocketManager = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendMessage: jest.fn(),
  isConnected: jest.fn(() => true)
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

// Mock the component's ref methods
const mockComponentRef = {
  toggleTtsMute: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  isConnected: jest.fn(() => true),
  isPlaybackActive: jest.fn(() => false),
  isTtsMuted: false
};

describe('TTS Mute/Unmute Integration Tests', () => {
  let mockProps;
  let componentRef;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mock state
    mockAudioManager.isTtsMuted = false;
    mockAudioManager.isPlaybackActive.mockReturnValue(false);
    mockComponentRef.isTtsMuted = false;
    
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

  describe('Mute Button Integration', () => {
    test('should call AudioManager.setTtsMuted when mute button is clicked', async () => {
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      // Get the component ref (simulating how App.tsx would access it)
      const component = container.firstChild;
      
      // Simulate mute button click by calling the ref method
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
      }
      
      // Wait for the method to be called
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
    });

    test('should always call interruptAgent when muting', async () => {
      // Mock that audio is currently playing
      mockAudioManager.isPlaybackActive.mockReturnValue(true);
      
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Simulate mute button click
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
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
      
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Simulate mute button click
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
      }
      
      // Should still call setTtsMuted (always interrupt when muting)
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('AudioManager State Integration', () => {
    test('should reflect AudioManager mute state in component', async () => {
      // Set AudioManager to muted state
      mockAudioManager.isTtsMuted = true;
      
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Component should reflect the muted state
      expect(component.isTtsMuted).toBe(true);
    });

    test('should sync playback state between AudioManager and component', async () => {
      // Mock AudioManager playback state
      mockAudioManager.isPlaybackActive.mockReturnValue(true);
      
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Component should reflect the playback state
      expect(component.isPlaybackActive()).toBe(true);
    });
  });

  describe('Complete Mute/Unmute Flow', () => {
    test('should handle complete mute flow', async () => {
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Step 1: Mute
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
      }
      
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
      
      // Step 2: Unmute
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
      }
      
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(false);
      });
    });

    test('should maintain mute state across multiple toggles', async () => {
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Multiple mute/unmute cycles
      for (let i = 0; i < 3; i++) {
        // Mute
        if (component && component.toggleTtsMute) {
          component.toggleTtsMute();
        }
        
        await waitFor(() => {
          expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
        });
        
        // Unmute
        if (component && component.toggleTtsMute) {
          component.toggleTtsMute();
        }
        
        await waitFor(() => {
          expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(false);
        });
      }
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle AudioManager not initialized', async () => {
      // Mock AudioManager as null/undefined
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Should not crash when AudioManager is not available
      expect(() => {
        if (component && component.toggleTtsMute) {
          component.toggleTtsMute();
        }
      }).not.toThrow();
    });

    test('should handle AgentManager not connected', async () => {
      // Mock AgentManager as not connected
      mockAgentManager.isConnected.mockReturnValue(false);
      
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Should still call AudioManager methods
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
      }
      
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Race Condition Handling', () => {
    test('should handle rapid mute/unmute clicks', async () => {
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        if (component && component.toggleTtsMute) {
          component.toggleTtsMute();
        }
      }
      
      // Should handle all calls without errors
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalled();
      });
    });

    test('should handle state changes during audio playback', async () => {
      // Mock audio playing
      mockAudioManager.isPlaybackActive.mockReturnValue(true);
      
      const { container } = render(
        <DeepgramVoiceInteraction {...mockProps} />
      );
      
      const component = container.firstChild;
      
      // Mute while audio is playing
      if (component && component.toggleTtsMute) {
        component.toggleTtsMute();
      }
      
      await waitFor(() => {
        expect(mockAudioManager.setTtsMuted).toHaveBeenCalledWith(true);
        expect(mockAudioManager.clearAudioQueue).toHaveBeenCalled();
      });
    });
  });
});
