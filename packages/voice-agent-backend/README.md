# @signal-meaning/voice-agent-backend

Backend and proxy package for Deepgram and OpenAI voice agent. Provides mountable routes for `/api/deepgram/proxy`, `/api/openai/proxy`, and function-call so consumers (e.g. test-app, voice-commerce) can use a thin wrapper (config, auth, logging).

**Issue:** [#423](https://github.com/Signal-Meaning/dg_react_agent/issues/423)

## Install

The package is published to **GitHub Package Registry**. Configure npm to use it for the `@signal-meaning` scope, then install:

```bash
# One-time: tell npm to use GitHub Packages for @signal-meaning
npm config set @signal-meaning:registry https://npm.pkg.github.com

# Authenticate (requires a GitHub token with read:packages)
# Option A: .npmrc in project or home
# //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
# Option B: env
# export NPM_CONFIG_//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN

npm install @signal-meaning/voice-agent-backend
```

Or with a specific version: `npm install @signal-meaning/voice-agent-backend@0.1.0`

## Programmatic API

```js
const { createServer, mountVoiceAgentBackend } = require('@signal-meaning/voice-agent-backend');
```

### createServer(options)

Returns an Express application with voice-agent routes mounted.

- **options.deepgramProxy** — `{ enabled?: boolean }` (default: enabled)
- **options.openaiProxy** — `{ enabled?: boolean }` (default: enabled)
- **options.functionCall** — `{ path?: string, execute?: (name, args) => { content?: string } | { error?: string } }` (default path: `/api/function-call`). When `execute` is provided, POST to the path is handled (Issue #407 contract); otherwise returns 501.

### createFunctionCallHandler(options)

For raw Node HTTP servers (no Express). Returns a `(req, res)` handler that implements POST /function-call (Issue #407 contract). Use when your backend is not Express (e.g. test-app backend-server).

- **options.execute** — `(name, args) => { content?: string } | { error?: string }` (required for real behavior).

### mountVoiceAgentBackend(app, options)

Mounts the same routes on an existing Express app. Use this for a **thin wrapper**: create your app, add config/auth/logging middleware, then call `mountVoiceAgentBackend(app, options)`. The test-app and voice-commerce are intended to use this pattern so they only provide config, auth, and logging.

## CLI

From the package directory or via `npx @signal-meaning/voice-agent-backend` (when published):

```bash
voice-agent-backend serve   # or: node src/cli.js serve
```

Uses `PORT` (default `3000`). Same routes as the programmatic API.

## WebSocket proxies (Deepgram, OpenAI)

Attach to an existing HTTP(S) server (raw Node, not Express):

```js
const http = require('http');
const { createFunctionCallHandler, attachVoiceAgentUpgrade } = require('@signal-meaning/voice-agent-backend');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/function-call')) {
    return functionCallHandler(req, res);
  }
  res.writeHead(404).end();
});

await attachVoiceAgentUpgrade(server, {
  deepgram: { path: '/deepgram-proxy', apiKey: process.env.DEEPGRAM_API_KEY, verifyClient, setSecurityHeaders },
  openai: { path: '/openai', spawn: { cwd: repoRoot, command: 'npx', args: ['tsx', 'scripts/openai-proxy/run.ts'], env: { OPENAI_API_KEY }, port: 8081 } },
  logger: myLogger,
  https: false,
});
server.listen(8080);
```

Options: **deepgram** — path, apiKey, agentUrl?, transcriptionUrl?, verifyClient?(info), setSecurityHeaders?(res). **openai** — path, proxyUrl? (forward to URL), or spawn? (cwd, command, args, env, port), **openai.upstreamOptions?** — merged with package defaults (e.g. `rejectUnauthorized: false` when HTTPS); use for WebSocket client options such as `headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }` for the OpenAI Realtime API (Issue #441). **logger** — { info, warn, error, debug }. Returns a Promise that resolves to `{ shutdown() }` for graceful close.

## Status

- **Function-call:** Implemented. Use `functionCall.execute` or `createFunctionCallHandler({ execute })` (Issue #407 contract).
- **Deepgram / OpenAI proxy:** Implemented via `attachVoiceAgentUpgrade(server, options)`. Test-app backend uses the package for all routes (thin wrapper).
