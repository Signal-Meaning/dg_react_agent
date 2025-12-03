# Package Structure - v0.6.16

This document describes the structure and contents of the `@signal-meaning/deepgram-voice-interaction-react` package version 0.6.16.

## Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.6.16
```

## Package Contents

```
@signal-meaning/deepgram-voice-interaction-react@0.6.16/
├── dist/
│   ├── index.js              # CommonJS build (main entry point)
│   ├── index.esm.js          # ES Module build
│   ├── index.d.ts            # TypeScript type definitions
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
│   ├── types/
│   │   ├── agent.d.ts
│   │   ├── connection.d.ts
│   │   ├── index.d.ts
│   │   ├── transcription.d.ts
│   │   └── voiceBot.d.ts
│   └── utils/
│       ├── api-key-validator.d.ts
│       ├── audio/
│       ├── conversation-context.d.ts
│       ├── deep-equal.d.ts
│       ├── function-utils.d.ts
│       ├── IdleTimeoutService.d.ts
│       ├── instructions-loader.d.ts
│       ├── option-comparison.d.ts
│       ├── plugin-validator.d.ts
│       └── websocket/
├── README.md
├── DEVELOPMENT.md
└── docs/                      # Documentation directory
```

## Entry Points

### CommonJS (Node.js / bundlers)
```javascript
const { DeepgramVoiceInteraction } = require('@signal-meaning/deepgram-voice-interaction-react');
```

### ES Modules
```javascript
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';
```

## TypeScript Support

Full TypeScript support is included. Type definitions are in the `dist/` directory.

## Peer Dependencies

- `react`: >=16.8.0 <19.0.0
- `react-dom`: >=16.8.0 <19.0.0

## Version Information

- **Package Version**: 0.6.16
- **Release Date**: 2025-12-03
- **Node.js**: Compatible with Node.js 14+
- **React**: Compatible with React 16.8+ (hooks support required)

## What's New in v0.6.16

### Fixes
- **Issue #318**: Fixed `useEffect` not running when `agentOptions` changes in minified builds
  - Changed dependency array to use direct prop access for reliable dependency tracking
  - Ensures Settings are re-sent correctly when `agentOptions` changes

### Changes
- Updated release script to create proper release branch format
- Fixed lint warning in `TranscriptionOptions.metadata` type

## Documentation

See the main [README.md](../../README.md) for usage instructions and API documentation.

