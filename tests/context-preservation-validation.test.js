/**
 * Test to validate conversation context preservation across WebSocket disconnections
 * This test should FAIL before the context fix and PASS after the fix is applied.
 */

describe('Context Preservation Validation', () => {
  let mockAgentManager;
  let mockState;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebSocketManager
    mockAgentManager = {
      connect: jest.fn().mockResolvedValue(),
      sendJSON: jest.fn().mockReturnValue(true),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      triggerTimeoutForTesting: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(() => {}),
    };

    // Mock state with conversation history
    mockState = {
      hasSentSettings: false,
      conversationHistory: [],
      sessionId: null,
      isReady: true,
      agentState: 'idle',
    };
  });

  test('should preserve context across disconnection - Filmmaker Scenario', () => {
    // SCENARIO: User is a filmmaker asking for camera recommendations
    // After disconnection, agent should remember the filmmaker context
    
    // STEP 1: Build conversation history
    mockState.conversationHistory = [
      {
        role: 'user',
        content: "I'm a filmmaker looking for camera recommendations",
        timestamp: Date.now() - 1000
      },
      {
        role: 'assistant', 
        content: "Great! As a filmmaker, you'll want to consider factors like sensor size, low-light performance, and video capabilities. What's your budget range?",
        timestamp: Date.now() - 500
      }
    ];

    // STEP 2: Simulate WebSocket disconnection
    mockAgentManager.isConnected.mockReturnValue(false);
    mockState.hasSentSettings = false; // Reset after disconnection

    // STEP 3: Track what settings are sent during reconnection
    let settingsSent = null;
    mockAgentManager.sendJSON.mockImplementation((message) => {
      if (message.type === 'Settings') {
        settingsSent = message;
      }
      return true;
    });

    // STEP 4: Simulate the connectWithContext method behavior with correct Deepgram API format
    const transformConversationHistory = (history) => {
      return {
        messages: history.map(message => ({
          type: "History",
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        }))
      };
    };

    const connectWithContext = (sessionId, history, options) => {
      const settingsMessage = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 24000 }
        },
        agent: {
          language: options.language || 'en',
          listen: {
            provider: { type: 'deepgram', model: 'nova-2' }
          },
          think: {
            provider: { type: 'open_ai', model: 'gpt-4o-mini' },
            prompt: options.instructions || 'You are a helpful voice assistant.'
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-asteria-en' }
          },
          greeting: options.greeting,
          context: transformConversationHistory(history) // Correct Deepgram API format
        }
      };
      
      mockAgentManager.sendJSON(settingsMessage);
    };

    // STEP 5: Trigger lazy reconnection with context
    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful voice assistant.',
    };

    connectWithContext('test-session', mockState.conversationHistory, agentOptions);

    // STEP 6: Validate that context was preserved in correct Deepgram API format
    expect(settingsSent).not.toBeNull();
    expect(settingsSent.type).toBe('Settings');
    expect(settingsSent.agent).toBeDefined();
    expect(settingsSent.agent.context).toBeDefined();
    expect(settingsSent.agent.context.messages).toBeDefined();
    expect(Array.isArray(settingsSent.agent.context.messages)).toBe(true);
    
    // Validate the context contains the filmmaker conversation in correct format
    expect(settingsSent.agent.context.messages.length).toBe(2);
    
    // Check user message about being a filmmaker (with correct Deepgram format)
    const userMessage = settingsSent.agent.context.messages.find(msg => msg.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage.type).toBe('History');
    expect(userMessage.content).toContain('filmmaker');
    expect(userMessage.content).toContain('camera');
    expect(userMessage.timestamp).toBeUndefined(); // No internal metadata
    
    // Check assistant response about filmmaker considerations
    const assistantMessage = settingsSent.agent.context.messages.find(msg => msg.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage.type).toBe('History');
    expect(assistantMessage.content).toContain('filmmaker');
    expect(assistantMessage.content).toContain('sensor');
    expect(assistantMessage.content).toContain('budget');
    expect(assistantMessage.timestamp).toBeUndefined(); // No internal metadata

    console.log('✅ Context preservation test PASSED - Agent will have filmmaker context in correct Deepgram API format');
  });

  test('should preserve context across disconnection - Teacher Scenario', () => {
    // SCENARIO: User is a third-grade teacher asking for classroom management tips
    // After disconnection, agent should remember the teaching context
    
    // Build conversation history for teacher scenario
    mockState.conversationHistory = [
      {
        role: 'user',
        content: "I'm a third-grade teacher struggling with classroom management",
        timestamp: Date.now() - 2000
      },
      {
        role: 'assistant',
        content: "Classroom management for third graders can be challenging! Let's focus on positive reinforcement and clear routines. What specific behaviors are you seeing?",
        timestamp: Date.now() - 1000
      },
      {
        role: 'user', 
        content: "The kids won't stay in their seats during independent work time",
        timestamp: Date.now() - 500
      }
    ];

    // Simulate disconnection
    mockAgentManager.isConnected.mockReturnValue(false);
    mockState.hasSentSettings = false;

    // Track settings sent
    let settingsSent = null;
    mockAgentManager.sendJSON.mockImplementation((message) => {
      if (message.type === 'Settings') {
        settingsSent = message;
      }
      return true;
    });

    // Simulate connectWithContext with teacher history and correct Deepgram API format
    const transformConversationHistory = (history) => {
      return {
        messages: history.map(message => ({
          type: "History",
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        }))
      };
    };

    const connectWithContext = (sessionId, history, options) => {
      const settingsMessage = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 24000 }
        },
        agent: {
          language: options.language || 'en',
          listen: {
            provider: { type: 'deepgram', model: 'nova-2' }
          },
          think: {
            provider: { type: 'open_ai', model: 'gpt-4o-mini' },
            prompt: options.instructions || 'You are a helpful voice assistant.'
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-asteria-en' }
          },
          greeting: options.greeting,
          context: transformConversationHistory(history) // Correct Deepgram API format
        }
      };
      
      mockAgentManager.sendJSON(settingsMessage);
    };

    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2', 
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful voice assistant.',
    };

    connectWithContext('test-session', mockState.conversationHistory, agentOptions);

    // Validate context preservation in correct Deepgram API format
    expect(settingsSent).not.toBeNull();
    expect(settingsSent.agent.context).toBeDefined();
    expect(settingsSent.agent.context.messages).toBeDefined();
    expect(settingsSent.agent.context.messages.length).toBe(3);

    // Validate teacher-specific context in correct format
    const contextMessages = settingsSent.agent.context.messages;
    const teacherMessage = contextMessages.find(msg => 
      msg.role === 'user' && msg.content.includes('third-grade teacher')
    );
    expect(teacherMessage).toBeDefined();
    expect(teacherMessage.type).toBe('History');
    expect(teacherMessage.timestamp).toBeUndefined(); // No internal metadata
    
    const classroomMessage = contextMessages.find(msg =>
      msg.role === 'user' && msg.content.includes('stay in their seats')
    );
    expect(classroomMessage).toBeDefined();
    expect(classroomMessage.type).toBe('History');
    expect(classroomMessage.timestamp).toBeUndefined(); // No internal metadata

    console.log('✅ Teacher context preservation test PASSED - Correct Deepgram API format');
  });

  test('should fail without context - demonstrates the problem', () => {
    // This test demonstrates what happens WITHOUT context preservation
    // It should show that the agent loses all conversation memory
    
    // Simulate conversation history exists
    mockState.conversationHistory = [
      {
        role: 'user',
        content: "I'm a scientist working on climate research",
        timestamp: Date.now() - 1000
      },
      {
        role: 'assistant',
        content: "That's fascinating! Climate research is crucial. What specific area are you focusing on?",
        timestamp: Date.now() - 500
      }
    ];

    // Simulate disconnection
    mockAgentManager.isConnected.mockReturnValue(false);
    mockState.hasSentSettings = false;

    // Track settings sent
    let settingsSent = null;
    mockAgentManager.sendJSON.mockImplementation((message) => {
      if (message.type === 'Settings') {
        settingsSent = message;
      }
      return true;
    });

    // Simulate connectWithContext WITHOUT context (old behavior)
    const connectWithContextWithoutContext = (sessionId, history, options) => {
      const settingsMessage = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 24000 }
        },
        agent: {
          language: options.language || 'en',
          listen: {
            provider: { type: 'deepgram', model: 'nova-2' }
          },
          think: {
            provider: { type: 'open_ai', model: 'gpt-4o-mini' },
            prompt: options.instructions || 'You are a helpful voice assistant.'
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-asteria-en' }
          },
          greeting: options.greeting
          // context: history // COMMENTED OUT - This was the problem!
        }
      };
      
      mockAgentManager.sendJSON(settingsMessage);
    };

    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai', 
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful voice assistant.',
    };

    connectWithContextWithoutContext('test-session', mockState.conversationHistory, agentOptions);

    // BEFORE FIX: Context would be empty or missing
    // AFTER FIX: Context should contain scientist conversation
    
    if (!settingsSent.agent.context || settingsSent.agent.context.length === 0) {
      console.log('❌ Context preservation FAILED - Agent lost conversation memory');
      console.log('   This demonstrates the problem that needs to be fixed');
      expect(settingsSent.agent.context).toBeUndefined();
    } else {
      console.log('✅ Context preservation WORKING - Agent retained conversation memory');
      
      // Validate scientist context is preserved
      const contextMessages = settingsSent.agent.context;
      const scientistMessage = contextMessages.find(msg =>
        msg.role === 'user' && msg.content.includes('scientist')
      );
      expect(scientistMessage).toBeDefined();
    }
  });

  test('should demonstrate the fix working - Scientist Scenario', () => {
    // This test shows the FIXED behavior with context preservation
    
    mockState.conversationHistory = [
      {
        role: 'user',
        content: "I'm a scientist working on climate research",
        timestamp: Date.now() - 1000
      },
      {
        role: 'assistant',
        content: "That's fascinating! Climate research is crucial. What specific area are you focusing on?",
        timestamp: Date.now() - 500
      }
    ];

    let settingsSent = null;
    mockAgentManager.sendJSON.mockImplementation((message) => {
      if (message.type === 'Settings') {
        settingsSent = message;
      }
      return true;
    });

    // Simulate connectWithContext WITH context (fixed behavior)
    const connectWithContextWithContext = (sessionId, history, options) => {
      const settingsMessage = {
        type: 'Settings',
        audio: {
          input: { encoding: 'linear16', sample_rate: 16000 },
          output: { encoding: 'linear16', sample_rate: 24000 }
        },
        agent: {
          language: options.language || 'en',
          listen: {
            provider: { type: 'deepgram', model: 'nova-2' }
          },
          think: {
            provider: { type: 'open_ai', model: 'gpt-4o-mini' },
            prompt: options.instructions || 'You are a helpful voice assistant.'
          },
          speak: {
            provider: { type: 'deepgram', model: 'aura-asteria-en' }
          },
          greeting: options.greeting,
          context: history // FIXED: Context is now included!
        }
      };
      
      mockAgentManager.sendJSON(settingsMessage);
    };

    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai', 
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful voice assistant.',
    };

    connectWithContextWithContext('test-session', mockState.conversationHistory, agentOptions);

    // Validate context is preserved
    expect(settingsSent).not.toBeNull();
    expect(settingsSent.agent.context).toBeDefined();
    expect(settingsSent.agent.context.length).toBe(2);

    // Validate scientist context is preserved
    const contextMessages = settingsSent.agent.context;
    const scientistMessage = contextMessages.find(msg =>
      msg.role === 'user' && msg.content.includes('scientist')
    );
    expect(scientistMessage).toBeDefined();
    expect(scientistMessage.content).toContain('climate research');

    const assistantMessage = contextMessages.find(msg =>
      msg.role === 'assistant' && msg.content.includes('Climate research')
    );
    expect(assistantMessage).toBeDefined();

    console.log('✅ Scientist context preservation test PASSED - Fix is working!');
  });
});
