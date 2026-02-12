/**
 * @signal-meaning/voice-agent-backend
 * Issue #423: Programmatic API for mounting Deepgram proxy, OpenAI proxy, and function-call routes.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md
 * Contract: docs/issues/ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md
 */

if (process.env.LOG_LEVEL) {
  console.log('[voice-agent-backend] LOG_LEVEL:', process.env.LOG_LEVEL);
}

const express = require('express');

/**
 * Create an Express app with voice-agent backend routes mounted.
 * @param {object} options - { deepgramProxy?, openaiProxy?, functionCall? }
 * @returns {import('express').Application}
 */
function createServer(options = {}) {
  const app = express();
  mountVoiceAgentBackend(app, options);
  return app;
}

/**
 * Mount voice-agent backend routes on an existing Express app.
 * @param {import('express').Application} app - Express application
 * @param {object} options - { deepgramProxy?, openaiProxy?, functionCall? }
 * @param {object} [options.functionCall] - { path?, execute?(name, args) => { content? } | { error? } }
 */
function mountVoiceAgentBackend(app, options = {}) {
  const opts = options || {};
  if (opts.deepgramProxy?.enabled !== false) {
    app.use('/api/deepgram/proxy', _placeholderRouter('deepgram'));
  }
  if (opts.openaiProxy?.enabled !== false) {
    app.use('/api/openai/proxy', _placeholderRouter('openai'));
  }
  const fcPath = opts.functionCall?.path ?? '/api/function-call';
  const execute = opts.functionCall?.execute;
  if (typeof execute === 'function') {
    app.use(express.json());
    app.post(fcPath, _functionCallRoute(execute));
    app.use(fcPath, _catchAllPlaceholder('function-call'));
  } else {
    app.use(fcPath, _placeholderRouter('function-call'));
  }
}

/**
 * Returns a handler for raw Node HTTP (req, res) for POST /function-call.
 * Use when not using Express (e.g. test-app backend-server).
 * @param {{ execute: (name: string, args: object) => { content?: string } | { error?: string } }} options
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => void}
 */
function createFunctionCallHandler(options = {}) {
  const execute = options.execute;
  if (typeof execute !== 'function') {
    return (req, res) => {
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not implemented', route: 'function-call' }));
    };
  }
  return function functionCallHandler(req, res) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const id = payload.id;
        const name = payload.name;
        const argsStr = payload.arguments;
        if (typeof id !== 'string' || typeof name !== 'string' || typeof argsStr !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid id, name, or arguments' }));
          return;
        }
        let args = {};
        try {
          args = JSON.parse(argsStr || '{}');
        } catch {
          // leave args as {}
        }
        const result = execute(name, args);
        if (result && typeof result.error === 'string') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        if (result && typeof result.content === 'string') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content: result.content }));
          return;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Handler did not return content or error' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }));
      }
    });
  };
}

function _functionCallRoute(execute) {
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    const payload = req.body || {};
    const id = payload.id;
    const name = payload.name;
    const argsStr = payload.arguments;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof argsStr !== 'string') {
      res.status(400).json({ error: 'Missing or invalid id, name, or arguments' });
      return;
    }
    let args = {};
    try {
      args = JSON.parse(argsStr || '{}');
    } catch {
      // leave args as {}
    }
    const result = execute(name, args);
    if (result && typeof result.error === 'string') {
      res.status(200).json({ error: result.error });
      return;
    }
    if (result && typeof result.content === 'string') {
      res.status(200).json({ content: result.content });
      return;
    }
    res.status(500).json({ error: 'Handler did not return content or error' });
  };
}

function _catchAllPlaceholder(name) {
  const router = express.Router();
  router.all('*', (_req, res) => {
    res.status(501).json({ error: 'Not implemented', route: name });
  });
  return router;
}

function _placeholderRouter(name) {
  const router = express.Router();
  router.all('*', (_req, res) => {
    res.status(501).json({ error: 'Not implemented', route: name });
  });
  return router;
}

const { attachVoiceAgentUpgrade } = require('./attach-upgrade.js');

module.exports = {
  createServer,
  mountVoiceAgentBackend,
  createFunctionCallHandler,
  attachVoiceAgentUpgrade,
};
