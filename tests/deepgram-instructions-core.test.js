/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

const { loadInstructionsFromFile } = require('../src/utils/instructions-loader.cjs');

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

    it('should throw error when file loading fails', async () => {
      // Arrange - try to load from non-existent file
      const nonExistentPath = '/non/existent/path/instructions.txt';

      // Act & Assert
      await expect(loadInstructionsFromFile(nonExistentPath)).rejects.toThrow('No instructions found in file and no environment variable set');
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

    it('should fallback to file when environment variable is empty', async () => {
      // Arrange
      process.env.DEEPGRAM_INSTRUCTIONS = '';

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(instructions).toContain('e-commerce');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no instructions found', async () => {
      // Arrange - try to load from non-existent file
      const nonExistentPath = '/non/existent/path/instructions.txt';

      // Act & Assert
      await expect(loadInstructionsFromFile(nonExistentPath)).rejects.toThrow('No instructions found in file and no environment variable set');
    });
  });
});
