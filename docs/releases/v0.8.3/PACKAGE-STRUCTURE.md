# Package Structure: @signal-meaning/voice-agent-react@v0.8.3

## Files Included in Package

As defined in `package.json` "files" field:

```
signal-meaning-voice-agent-react-v0.8.3/
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
├── README.md                  # Package documentation
├── DEVELOPMENT.md             # Development guide
├── docs/                      # Documentation
│   ├── releases/             # Release notes and migration guides
│   │   └── v0.8.3/
│   │       ├── CHANGELOG.md
│   │       ├── RELEASE-NOTES.md
│   │       └── PACKAGE-STRUCTURE.md
│   ├── development/          # Development guides
│   ├── issues/               # Issue documentation
│   └── migration/            # Migration guides
├── scripts/                   # Utility scripts
└── test-app/                 # Test application demonstrating component usage
```

## Package Entry Points

From `package.json`:
- **Main (CommonJS)**: `dist/index.js`
- **Module (ESM)**: `dist/index.esm.js`
- **Types**: `dist/index.d.ts`

## Installation

```bash
npm install @signal-meaning/voice-agent-react@v0.8.3
```

## Verification

After installation, verify the package structure:

```bash
ls node_modules/@signal-meaning/voice-agent-react/
ls node_modules/@signal-meaning/voice-agent-react/dist/
```
