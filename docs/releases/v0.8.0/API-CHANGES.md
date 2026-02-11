# API Changes - v0.8.0

## React component (@signal-meaning/deepgram-voice-interaction-react)

**No API changes.** This release does not modify the component's props, callbacks, ref API, or TypeScript types. The bump to 0.8.0 reflects the addition of a second publishable package (voice-agent-backend), not component API changes.

## New package: @signal-meaning/voice-agent-backend

This release **publishes** the backend package for the first time. Its API is documented in the package:

- **Programmatic:** `createServer(options)`, `mountVoiceAgentBackend(app, options)`, `createFunctionCallHandler(options)`, `attachVoiceAgentUpgrade(server, options)`
- **CLI:** `voice-agent-backend serve`

See [packages/voice-agent-backend/README.md](../../../packages/voice-agent-backend/README.md) for full API and options.
