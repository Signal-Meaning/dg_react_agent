# Usage Examples - v0.11.0

v0.11.0 does **not** add new declarative props on the headless component. Use the same integration patterns as v0.10.x; upgrade **voice-agent-backend** to **0.2.12** when you use the OpenAI proxy from this release.

## Quick reference

- **Basic usage:** [README](https://github.com/Signal-Meaning/dg_react_agent#readme) and [API-REFERENCE.md](../../API-REFERENCE.md).
- **Microphone:** Prefer explicit `startAudioCapture()` / `stopAudioCapture()` via ref per project conventions; see test-app for ordering with Settings and proxy mode.
- **OpenAI proxy / backend:** [BACKEND-PROXY](../../BACKEND-PROXY/) and `packages/voice-agent-backend/README.md`.
- **Live-style UI:** Inspect `test-app` Live mode (Issue #561) as a reference layout, not a published UI package.

## Installing this release

```bash
npm install @signal-meaning/voice-agent-react@0.11.0
```

With the backend package:

```bash
npm install @signal-meaning/voice-agent-backend@0.2.12
```

Configure the GitHub Package Registry for `@signal-meaning` as in the root README and backend README.

## Qualification commands (integrators)

From repo root (development clone):

```bash
npm run lint
npm run test:mock
```

Proxy E2E (requires backend running separately per project docs):

```bash
cd test-app && npm run backend
# from repo root
USE_PROXY_MODE=true npm run test:e2e
```

When `OPENAI_API_KEY` is available:

```bash
USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts
```

## References

- [NEW-FEATURES.md](./NEW-FEATURES.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [docs/development/TEST-STRATEGY.md](../../development/TEST-STRATEGY.md)
