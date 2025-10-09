/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

const { getDefaultInstructions, loadInstructionsFromFile } = require('../src/utils/instructions-loader.cjs');

describe('DEEPGRAM_INSTRUCTIONS File and Environment Override - Core Functionality', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.DEEPGRAM_INSTRUCTIONS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Instructions Loading from File', () => {
    it('should load instructions from default file when no env override', async () => {
      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(instructions).toContain('e-commerce');
      expect(instructions).toContain('voice assistant');
    });

    it('should fallback to default instructions when file loading fails', async () => {
      // Arrange - try to load from non-existent file
      const nonExistentPath = '/non/existent/path/instructions.txt';

      // Act
      const instructions = await loadInstructionsFromFile(nonExistentPath);

      // Assert
      expect(instructions).toBe('You are a helpful voice assistant. Keep your responses concise and informative.');
    });
  });

  describe('Environment Variable Override', () => {
    it('should use DEEPGRAM_INSTRUCTIONS env var when set', async () => {
      // Arrange
      const envInstructions = 'Custom instructions from environment variable';
      process.env.DEEPGRAM_INSTRUCTIONS = envInstructions;

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(instructions).toBe(envInstructions);
    });

    it('should handle empty environment variable', async () => {
      // Arrange
      process.env.DEEPGRAM_INSTRUCTIONS = '';

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(instructions).toContain('e-commerce');
    });
  });

  describe('Default Instructions', () => {
    it('should return default instructions', () => {
      // Act
      const defaultInstructions = getDefaultInstructions();

      // Assert
      expect(defaultInstructions).toBe('You are a helpful voice assistant. Keep your responses concise and informative.');
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange - try to load from non-existent file
      const nonExistentPath = '/non/existent/path/instructions.txt';

      // Act
      const instructions = await loadInstructionsFromFile(nonExistentPath);

      // Assert
      expect(instructions).toBe('You are a helpful voice assistant. Keep your responses concise and informative.');
    });
  });
});
