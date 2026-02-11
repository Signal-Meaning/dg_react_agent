# New Features - v0.8.0

## Official voice-agent-backend package (Issues #423, #425)

This release adds a **second publishable package**: `@signal-meaning/voice-agent-backend`. It is the first time this package is published to GitHub Package Registry.

### What it provides

- **Mountable backend:** Express routes for Deepgram proxy, OpenAI proxy, and function-call so apps (e.g. test-app, voice-commerce) can use a thin wrapper (config, auth, logging).
- **Programmatic API:** `createServer()`, `mountVoiceAgentBackend()`, `createFunctionCallHandler()`, `attachVoiceAgentUpgrade()`.
- **CLI:** `voice-agent-backend serve` (or via `npx @signal-meaning/voice-agent-backend`).

### Installation

See [packages/voice-agent-backend/README.md](../../../packages/voice-agent-backend/README.md) for GitHub Packages registry config and:

```bash
npm install @signal-meaning/voice-agent-backend@0.1.0
```

### Documentation

- [Issue #423 TDD-PLAN](../../issues/ISSUE-423/TDD-PLAN.md)
- [Issue #425 CI/CD workflow](../../issues/ISSUE-425/CICD-WORKFLOW-423.md)
- [RELEASE-NOTES.md](RELEASE-NOTES.md)

## React component

No new component features in this release. The component API is unchanged; the minor version reflects the expanded repo offering (two packages).
