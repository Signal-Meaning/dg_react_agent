/**
 * @signal-meaning/voice-agent-backend
 * Issue #423: Programmatic API for mounting Deepgram proxy, OpenAI proxy, and function-call routes.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md
 */

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
  app.use(fcPath, _placeholderRouter('function-call'));
}

function _placeholderRouter(name) {
  const router = express.Router();
  router.all('*', (_req, res) => {
    res.status(501).json({ error: 'Not implemented', route: name });
  });
  return router;
}

module.exports = {
  createServer,
  mountVoiceAgentBackend,
};
