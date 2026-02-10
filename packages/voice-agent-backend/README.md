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
- **options.functionCall** — `{ path?: string }` (default: `/api/function-call`)

### mountVoiceAgentBackend(app, options)

Mounts the same routes on an existing Express app. Use this for a thin wrapper: create your app, add auth/logging middleware, then call `mountVoiceAgentBackend(app, options)`.

## Status

Initial API and placeholder routes only. Real proxy and function-call behavior will be wired in later phases (see repo `docs/issues/ISSUE-423/TDD-PLAN.md`).
