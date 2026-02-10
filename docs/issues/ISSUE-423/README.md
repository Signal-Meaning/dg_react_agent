# Issue #423: Published backend/proxy package with programmatic API and CLI

**Branch:** `davidrmcgee/issue423`  
**GitHub:** [#423](https://github.com/Signal-Meaning/dg_react_agent/issues/423)

---

## Summary

Provide a **published backend/proxy package** (e.g. `@signal-meaning/voice-agent-backend` or similar) with a **programmatic API** and/or **CLI**, so consumers (e.g. voice-commerce) can depend on it and mount `/api/deepgram/proxy`, `/api/openai/proxy`, and function-call on that implementation instead of maintaining custom proxy code.

---

## Request (voice-commerce team)

- Ask the component team for a published backend/proxy package with a programmatic API and/or CLI.
- Once that exists: voice-commerce will depend on it and mount `/api/deepgram/proxy`, `/api/openai/proxy`, and function-call on that implementation instead of custom proxy code; reduce voice-commerce code to a **thin wrapper** (config, auth, logging).

---

## Scope

- **Deliverable:** A publishable package (e.g. npm) that:
  - Exposes a **programmatic API** (e.g. create server, mount routes) so an app can plug in the backend/proxy with minimal code.
  - Optionally exposes a **CLI** (e.g. `voice-agent-backend serve`) for standalone or dev use.
- **Routes:** The package must support mounting (or provide out of the box):
  - `/api/deepgram/proxy` (or equivalent Deepgram proxy)
  - `/api/openai/proxy` (or equivalent OpenAI proxy)
  - Function-call handling (e.g. POST endpoint or WebSocket path used by the test-app today).
- **Consumer story:** A consumer (e.g. voice-commerce) can depend on the package and implement only a thin wrapper: config, auth, logging.

---

## Out of scope (for this issue)

- Changes to the voice-commerce codebase (that team will consume the package once it exists).
- Changing the behavior of the existing proxy/backend logic; the goal is to **package** current (or refactored) behavior, not redesign it in this issue.

---

## Docs in this directory

| Doc | Purpose |
|-----|--------|
| [README.md](./README.md) | This file — issue summary and scope. |
| [TDD-PLAN.md](./TDD-PLAN.md) | TDD plan: tests first, then implementation for the published package. |

---

## References

- Current backend/proxy implementation: `test-app/scripts/backend-server.js`, `scripts/openai-proxy/`.
- Issue #407: Backend function-call execution (contract and pattern).
- Issue #414: Component/proxy interface (transcript, VAD, protocol).
