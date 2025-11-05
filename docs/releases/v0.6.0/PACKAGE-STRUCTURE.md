# Package Structure: @signal-meaning/deepgram-voice-interaction-react@v0.6.0

## Files Included in Package

As defined in `package.json` "files" field:

```
signal-meaning-deepgram-voice-interaction-react-v0.6.0/
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
│       │   ├── AudioConstraintValidator.d.ts
│       │   ├── AudioManager.d.ts
│       │   ├── AudioUtils.d.ts
│       │   └── EchoCancellationDetector.d.ts
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
│   │   ├── v0.6.0/
│   │   │   ├── CHANGELOG.md
│   │   │   ├── API-CHANGES.md
│   │   │   ├── NEW-FEATURES.md
│   │   │   └── PACKAGE-STRUCTURE.md
│   │   └── [other versions...]
│   ├── development/          # Development guides
│   ├── issues/               # Issue documentation
│   │   └── ISSUE-243-ECHO-CANCELLATION-PLAN.md
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
    │   │   └── echo-cancellation.spec.js
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
  - **New in v0.6.0**: `AudioConstraintValidator.d.ts` and `EchoCancellationDetector.d.ts` for echo cancellation support
- **`README.md`**: Package overview and quick start
- **`DEVELOPMENT.md`**: Development setup and contribution guide
- **`docs/`**: Comprehensive documentation (releases, guides, issues)
  - **New in v0.6.0**: Echo cancellation documentation in `docs/issues/ISSUE-243-ECHO-CANCELLATION-PLAN.md`
- **`scripts/`**: Utility scripts for development and publishing
- **`test-app/`**: Reference implementation and E2E test suite
  - **New in v0.6.0**: Echo cancellation E2E tests in `test-app/tests/e2e/echo-cancellation.spec.js`

## New Files in v0.6.0

### Audio Utilities
- `dist/utils/audio/AudioConstraintValidator.d.ts` - Audio constraint validation
- `dist/utils/audio/EchoCancellationDetector.d.ts` - Echo cancellation detection

### Documentation
- `docs/releases/v0.6.0/CHANGELOG.md` - Complete changelog
- `docs/releases/v0.6.0/API-CHANGES.md` - API changes documentation
- `docs/releases/v0.6.0/NEW-FEATURES.md` - Echo cancellation feature documentation
- `docs/releases/v0.6.0/PACKAGE-STRUCTURE.md` - This file
- `docs/issues/ISSUE-243-ECHO-CANCELLATION-PLAN.md` - Echo cancellation implementation plan

### Tests
- `test-app/tests/e2e/echo-cancellation.spec.js` - Echo cancellation E2E tests

## Package Size Information

<!-- Update with actual sizes when available -->
- **Total Package Size**: [TBD]
- **dist/**: [TBD]
- **docs/**: [TBD]
- **test-app/**: [TBD]

## Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@v0.6.0
```

## Verification

After installation, verify the package structure:

```bash
# Check installed files
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/

# Verify entry points exist
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/dist/

# Verify new audio utilities exist
ls node_modules/@signal-meaning/deepgram-voice-interaction-react/dist/utils/audio/
```

## TypeScript Support

The package includes full TypeScript definitions:

```typescript
import { 
  DeepgramVoiceInteraction,
  AudioConstraints,
  DeepgramVoiceInteractionHandle 
} from '@signal-meaning/deepgram-voice-interaction-react';
```

All types are available in `dist/index.d.ts` and can be imported directly.

