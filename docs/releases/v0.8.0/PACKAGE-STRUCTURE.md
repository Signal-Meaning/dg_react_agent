# Package Structure: @signal-meaning/deepgram-voice-interaction-react@v0.8.0

## Files Included in Package

As defined in `package.json` "files" field:

```
signal-meaning-deepgram-voice-interaction-react-v0.8.0/
├── dist/                      # Built component and utilities
│   ├── index.js               # CommonJS entry point
│   ├── index.esm.js           # ES Module entry point
│   ├── index.d.ts             # TypeScript definitions
│   ├── components/
│   │   └── DeepgramVoiceInteraction/
│   │       └── index.d.ts
│   ├── constants/
│   │   ├── documentation.d.ts
│   │   └── vad-events.d.ts
│   ├── hooks/
│   │   └── useIdleTimeoutManager.d.ts
│   ├── services/
│   │   └── AgentStateService.d.ts
│   ├── test-utils/
│   │   ├── test-helpers.d.ts
│   │   └── timeout-testing.d.ts
│   ├── test-utils.d.ts
│   ├── types/
│   │   ├── agent.d.ts
│   │   ├── connection.d.ts
│   │   ├── index.d.ts
│   │   ├── transcription.d.ts
│   │   └── voiceBot.d.ts
│   └── utils/
│       ├── api-key-validator.d.ts
│       ├── audio/
│       │   ├── AudioManager.d.ts
│       │   └── AudioUtils.d.ts
│       ├── conversation-context.d.ts
│       ├── IdleTimeoutService.d.ts
│       ├── instructions-loader.d.ts
│       ├── plugin-validator.d.ts
│       ├── state/
│       │   └── VoiceInteractionState.d.ts
│       └── websocket/
│           └── WebSocketManager.d.ts
├── src/                       # Source (TypeScript)
├── tests/                     # Jest unit and integration tests
├── README.md                  # Package documentation
├── DEVELOPMENT.md             # Development guide
├── docs/                      # Documentation
│   ├── releases/
│   │   └── v0.8.0/
│   │       ├── CHANGELOG.md
│   │       ├── RELEASE-NOTES.md
│   │       └── PACKAGE-STRUCTURE.md
│   ├── development/
│   ├── issues/
│   └── migration/
├── scripts/
└── test-app/                  # Test application and E2E tests
```

## Package Entry Points

From `package.json`:
- **Main (CommonJS)**: `dist/index.js`
- **Module (ESM)**: `dist/index.esm.js`
- **Types**: `dist/index.d.ts`

## Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@v0.8.0
```

## Verification

After installation, verify the package structure:

```bash
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/dist/
```

## Second package in this release

This release also publishes **@signal-meaning/voice-agent-backend@0.1.0**. See `packages/voice-agent-backend/README.md` in the repo and the [Install section](../../../packages/voice-agent-backend/README.md#install) for registry and installation.
