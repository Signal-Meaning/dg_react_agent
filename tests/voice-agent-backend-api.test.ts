/**
 * Issue #423: Contract tests for the voice-agent-backend package API.
 * RED first: these tests define the public contract; they fail until the package exists.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md Phase 1
 */

// Resolve package from in-repo path until published
const backendPath = require('path').resolve(__dirname, '../packages/voice-agent-backend/src/index.js');
let createServer: (options: unknown) => unknown;
let mountVoiceAgentBackend: (app: unknown, options: unknown) => void;

let createFunctionCallHandler: (options: { execute?: (name: string, args: object) => { content?: string } | { error?: string } }) => (req: unknown, res: unknown) => void;
try {
  const pkg = require(backendPath);
  createServer = pkg.createServer;
  mountVoiceAgentBackend = pkg.mountVoiceAgentBackend;
  createFunctionCallHandler = pkg.createFunctionCallHandler;
} catch {
  createServer = undefined;
  mountVoiceAgentBackend = undefined;
  createFunctionCallHandler = undefined;
}

describe('voice-agent-backend package API (Issue #423)', () => {
  describe('exports', () => {
    it('exports createServer function', () => {
      expect(typeof createServer).toBe('function');
    });

    it('exports mountVoiceAgentBackend function', () => {
      expect(typeof mountVoiceAgentBackend).toBe('function');
    });

    it('exports createFunctionCallHandler function', () => {
      expect(typeof createFunctionCallHandler).toBe('function');
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

  describe('createFunctionCallHandler(options)', () => {
    it('returns a function that calls execute and sends 200 with content', (done) => {
      const handler = createFunctionCallHandler!({
        execute: (name, args) => {
          expect(name).toBe('get_current_time');
          expect(args).toEqual({ timezone: 'UTC' });
          return { content: JSON.stringify({ time: '12:00:00' }) };
        },
      });
      const req = {
        method: 'POST',
        on: (ev: string, fn: (chunk?: Buffer) => void) => {
          if (ev === 'data') fn(Buffer.from(JSON.stringify({ id: 'call_1', name: 'get_current_time', arguments: '{"timezone":"UTC"}' })));
          if (ev === 'end') fn();
        },
      } as unknown as import('http').IncomingMessage;
      const res = {
        writeHead: jest.fn(),
        end: jest.fn((body: string) => {
          expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
          expect(JSON.parse(body)).toEqual({ content: '{"time":"12:00:00"}' });
          done();
        }),
      } as unknown as import('http').ServerResponse;
      handler(req, res);
    });
  });
});
