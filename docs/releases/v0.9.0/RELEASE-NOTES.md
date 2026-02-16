# Release Notes - v0.9.0

**Release Date**: February 2026  
**Type**: Minor (backward compatible)

## Summary

v0.9.0 delivers **real-API test support**, **documented function-call backend contract**, and **clarified scope** for third-party backends (Epic #455). There are **no component API changes**; the release includes documentation, test infrastructure, and the **voice-agent-backend 0.2.0** package.

## Highlights

- **Real-API tests:** Run relevant tests against real APIs with `USE_REAL_APIS=1`; scope and instructions in [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md).
- **Backend contract:** Single `POST /function-call` contract documented as intentional; callers may customize ([BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md)).
- **3pp scope:** Voice-commerce and other third-party backends are out of scope; they maintain their own contracts.
- **Backend 0.2.0:** OpenAI proxy in package, Realtime 401 fix, openai-proxy and docs updates.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.0` and optionally `@signal-meaning/voice-agent-backend@0.2.0`.

See [CHANGELOG.md](./CHANGELOG.md), [MIGRATION.md](./MIGRATION.md), and [NEW-FEATURES.md](./NEW-FEATURES.md) for details.
