# @signal-meaning/voice-agent-backend

Backend and proxy package for Deepgram and OpenAI voice agent. Provides mountable routes for `/api/deepgram/proxy`, `/api/openai/proxy`, and function-call so consumers (e.g. test-app, voice-commerce) can use a thin wrapper (config, auth, logging).

**Issue:** [#423](https://github.com/Signal-Meaning/dg_react_agent/issues/423)

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

## Status

- **Function-call:** Implemented. Use `functionCall.execute` or `createFunctionCallHandler({ execute })` (Issue #407 contract).
- **Deepgram / OpenAI proxy:** Placeholder (501). To be wired from current backend-server and openai-proxy in a follow-up (see repo `docs/issues/ISSUE-423/TDD-PLAN.md`).
