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

// OpenAI proxy: run from this package (Issue #445). Resolve package dir so backends never depend on the React package.
const backendPkgDir = require('path').dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'));
await attachVoiceAgentUpgrade(server, {
  deepgram: { path: '/deepgram-proxy', apiKey: process.env.DEEPGRAM_API_KEY, verifyClient, setSecurityHeaders },
  openai: { path: '/openai', spawn: { cwd: backendPkgDir, command: 'npx', args: ['tsx', 'scripts/openai-proxy/run.ts'], env: { OPENAI_API_KEY }, port: 8081 } },
  logger: myLogger,
  https: false,
});
server.listen(8080);
```

**Running the OpenAI proxy:** The proxy lives in this package at `scripts/openai-proxy/`. Set `cwd` to the backend package directory (e.g. `path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'))`) and run `npx tsx scripts/openai-proxy/run.ts`. Requires `OPENAI_API_KEY` in the environment or a `.env` file. See `scripts/openai-proxy/README.md` in this package for details. For integrators (e.g. voice-commerce): do not resolve or depend on the React package to run the proxy; see **docs/OPENAI-PROXY-PACKAGING.md** in the repo.

**OpenAI proxy TLS (EPIC-546):** The subprocess does **not** enable TLS from generic `HTTPS=true` alone (avoids accidental inheritance from the host). Supported modes:

| Mode | Environment |
|------|-------------|
| HTTP / WS | Default — no TLS-related vars. |
| HTTPS with PEM | `OPENAI_PROXY_TLS_KEY_PATH` and `OPENAI_PROXY_TLS_CERT_PATH` (e.g. mkcert files). |
| HTTPS with in-memory dev cert | `OPENAI_PROXY_INSECURE_DEV_TLS=1` — **not** allowed when `NODE_ENV=production`. |

When using `attachVoiceAgentUpgrade` with **`https: true`**, the package strips `HTTPS` from the subprocess environment and sets `OPENAI_PROXY_INSECURE_DEV_TLS=1` unless PEM paths are already provided, so the child matches the parent’s wss expectation without relying on host `HTTPS`.

Options: **deepgram** — path, apiKey, agentUrl?, transcriptionUrl?, verifyClient?(info), setSecurityHeaders?(res). **openai** — path, proxyUrl? (forward to URL), or spawn? (cwd, command, args, env, port), **openai.upstreamOptions?** — merged with package defaults (e.g. `rejectUnauthorized: false` when HTTPS); use for WebSocket client options such as `headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }` for the OpenAI Realtime API (Issue #441). **logger** — { info, warn, error, debug }. Returns a Promise that resolves to `{ shutdown() }` for graceful close.

**Deepgram proxy – AgentAudioDone (idle timeout):** The component starts its idle timeout only when the agent is idle. For turns that include **audio**, the proxy should send `AgentAudioDone` after the assistant’s `ConversationText` so the component can transition to idle. For **text-only** greeting or turns (no binary forwarded), the component handles the transition internally; the proxy must **not** send `AgentAudioDone` before any audio in that connection, or the idle timer can start and then be cancelled when audio arrives. This package’s Deepgram proxy (`src/attach-upgrade.js`) sends `AgentAudioDone` after the first assistant `ConversationText` only when it has already forwarded at least one binary message. See docs [Component–Proxy Contract](https://github.com/Signal-Meaning/dg_react_agent/blob/main/docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md#idle-timeout-and-agent-completion-agentaudiodone--text-only-path) and [E2E-FAILURES-RESOLUTION](https://github.com/Signal-Meaning/dg_react_agent/blob/main/docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md).

## Status

- **Function-call:** Implemented. Use `functionCall.execute` or `createFunctionCallHandler({ execute })` (Issue #407 contract).
- **Deepgram / OpenAI proxy:** Implemented via `attachVoiceAgentUpgrade(server, options)`. Test-app backend uses the package for all routes (thin wrapper).
