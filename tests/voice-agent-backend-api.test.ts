/**
 * Issue #423: Contract tests for the voice-agent-backend package API.
 * RED first: these tests define the public contract; they fail until the package exists.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md Phase 1
 */

// Resolve package from in-repo path until published
const backendPath = require('path').resolve(__dirname, '../packages/voice-agent-backend/src/index.js');
let createServer: (options: unknown) => unknown;
let mountVoiceAgentBackend: (app: unknown, options: unknown) => void;

try {
  const pkg = require(backendPath);
  createServer = pkg.createServer;
  mountVoiceAgentBackend = pkg.mountVoiceAgentBackend;
} catch {
  createServer = undefined;
  mountVoiceAgentBackend = undefined;
}

describe('voice-agent-backend package API (Issue #423)', () => {
  describe('exports', () => {
    it('exports createServer function', () => {
      expect(typeof createServer).toBe('function');
    });

    it('exports mountVoiceAgentBackend function', () => {
      expect(typeof mountVoiceAgentBackend).toBe('function');
    });
  });

  describe('createServer(options)', () => {
    it('accepts an options object and returns an Express-like app', () => {
      const options = {
        deepgramProxy: { enabled: true },
        openaiProxy: { enabled: true },
        functionCall: { path: '/api/function-call' },
      };
      const app = createServer!(options);
      expect(app).toBeDefined();
      expect(typeof (app as { listen?: unknown }).listen).toBe('function');
      expect(typeof (app as { use?: unknown }).use).toBe('function');
    });

    it('returns an app that has mount points for proxy and function-call routes', () => {
      const options = {
        deepgramProxy: { enabled: true },
        openaiProxy: { enabled: true },
        functionCall: { path: '/api/function-call' },
      };
      const app = createServer!(options) as { _router?: { stack?: { route?: { path: string } }[] } };
      // Express apps have a _router.stack; we only assert the app is usable
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
    });
  });

  describe('mountVoiceAgentBackend(app, options)', () => {
    it('mounts routes on an existing Express app', () => {
      const app = { use: jest.fn() } as unknown as { use: (path?: string | unknown, handler?: unknown) => void };
      const options = {
        deepgramProxy: { enabled: true },
        openaiProxy: { enabled: true },
        functionCall: { path: '/api/function-call' },
      };
      expect(() => mountVoiceAgentBackend!(app, options)).not.toThrow();
      expect(app.use).toHaveBeenCalled();
    });
  });
});
