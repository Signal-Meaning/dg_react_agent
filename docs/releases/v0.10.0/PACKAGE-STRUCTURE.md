# Package Structure: @signal-meaning/voice-agent-react@v0.10.0

Earlier releases were originally published under the package name `@signal-meaning/deepgram-voice-interaction-react`; the package has been renamed to `@signal-meaning/voice-agent-react`.

## Files Included in Package

As defined in `package.json` "files" field:

```
signal-meaning-voice-agent-react-v0.10.0/
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
│   │   └── v0.10.0/
│   │       ├── CHANGELOG.md
│   │       ├── MIGRATION.md
│   │       ├── API-REFERENCE.md
│   │       ├── RELEASE-NOTES.md
│   │       ├── INTEGRATION-GUIDE.md
│   │       ├── AUDIO-BUFFER-MANAGEMENT.md
│   │       └── PACKAGE-STRUCTURE.md
│   ├── development/          # Development guides
│   ├── issues/               # Issue documentation
│   └── migration/            # Migration guides
├── scripts/                   # Utility scripts
│   ├── create-release-issue.sh
│   ├── check-token-issues.js
│   ├── validate-plugin.js
│   ├── generate-test-audio.js
│   └── [other scripts...]
└── test-app/                 # Test application demonstrating component usage
    ├── src/                  # Test app source code
    │   ├── App.tsx           # Main test app component
    │   ├── session-management.ts
    │   └── [other files...]
    ├── tests/                # E2E tests
    │   ├── e2e/              # Playwright E2E tests
    │   ├── unit/             # Unit tests
    │   └── integration/      # Integration tests
    ├── docs/                 # Test app documentation
    └── [other files...]
```

## Package Entry Points

From `package.json`:
- **Main (CommonJS)**: `dist/index.js`
- **Module (ESM)**: `dist/index.esm.js`
- **Types**: `dist/index.d.ts`

## Purpose of Each Directory

- **`dist/`**: Built production code and TypeScript definitions
- **`README.md`**: Package overview and quick start
- **`DEVELOPMENT.md`**: Development setup and contribution guide
- **`docs/`**: Comprehensive documentation (releases, guides, issues)
- **`scripts/`**: Utility scripts for development and publishing
- **`test-app/`**: Reference implementation and E2E test suite

## Package Size Information

<!-- Update with actual sizes when available -->
- **Total Package Size**: [TBD]
- **dist/**: [TBD]
- **docs/**: [TBD]
- **test-app/**: [TBD]

## Installation

```bash
npm install @signal-meaning/voice-agent-react@v0.10.0
```

## Verification

After installation, verify the package structure:

```bash
# Check installed files
ls node_modules/@signal-meaning/voice-agent-react/

# Verify entry points exist
ls node_modules/@signal-meaning/voice-agent-react/dist/
```
