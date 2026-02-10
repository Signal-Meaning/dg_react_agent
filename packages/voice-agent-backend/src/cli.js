#!/usr/bin/env node
/**
 * CLI for @signal-meaning/voice-agent-backend (Issue #423).
 * Usage: node cli.js serve [--port=PORT] or voice-agent-backend serve
 */

const { createServer } = require('./index.js');

const port = parseInt(process.env.PORT || '3000', 10);
const app = createServer({});
const server = app.listen(port, () => {
  if (process.send) process.send({ event: 'listening', port: server.address().port });
});

server.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
