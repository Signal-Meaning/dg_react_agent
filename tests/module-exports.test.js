/**
 * Module Export Validation Tests
 * 
 * These tests validate that the built package exports the correct components and types
 * and that the TypeScript definitions match the actual implementation.
 */

const path = require('path');
const fs = require('fs');

describe('Module Export Validation', () => {
  const distPath = path.join(__dirname, '../dist');
  const packageJsonPath = path.join(__dirname, '../package.json');
  
  beforeAll(() => {
    // Ensure the package is built
    if (!fs.existsSync(distPath)) {
      throw new Error('Dist folder not found. Please run "npm run build" first.');
    }
  });

  describe('Package Structure', () => {
    test('should have required dist files', () => {
      expect(fs.existsSync(path.join(distPath, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'index.esm.js'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'index.d.ts'))).toBe(true);
    });

    test('should have TypeScript definition files', () => {
      expect(fs.existsSync(path.join(distPath, 'types/index.d.ts'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'types/agent.d.ts'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'types/connection.d.ts'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'types/transcription.d.ts'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'types/voiceBot.d.ts'))).toBe(true);
    });
  });

  describe('CommonJS Module Exports', () => {
    test('should have valid module structure', () => {
      const cjsPath = path.join(distPath, 'index.js');
      const cjsContent = fs.readFileSync(cjsPath, 'utf8');
      
      // Check that the module exports the main component
      expect(cjsContent).toContain('DeepgramVoiceInteraction');
      
      // Check that it's a valid CommonJS module (minified files use exports.DeepgramVoiceInteraction)
      expect(cjsContent).toMatch(/exports\.DeepgramVoiceInteraction|module\.exports/);
    });
  });

  describe('ES Module Exports', () => {
    test('should have valid ES module structure', async () => {
      const esmPath = path.join(distPath, 'index.esm.js');
      const esmContent = fs.readFileSync(esmPath, 'utf8');
      
      // Check that the main component is exported
      expect(esmContent).toContain('DeepgramVoiceInteraction');
      
      // Check that it's a valid ES module (minified files use export{...} or exports.DeepgramVoiceInteraction)
      expect(esmContent).toMatch(/export\s*\{|exports\.DeepgramVoiceInteraction/);
    });
  });

  describe('TypeScript Definitions', () => {
    let typesContent;
    
    beforeAll(() => {
      typesContent = fs.readFileSync(path.join(distPath, 'types/index.d.ts'), 'utf8');
    });

    test('should include DeepgramVoiceInteractionHandle interface', () => {
      expect(typesContent).toContain('interface DeepgramVoiceInteractionHandle');
    });

    test('should include all required methods in DeepgramVoiceInteractionHandle', () => {
      const requiredMethods = [
        'start: () => Promise<void>',
        'stop: () => Promise<void>',
        'connectTextOnly: () => Promise<void>',
        'injectUserMessage: (message: string) => void',
        'injectAgentMessage: (message: string) => void',
        'updateAgentInstructions: (payload: UpdateInstructionsPayload) => void',
        'interruptAgent: () => void',
        'sleep: () => void',
        'wake: () => void',
        'toggleSleep: () => void'
      ];

      requiredMethods.forEach(method => {
        expect(typesContent).toContain(method);
      });
    });

    test('should include DeepgramVoiceInteractionProps interface', () => {
      expect(typesContent).toContain('interface DeepgramVoiceInteractionProps');
    });

    test('should include all required props in DeepgramVoiceInteractionProps', () => {
      const requiredProps = [
        'apiKey: string',
        'transcriptionOptions?: TranscriptionOptions',
        'agentOptions?: AgentOptions',
        'endpointConfig?: EndpointConfig',
        'onReady?: (isReady: boolean) => void',
        'onConnectionStateChange?: (service: ServiceType, state: ConnectionState) => void',
        'onTranscriptUpdate?: (transcriptData: TranscriptResponse) => void',
        'onAgentStateChange?: (state: AgentState) => void',
        'onAgentUtterance?: (utterance: LLMResponse) => void',
        'onUserMessage?: (message: UserMessageResponse) => void',
        'onPlaybackStateChange?: (isPlaying: boolean) => void',
        'onUserStartedSpeaking?: () => void',
        'onUserStoppedSpeaking?: () => void',
        'onError?: (error: DeepgramError) => void',
        'debug?: boolean'
      ];

      requiredProps.forEach(prop => {
        expect(typesContent).toContain(prop);
      });
    });

    test('should include all type exports', () => {
      const expectedTypeExports = [
        'export * from \'./agent\'',
        'export * from \'./connection\'',
        'export * from \'./transcription\'',
        'export * from \'./voiceBot\''
      ];

      expectedTypeExports.forEach(exportStatement => {
        expect(typesContent).toContain(exportStatement);
      });
    });
  });

  describe('Package.json Configuration', () => {
    let packageJson;
    
    beforeAll(() => {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    });

    test('should have correct main entry point', () => {
      expect(packageJson.main).toBe('dist/index.js');
    });

    test('should have correct module entry point', () => {
      expect(packageJson.module).toBe('dist/index.esm.js');
    });

    test('should have correct types entry point', () => {
      expect(packageJson.types).toBe('dist/index.d.ts');
    });

    test('should include dist folder in files array', () => {
      expect(packageJson.files).toContain('dist');
    });
  });

  describe('Runtime Validation', () => {
    test('should have valid module structure for runtime', () => {
      const cjsPath = path.join(distPath, 'index.js');
      const cjsContent = fs.readFileSync(cjsPath, 'utf8');
      
      // Check that the module has the expected structure
      expect(cjsContent).toContain('DeepgramVoiceInteraction');
      expect(cjsContent).toMatch(/exports\.DeepgramVoiceInteraction|module\.exports/);
      
      // Check that it's a valid JavaScript file
      expect(() => {
        // Just check that it's valid JavaScript syntax
        new Function(cjsContent);
      }).not.toThrow();
    });
  });
});
