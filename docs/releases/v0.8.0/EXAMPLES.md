# Examples - v0.8.0

## Using the React component (unchanged)

Usage of `@signal-meaning/deepgram-voice-interaction-react` is unchanged from v0.7.x. See existing docs and [test-app](../../../test-app/) for examples.

## Using the voice-agent-backend package (new)

### Install

```bash
npm config set @signal-meaning:registry https://npm.pkg.github.com
# Configure auth (see packages/voice-agent-backend/README.md)
npm install @signal-meaning/voice-agent-backend
```

### Thin wrapper (Express)

```js
const express = require('express');
const { mountVoiceAgentBackend } = require('@signal-meaning/voice-agent-backend');

const app = express();
app.use(express.json());

// Your auth, logging, config middleware here

mountVoiceAgentBackend(app, {
  deepgramProxy: { enabled: true },
  openaiProxy: { enabled: true },
  functionCall: {
    path: '/api/function-call',
    execute: async (name, args) => ({ content: 'OK' }),
  },
});

app.listen(3000);
```

### CLI

```bash
npx @signal-meaning/voice-agent-backend serve
# Uses PORT (default 3000). Same routes as programmatic API.
```

### Full documentation

- [packages/voice-agent-backend/README.md](../../../packages/voice-agent-backend/README.md) — API, options, WebSocket attach
- [test-app/scripts/backend-server.js](../../../test-app/scripts/backend-server.js) — reference thin wrapper
