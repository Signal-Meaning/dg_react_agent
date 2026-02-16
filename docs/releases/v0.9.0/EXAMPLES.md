# Usage Examples - v0.9.0

v0.9.0 does not introduce new component APIs. Existing examples from the main docs and previous releases (e.g. v0.7.0 declarative props, proxy mode, function calling) continue to apply.

## Quick reference

- **Basic usage:** See [README](https://github.com/Signal-Meaning/dg_react_agent#readme) and [API-REFERENCE.md](../../API-REFERENCE.md).
- **Proxy mode / backend:** See [BACKEND-PROXY](../../BACKEND-PROXY/) and test-app usage.
- **Function calling:** See [BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md) and test-app `function-call-handlers` and backend mount.
- **Real-API tests:** See [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md) and `USE_REAL_APIS=1 npm test` (scope and keys documented there).

## Installing this release

```bash
npm install @signal-meaning/voice-agent-react@0.9.0
```

If you use the backend package:

```bash
npm install @signal-meaning/voice-agent-backend@0.2.0
```

Configure the registry for `@signal-meaning` as documented in the main README and [voice-agent-backend README](https://github.com/Signal-Meaning/dg_react_agent/tree/main/packages/voice-agent-backend).

## References

- [NEW-FEATURES.md](./NEW-FEATURES.md) — v0.9.0 features (real-API tests, backend contract docs, backend 0.2.0)
- [CHANGELOG.md](./CHANGELOG.md) — Full changelog for v0.9.0
