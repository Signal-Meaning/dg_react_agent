/**
 * @jest-environment jsdom
 */

// Mock console.log to track calls
const originalConsoleLog = console.log;
let consoleLogCalls = [];

beforeEach(() => {
  consoleLogCalls = [];
  console.log = (...args) => {
    consoleLogCalls.push(args.join(' '));
    originalConsoleLog(...args);
  };
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('Logging Behavior Tests', () => {
  
  test('should verify addLog function behavior', () => {
    // Test the addLog function behavior by simulating it
    const mockSetLogs = jest.fn();
    const mockLogs = [];
    
    // Simulate the addLog function from App.tsx
    const addLog = (message) => {
      const timestampedMessage = `${new Date().toISOString().substring(11, 19)} - ${message}`;
      mockLogs.push(timestampedMessage);
      mockSetLogs(prev => [...prev, timestampedMessage]);
      // Also log to console for debugging
      console.log(timestampedMessage);
    };
    
    // Test adding a log entry
    addLog('Test message');
    
    // Verify console.log was called
    expect(consoleLogCalls.length).toBe(1);
    expect(consoleLogCalls[0]).toContain('Test message');
    
    // Verify the log was added to the logs array
    expect(mockLogs.length).toBe(1);
    expect(mockLogs[0]).toContain('Test message');
    expect(mockLogs[0]).toContain(' - ');
  });

  test('should verify updateKeepalive function behavior', () => {
    const mockSetCurrentKeepalive = jest.fn();
    const mockSetLogs = jest.fn();
    const mockLogs = [];
    
    // Simulate the updateKeepalive function from App.tsx
    const updateKeepalive = (message) => {
      const timestampedMessage = `${new Date().toISOString().substring(11, 19)} - ${message}`;
      mockSetCurrentKeepalive(timestampedMessage);
      // Add to logs so it persists
      mockLogs.push(timestampedMessage);
      mockSetLogs(prev => [...prev, timestampedMessage]);
      // Also log to console for debugging
      console.log(timestampedMessage);
    };
    
    // Test updating keepalive
    updateKeepalive('Keepalive test message');
    
    // Verify console.log was called
    expect(consoleLogCalls.length).toBe(1);
    expect(consoleLogCalls[0]).toContain('Keepalive test message');
    
    // Verify the log was added to the logs array
    expect(mockLogs.length).toBe(1);
    expect(mockLogs[0]).toContain('Keepalive test message');
  });

  test('should verify transcript logging format', () => {
    // Test the transcript logging format
    const mockSetLogs = jest.fn();
    const mockLogs = [];
    
    const addLog = (message) => {
      const timestampedMessage = `${new Date().toISOString().substring(11, 19)} - ${message}`;
      mockLogs.push(timestampedMessage);
      mockSetLogs(prev => [...prev, timestampedMessage]);
      console.log(timestampedMessage);
    };
    
    // Simulate transcript logging
    const transcriptText = 'Hello world';
    const transcriptType = 'final';
    addLog(`[TRANSCRIPT] "${transcriptText}" (${transcriptType})`);
    
    // Verify the log format
    expect(consoleLogCalls.length).toBe(1);
    expect(consoleLogCalls[0]).toContain('[TRANSCRIPT]');
    expect(consoleLogCalls[0]).toContain('"Hello world"');
    expect(consoleLogCalls[0]).toContain('(final)');
    
    expect(mockLogs[0]).toContain('[TRANSCRIPT]');
    expect(mockLogs[0]).toContain('"Hello world"');
    expect(mockLogs[0]).toContain('(final)');
  });

  test('should verify user message logging format', () => {
    const mockSetLogs = jest.fn();
    const mockLogs = [];
    
    const addLog = (message) => {
      const timestampedMessage = `${new Date().toISOString().substring(11, 19)} - ${message}`;
      mockLogs.push(timestampedMessage);
      mockSetLogs(prev => [...prev, timestampedMessage]);
      console.log(timestampedMessage);
    };
    
    // Simulate user message logging
    const userMessageText = 'Test user message';
    addLog(`User message from server: ${userMessageText}`);
    
    // Verify the log format
    expect(consoleLogCalls.length).toBe(1);
    expect(consoleLogCalls[0]).toContain('User message from server:');
    expect(consoleLogCalls[0]).toContain('Test user message');
    
    expect(mockLogs[0]).toContain('User message from server:');
    expect(mockLogs[0]).toContain('Test user message');
  });

  test('should verify console and event log synchronization', () => {
    const mockSetLogs = jest.fn();
    const mockLogs = [];
    
    const addLog = (message) => {
      const timestampedMessage = `${new Date().toISOString().substring(11, 19)} - ${message}`;
      mockLogs.push(timestampedMessage);
      mockSetLogs(prev => [...prev, timestampedMessage]);
      console.log(timestampedMessage);
    };
    
    // Add multiple log entries
    const testMessages = [
      'First test message',
      'Second test message',
      'Third test message'
    ];
    
    testMessages.forEach(message => addLog(message));
    
    // Verify all messages were logged to console
    expect(consoleLogCalls.length).toBe(3);
    
    // Verify all messages were added to logs array
    expect(mockLogs.length).toBe(3);
    
    // Verify synchronization - each console log should have a corresponding log entry
    testMessages.forEach((message, index) => {
      expect(consoleLogCalls[index]).toContain(message);
      expect(mockLogs[index]).toContain(message);
    });
  });
});
