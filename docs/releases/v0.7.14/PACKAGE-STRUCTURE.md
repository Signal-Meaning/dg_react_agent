# Package Structure: @signal-meaning/deepgram-voice-interaction-react@v0.7.14

## Files Included in Package

As defined in `package.json` "files" field:

```
signal-meaning-deepgram-voice-interaction-react-v0.7.14/
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
├── src/                       # Component source (reference; use dist/ at runtime)
│   ├── index.ts
│   ├── components/
│   │   └── DeepgramVoiceInteraction/
│   ├── types/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   └── ...
├── README.md                  # Package documentation
├── DEVELOPMENT.md             # Development guide
├── docs/                      # Documentation
│   ├── SOURCE-REFERENCE.md    # Points to component and proxy source (v0.7.14+)
│   ├── releases/
│   │   └── v0.7.14/
│   │       ├── CHANGELOG.md
│   │       ├── RELEASE-NOTES.md
│   │       └── PACKAGE-STRUCTURE.md
│   ├── development/
│   ├── issues/
│   └── migration/
├── scripts/                   # Utility scripts and proxy source
│   ├── openai-proxy/          # OpenAI Realtime proxy (server, translator, run, logger)
│   ├── create-release-issue.sh
│   └── [other scripts...]
└── test-app/                  # Test application and mock proxy
    ├── src/
    ├── scripts/               # mock-proxy-server.js (Deepgram / OpenAI)
    ├── tests/
    └── docs/
```

## Package Entry Points

From `package.json`:
- **Main (CommonJS)**: `dist/index.js`
- **Module (ESM)**: `dist/index.esm.js`
- **Types**: `dist/index.d.ts`

## Purpose of Each Directory

- **`dist/`**: Built production code and TypeScript definitions (use at runtime).
- **`src/`**: Component source for reference (v0.7.14+); see `docs/SOURCE-REFERENCE.md`.
- **`README.md`**: Package overview and quick start.
- **`DEVELOPMENT.md`**: Development setup and contribution guide.
- **`docs/`**: Documentation (including SOURCE-REFERENCE.md, releases, guides, issues).
- **`scripts/`**: Proxy implementation (`openai-proxy/`) and utility scripts.
- **`test-app/`**: Reference app and E2E tests; mock proxy server.

## Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@v0.7.14
```

## Verification

After installation, verify the package structure:

```bash
# Check installed files (including src/)
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/

# Verify entry points
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/dist/

# Verify source reference doc
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/docs/SOURCE-REFERENCE.md
```
