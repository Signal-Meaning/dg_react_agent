# Release Notes - v0.7.19

**Release Date**: February 2026  
**Type**: Patch

## Summary

This patch release adds **OTel-style logging and trace ID propagation** (Issue #412), **backend function-call execution** via POST /function-call (Issue #407), and completes **E2E proxy-mode stabilization** (Issue #420): declarative-props hybrid, lazy-init and idle-timeout fixes, and defaulting E2E to proxy mode.

## Highlights

- **Logger:** Optional `emitLog`-style logger with trace ID; component, test-app, and OpenAI proxy adoption; console allowlist for backward compatibility.
- **Backend:** POST /function-call endpoint and docs (BACKEND-PROXY, CONVERSATION-STORAGE); frontend forwards to backend by default.
- **E2E:** Full proxy E2E passing; `test:e2e` defaults to proxy; declarative-props and lazy-init adjusted for OpenAI; idle-timeout test passes with OpenAI; echo-cancellation test skipped (flaky).
- **Idle timeout:** Shared Settings-based idle timeout; component fix for correct timeout start; WebSocket and idle-timeout close always logged.

## Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.7.19
```

## Documentation

- [Changelog](CHANGELOG.md)
- [Package structure](PACKAGE-STRUCTURE.md)
- Issue #412: [CONSOLE-AUDIT](../../issues/ISSUE-412/CONSOLE-AUDIT.md), logger migration
- Issue #407: [BACKEND-PROXY](../../BACKEND-PROXY/), backend function-call
- Issue #420: [E2E-PROXY-FAILURES](../../issues/ISSUE-420/E2E-PROXY-FAILURES.md)
