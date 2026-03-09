# Usage Examples - v0.10.0

v0.10.0 does not introduce new component APIs. Existing examples from the main docs and previous releases (proxy mode, function calling, agent context, idle timeout) continue to apply.

## Quick reference

- **Basic usage:** See [README](https://github.com/Signal-Meaning/dg_react_agent#readme) and [API-REFERENCE.md](../../API-REFERENCE.md).
- **Proxy mode / backend:** See [BACKEND-PROXY](../../BACKEND-PROXY/) and test-app usage; Epic #493 improves proxy event mapping.
- **Function calling:** See [BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md) and test-app backend mount.
- **E2E and real-API tests:** See [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md); run E2E from test-app with `USE_PROXY_MODE=true npm run test:e2e`.

## Installing this release

```bash
npm install @signal-meaning/voice-agent-react@0.10.0
```

If you use the backend package:

```bash
npm install @signal-meaning/voice-agent-backend@0.2.6
```

Configure the registry for `@signal-meaning` as documented in the main README and [voice-agent-backend README](https://github.com/Signal-Meaning/dg_react_agent/tree/main/packages/voice-agent-backend).

## References

- [NEW-FEATURES.md](./NEW-FEATURES.md) — v0.10.0 features (Epic #493, #490, #379, release process)
- [CHANGELOG.md](./CHANGELOG.md) — Full changelog for v0.10.0
